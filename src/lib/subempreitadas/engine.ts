// Motor de atribuição automática de subempreitada a um artigo de orçamento.
// Puro (sem I/O). Devolve subempreitada mais provável, confiança, origem,
// razão, termos que fizeram match e conflitos — para auditoria.

export type Subempreitada = {
  id: string;
  codigo: string;
  nome: string;
  palavras_chave: string[];
  termos_exclusao: string[];
  ativo: boolean;
};

export type ArtigoInput = {
  codigo: string | null;
  descricao: string;
  unidade?: string | null;
  capitulo_descricao?: string | null;
};

export type ArtigoMestreCtx = {
  subempreitada_principal_id: string | null;
} | null;

export type AprendizagemHit = {
  descricao_normalizada: string;
  subempreitada_id: string;
  peso: number;
};

export type ClassificacaoOrigem =
  | "manual"
  | "aprendizagem"
  | "artigo_mestre"
  | "regras"
  | "baixa_confianca"
  | "conflito"
  | "sem_regra"
  | "ia";

export type ClassificacaoResultado = {
  subempreitada_id: string | null;
  subempreitada_sugerida_id: string | null;
  confianca: number; // 0..1
  origem: ClassificacaoOrigem;
  razao: string;
  termos_match: string[];
  conflitos: Array<{ subempreitada_id: string; score: number }>;
  alternativas: Array<{ subempreitada_id: string; score: number }>;
};

// ==== Constantes de scoring (afináveis) ==================================
export const THRESHOLD_AUTO = 0.7; // < 0.70 → não atribui automaticamente
export const CONFLICT_DELTA = 0.2; // se best-2ª < 0.20 → conflito
export const W_FORTE = 0.75;
export const W_CAPITULO = 0.2;
export const W_CAPITULO_FILHO = 0.75;
export const W_SINONIMO = 0.15;
export const W_UNIDADE = 0.05;
export const W_EXCLUSAO = -0.5;
export const FORTES_TOPO = 4; // primeiros N termos de palavras_chave são "fortes"

// Unidades típicas por código de subempreitada
const UNIDADES_ESPERADAS: Record<string, string[]> = {
  PEDRA: ["m2", "ml", "un"],
  CAPOTO: ["m2"],
  CAIX: ["un", "m2"],
  CARPT: ["un", "ml", "m2"],
  COZ: ["un", "ml"],
  SANIT: ["un"],
  AGUAS: ["ml", "un"],
  AVAC: ["un", "ml"],
  ELECT: ["un", "ml"],
  PINT: ["m2"],
  PLADUR: ["m2", "ml"],
  REBOC: ["m2"],
  ALVEN: ["m2"],
  DEMOL: ["m2", "m3", "ml", "un", "vg"],
  ESTRUT: ["m3", "kg", "m2"],
  PAV: ["m2"],
};

/** Normaliza texto pt-PT: minúsculas, sem acentos, espaços colapsados. */
export function normalizar(t: string | null | undefined): string {
  if (!t) return "";
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarUnidade(u: string | null | undefined): string {
  const n = normalizar(u);
  return n.replace(/\s+/g, "");
}

function contemTermo(haystack: string, termo: string): boolean {
  const t = normalizar(termo);
  if (!t) return false;
  return (" " + haystack + " ").includes(" " + t + " ") || haystack.includes(t);
}

type SubScore = {
  sub: Subempreitada;
  score: number;
  termos: string[];
  razoes: string[];
};

function scoreSub(
  sub: Subempreitada,
  desc: string,
  cap: string,
  unidade: string,
): SubScore {
  const termos: string[] = [];
  const razoes: string[] = [];
  let score = 0;
  const descricaoCurta = desc.length <= 32 || desc.split(" ").filter(Boolean).length <= 4;

  const fortes = sub.palavras_chave.slice(0, FORTES_TOPO);
  const sinonimos = sub.palavras_chave.slice(FORTES_TOPO);

  let hitForte = false;
  for (const kw of fortes) {
    if (contemTermo(desc, kw)) {
      score += W_FORTE;
      termos.push(kw);
      if (!hitForte) razoes.push(`termo forte "${kw}" na descrição`);
      hitForte = true;
    }
  }

  let hitSinonimo = false;
  for (const kw of sinonimos) {
    if (contemTermo(desc, kw)) {
      score += W_SINONIMO;
      termos.push(kw);
      if (!hitSinonimo) razoes.push(`sinónimo "${kw}"`);
      hitSinonimo = true;
    }
  }

  if (cap) {
    for (const kw of sub.palavras_chave) {
      if (contemTermo(cap, kw)) {
        const pesoCapitulo = descricaoCurta ? W_CAPITULO_FILHO : W_CAPITULO;
        score += pesoCapitulo;
        razoes.push(
          descricaoCurta
            ? `descrição curta; contexto do artigo-pai contém "${kw}"`
            : `capítulo contém "${kw}"`,
        );
        if (!termos.includes(kw)) termos.push(kw);
        break;
      }
    }
  }

  const ues = UNIDADES_ESPERADAS[sub.codigo];
  if (ues && unidade && ues.includes(unidade)) {
    score += W_UNIDADE;
    razoes.push(`unidade "${unidade}" compatível`);
  }

  for (const ex of sub.termos_exclusao) {
    if (contemTermo(desc, ex) || (cap && contemTermo(cap, ex))) {
      score += W_EXCLUSAO;
      razoes.push(`termo negativo "${ex}"`);
    }
  }

  if (score < 0) score = 0;
  if (score > 1) score = 1;

  return { sub, score, termos, razoes };
}

/**
 * Cascata:
 * 1. Aprendizagem manual (match exato descrição normalizada) → 1.0
 * 2. Artigo mestre com subempreitada principal → 0.95
 * 3. Regras ponderadas com threshold e detecção de conflito
 */
export function classificarArtigo(
  artigo: ArtigoInput,
  subs: Subempreitada[],
  artigoMestre: ArtigoMestreCtx,
  aprendizagem: AprendizagemHit[],
): ClassificacaoResultado {
  const descN = normalizar(artigo.descricao);

  // 1. Aprendizagem
  const hit = aprendizagem.find((a) => a.descricao_normalizada === descN);
  if (hit) {
    return {
      subempreitada_id: hit.subempreitada_id,
      subempreitada_sugerida_id: hit.subempreitada_id,
      confianca: 1,
      origem: "aprendizagem",
      razao: "match exato na aprendizagem de validações anteriores",
      termos_match: [],
      conflitos: [],
      alternativas: [],
    };
  }

  // 2. Artigo mestre
  if (artigoMestre?.subempreitada_principal_id) {
    return {
      subempreitada_id: artigoMestre.subempreitada_principal_id,
      subempreitada_sugerida_id: artigoMestre.subempreitada_principal_id,
      confianca: 0.95,
      origem: "artigo_mestre",
      razao: "subempreitada definida no Artigo Mestre",
      termos_match: [],
      conflitos: [],
      alternativas: [],
    };
  }

  // 3. Regras
  const haystack = normalizar(`${artigo.descricao} ${artigo.codigo ?? ""}`);
  const capN = normalizar(artigo.capitulo_descricao ?? "");
  const unN = normalizarUnidade(artigo.unidade ?? "");

  // Em descritivos extensos, o primeiro parágrafo identifica normalmente a
  // arte principal; o restante enumera acessórios de outras especialidades.
  // Uma correspondência inequívoca logo no início evita falsos conflitos.
  const inicio = normalizar(`${artigo.descricao.slice(0, 240)} ${artigo.codigo ?? ""}`);
  const scoresInicio = subs
    .filter((s) => s.ativo)
    .map((s) => scoreSub(s, inicio, "", unN))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  const melhorInicio = scoresInicio[0];
  const segundoInicio = scoresInicio[1];
  if (
    melhorInicio &&
    melhorInicio.score >= THRESHOLD_AUTO &&
    (!segundoInicio || melhorInicio.score - segundoInicio.score >= CONFLICT_DELTA)
  ) {
    const confianca = Number(melhorInicio.score.toFixed(3));
    return {
      subempreitada_id: melhorInicio.sub.id,
      subempreitada_sugerida_id: melhorInicio.sub.id,
      confianca,
      origem: "regras",
      razao: `trabalho principal identificado no início do descritivo; ${melhorInicio.razoes.join("; ")}`,
      termos_match: melhorInicio.termos,
      conflitos: [],
      alternativas: scoresInicio.slice(1, 4).map((s) => ({
        subempreitada_id: s.sub.id,
        score: Number(s.score.toFixed(3)),
      })),
    };
  }

  const scores = subs
    .filter((s) => s.ativo)
    .map((s) => scoreSub(s, haystack, capN, unN))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    return {
      subempreitada_id: null,
      subempreitada_sugerida_id: null,
      confianca: 0,
      origem: "sem_regra",
      razao: "nenhuma regra fez match",
      termos_match: [],
      conflitos: [],
      alternativas: [],
    };
  }

  const best = scores[0];
  const second = scores[1];
  const conf = Number(best.score.toFixed(3));
  const alternativas = scores
    .slice(1, 4)
    .map((s) => ({ subempreitada_id: s.sub.id, score: Number(s.score.toFixed(3)) }));

  // Conflito
  if (second && best.score - second.score < CONFLICT_DELTA) {
    return {
      subempreitada_id: null,
      subempreitada_sugerida_id: best.sub.id,
      confianca: conf,
      origem: "conflito",
      razao: `conflito entre ${best.sub.codigo} (${conf}) e ${second.sub.codigo} (${second.score.toFixed(3)}) — diferença < ${CONFLICT_DELTA}`,
      termos_match: best.termos,
      conflitos: [
        { subempreitada_id: best.sub.id, score: conf },
        { subempreitada_id: second.sub.id, score: Number(second.score.toFixed(3)) },
      ],
      alternativas,
    };
  }

  // Threshold
  if (conf < THRESHOLD_AUTO) {
    return {
      subempreitada_id: null,
      subempreitada_sugerida_id: best.sub.id,
      confianca: conf,
      origem: "baixa_confianca",
      razao: `confiança ${conf} inferior ao threshold ${THRESHOLD_AUTO}; sugestão ${best.sub.codigo} — ${best.razoes.join("; ")}`,
      termos_match: best.termos,
      conflitos: [],
      alternativas,
    };
  }

  return {
    subempreitada_id: best.sub.id,
    subempreitada_sugerida_id: best.sub.id,
    confianca: conf,
    origem: "regras",
    razao: best.razoes.join("; ") || "match por regras",
    termos_match: best.termos,
    conflitos: [],
    alternativas,
  };
}
