// Motor de atribuição automática de subempreitada a um artigo de orçamento.
// Puro (sem I/O). Recebe o artigo + contexto (subempreitadas + aprendizagem + artigo mestre opcional)
// e devolve a subempreitada mais provável, confiança e origem.

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
  | "ia";

export type ClassificacaoResultado = {
  subempreitada_id: string | null;
  confianca: number; // 0..1
  origem: ClassificacaoOrigem;
  alternativas: Array<{ subempreitada_id: string; score: number }>;
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

function contemTermo(haystack: string, termo: string): boolean {
  const t = normalizar(termo);
  if (!t) return false;
  // match por palavra: usa fronteira de espaço
  return (" " + haystack + " ").includes(" " + t + " ") || haystack.includes(t);
}

/**
 * Cascata:
 * 1. Aprendizagem manual (match exato descrição normalizada) → 1.0
 * 2. Artigo mestre com subempreitada principal → 0.95
 * 3. Regras por palavras-chave (com termos_exclusao) + sinal auxiliar do capítulo
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
    return { subempreitada_id: hit.subempreitada_id, confianca: 1, origem: "aprendizagem", alternativas: [] };
  }

  // 2. Artigo mestre
  if (artigoMestre?.subempreitada_principal_id) {
    return {
      subempreitada_id: artigoMestre.subempreitada_principal_id,
      confianca: 0.95,
      origem: "artigo_mestre",
      alternativas: [],
    };
  }

  // 3. Regras por palavras-chave
  const haystack = normalizar(`${artigo.descricao} ${artigo.codigo ?? ""}`);
  const capN = normalizar(artigo.capitulo_descricao ?? "");
  const scores: Array<{ sub: Subempreitada; score: number; matches: number }> = [];

  for (const s of subs) {
    if (!s.ativo) continue;
    let score = 0;
    let matches = 0;
    for (const kw of s.palavras_chave) {
      if (contemTermo(haystack, kw)) {
        score += 10;
        matches += 1;
      }
    }
    for (const ex of s.termos_exclusao) {
      if (contemTermo(haystack, ex)) score -= 25;
    }
    // sinal auxiliar do capítulo (máx 10%)
    if (capN) {
      for (const kw of s.palavras_chave) {
        if (contemTermo(capN, kw)) {
          score += 2;
          break;
        }
      }
    }
    if (score > 0 || matches > 0) scores.push({ sub: s, score, matches });
  }

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  if (!best || best.score <= 0) {
    return { subempreitada_id: null, confianca: 0, origem: "regras", alternativas: [] };
  }

  // Confiança normalizada: cresce com score, saturando por volta de 40-60.
  // 1 match = ~0.55, 2 = ~0.72, 3+ = >0.80, com penalização por termos de exclusão.
  const conf = Math.max(0, Math.min(0.94, best.score / (best.score + 10)));

  const alternativas = scores.slice(1, 4).map((s) => ({ subempreitada_id: s.sub.id, score: s.score }));

  return {
    subempreitada_id: best.sub.id,
    confianca: Number(conf.toFixed(3)),
    origem: "regras",
    alternativas,
  };
}
