import { supabase } from "@/integrations/supabase/client";

export type Metodo = "exato" | "aprendido" | "keyword_artigo" | "keyword_subesp" | "keyword_esp" | "manual" | "nenhum";

export type KeywordHit = {
  termo: string;
  nivel: "especialidade" | "subespecialidade" | "artigo";
  entidade_id: string;
  entidade_nome: string;
  peso: number;
  pontos: number;
};

export type Candidato = {
  artigo_mestre_id: string;
  descricao: string;
  score: number;
  motivo: string;
  keywords_hit?: KeywordHit[];
  negativas?: KeywordHit[];
};

export type ClassificacaoResultado = {
  artigo_origem_id: string;
  orcamento_id: string;
  descricao_original: string;
  unidade_original: string | null;
  quantidade_original: number | null;
  artigo_mestre_id: string | null;
  categoria_id: string | null;
  subespecialidade_id: string | null;
  especialidade_id: string | null;
  confianca: number;
  estado: "classificado_auto" | "necessita_revisao" | "sem_classificacao";
  metodo_match: Metodo;
  motivo: string;
  candidatos: Candidato[];
};

// Pesos configuráveis (preparado para configuração futura)
// Política conservadora: keywords de ESP/SUBESP nunca classificam sozinhas;
// só reforçam um candidato com forte similaridade textual ao artigo mestre.
export const PESOS_CLASSIFICACAO = {
  ESP_CAP: 10,           // teto de reforço por hits da especialidade
  SUBESP_CAP: 15,        // teto de reforço por hits da subespecialidade
  ART_KEYWORD: 60,       // por keyword positiva de artigo
  NEGATIVA: -80,
  UNIDADE_OK: 15,
  UNIDADE_BAD: -25,
  NGRAMA2: 15,
  NGRAMA3: 25,
  NGRAMA_CAP: 40,
  TOKEN_RARO: 10,
  TOKEN_RARO_CAP: 20,
  MIN_TEXTO: 40,         // score_texto mínimo para ser candidato
  MIN_TEXTO_UNIDADE: 30, // mínimo se unidade compatível
  LIMIAR_AUTO: 85,
  LIMIAR_REVER: 60,
  MIN_TEXTO_AUTO: 50,    // score_texto mínimo para classificado_auto
  MARGEM_AUTO: 15,       // diferença top1-top2 mínima para auto
} as const;

// Abreviaturas e expansões comuns no setor
const ABREVIATURAS: Array<[RegExp, string]> = [
  [/\bp\/\b/g, "para"],
  [/\bc\/\b/g, "com"],
  [/\bs\/\b/g, "sem"],
  [/\bn[ºo°]\b/g, "numero"],
  [/\bø\b/g, "diametro"],
  [/\barm\b/g, "armado"],
  [/\bbet\b/g, "betao"],
  [/\bexec\b/g, "execucao"],
  [/\bfornec\b/g, "fornecimento"],
  [/\bmont\b/g, "montagem"],
  [/\bincl\b/g, "incluindo"],
];

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "em", "e", "para", "com", "ou",
  "a", "o", "os", "as", "um", "uma", "uns", "umas", "no", "na", "nos", "nas",
  "ao", "aos", "pela", "pelo", "pelas", "pelos", "que", "se", "por",
]);

export function normalizar(t: string | null | undefined): string {
  if (!t) return "";
  let s = t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const [re, rep] of ABREVIATURAS) s = s.replace(re, rep);
  s = s
    .replace(/[.,;:()[\]{}/\\|"'!?_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

function tokenize(t: string): string[] {
  return normalizar(t)
    .split(" ")
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

function termMatches(normDesc: string, descTokens: Set<string>, termoNorm: string): boolean {
  if (!termoNorm) return false;
  // Termo multi-palavra: match por substring na descrição normalizada
  if (termoNorm.includes(" ")) return normDesc.includes(termoNorm);
  return descTokens.has(termoNorm) || normDesc.includes(termoNorm);
}

type ArtigoBib = {
  id: string;
  descricao: string;
  descricao_norm: string;
  unidade: string | null;
  unidade_norm: string;
  subespecialidade_id: string;
  categoria_id: string;
  tokens: string[];
  token_set: Set<string>;
  bigrams: string[];
  trigrams: string[];
};

type Conhecimento = {
  negIncompat: Map<string, { termo: string; termo_norm: string; peso: number }[]>;
  negConcorrente: Map<string, { termo: string; termo_norm: string; peso: number }[]>;
  unidades: Map<string, Set<string>>;
  exemplos: Map<string, { termo_norm: string; tokens: Set<string> }[]>;
};

type Bib = {
  artigos: ArtigoBib[];
  artKw: { artigo_id: string; termo: string; termo_norm: string; tipo: "positiva" | "negativa" }[];
  subKw: { subespecialidade_id: string; termo: string; termo_norm: string; tipo: string; peso: number }[];
  espKw: { especialidade_id: string; termo: string; termo_norm: string; tipo: string; peso: number }[];
  subs: Map<string, { id: string; nome: string; especialidade_id: string }>;
  esps: Map<string, { id: string; nome: string }>;
  cats: Map<string, { id: string; nome: string; subespecialidade_id: string }>;
  memoria: Map<string, string>;
  docFreq: Map<string, number>; // token -> nº de artigos mestres que o contêm
  conhec: Conhecimento;
};

// ---- Unidades ------------------------------------------------------------

const UNIDADE_SINONIMOS: Record<string, string> = {
  "m³": "m3", "m^3": "m3", "m 3": "m3", "metroscubicos": "m3", "metrocubico": "m3",
  "m²": "m2", "m^2": "m2", "m 2": "m2", "metrosquadrados": "m2", "metroquadrado": "m2",
  "ml": "m", "metro": "m", "metros": "m",
  "un": "un", "und": "un", "uni": "un", "unid": "un", "unidade": "un", "unidades": "un", "pç": "un", "pc": "un",
  "vg": "vg", "vg.": "vg",
  "kg": "kg", "kgs": "kg", "quilo": "kg", "quilos": "kg",
  "h": "h", "hora": "h", "horas": "h",
  "l": "l", "lt": "l", "litro": "l", "litros": "l",
  "t": "t", "ton": "t", "tonelada": "t", "toneladas": "t",
};

function normalizarUnidade(u: string | null | undefined): string {
  if (!u) return "";
  let s = u.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/²/g, "2").replace(/³/g, "3").replace(/\s+/g, "").trim();
  return UNIDADE_SINONIMOS[s] ?? s;
}

function compararUnidades(a: string, b: string): 1 | 0 | -1 {
  if (!a || !b) return 0;
  if (a === b) return 1;
  return -1;
}

// ---- N-gramas ------------------------------------------------------------

function ngrams(tokens: string[], n: number): string[] {
  if (tokens.length < n) return [];
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) out.push(tokens.slice(i, i + n).join(" "));
  return out;
}

// ---- Carregamento --------------------------------------------------------

async function loadBib(): Promise<Bib> {
  const [{ data: arts }, { data: artKw }, { data: subKw }, { data: espKw }, { data: subs }, { data: esps }, { data: cats }, { data: mem }, { data: conhecRaw }] = await Promise.all([
    supabase.from("biblioteca_artigos").select("id, descricao, unidade, subespecialidade_id, categoria_id").eq("ativo", true),
    supabase.from("biblioteca_artigo_keywords").select("artigo_id, termo, tipo"),
    supabase.from("biblioteca_subespecialidade_keywords").select("subespecialidade_id, termo, tipo, peso").eq("ativo", true),
    supabase.from("biblioteca_especialidade_keywords").select("especialidade_id, termo, tipo, peso").eq("ativo", true),
    supabase.from("biblioteca_subespecialidades").select("id, nome, especialidade_id"),
    supabase.from("biblioteca_especialidades").select("id, nome"),
    supabase.from("biblioteca_categorias").select("id, nome, subespecialidade_id"),
    supabase.from("classificacao_memoria").select("descricao_normalizada, artigo_mestre_id"),
    supabase.from("biblioteca_artigo_conhecimento").select("artigo_mestre_id, tipo, termo, peso").eq("ativo", true).in("tipo", ["negativo_incompativel", "negativo_concorrente", "termo_negativo", "unidade_compativel", "exemplo_real"]),
  ]);

  const artigos: ArtigoBib[] = (arts ?? []).map((a: any) => {
    const descricao_norm = normalizar(a.descricao);
    const tokens = tokenize(a.descricao);
    return {
      id: a.id,
      descricao: a.descricao,
      descricao_norm,
      unidade: a.unidade ?? null,
      unidade_norm: normalizarUnidade(a.unidade),
      subespecialidade_id: a.subespecialidade_id,
      categoria_id: a.categoria_id,
      tokens,
      token_set: new Set(tokens),
      bigrams: ngrams(tokens, 2),
      trigrams: ngrams(tokens, 3),
    };
  });

  // Document frequency
  const docFreq = new Map<string, number>();
  for (const a of artigos) {
    for (const t of a.token_set) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
  }

  const conhec: Conhecimento = {
    negIncompat: new Map(),
    negConcorrente: new Map(),
    unidades: new Map(),
    exemplos: new Map(),
  };
  for (const r of (conhecRaw ?? []) as any[]) {
    const aid = r.artigo_mestre_id as string;
    const termo = (r.termo as string) ?? "";
    if (!termo) continue;
    if (r.tipo === "negativo_incompativel" || r.tipo === "termo_negativo") {
      const arr = conhec.negIncompat.get(aid) ?? [];
      arr.push({ termo, termo_norm: normalizar(termo), peso: Number(r.peso) || -60 });
      conhec.negIncompat.set(aid, arr);
    } else if (r.tipo === "negativo_concorrente") {
      const arr = conhec.negConcorrente.get(aid) ?? [];
      arr.push({ termo, termo_norm: normalizar(termo), peso: Number(r.peso) || -15 });
      conhec.negConcorrente.set(aid, arr);
    } else if (r.tipo === "unidade_compativel") {
      const set = conhec.unidades.get(aid) ?? new Set<string>();
      set.add(normalizarUnidade(termo));
      conhec.unidades.set(aid, set);
    } else if (r.tipo === "exemplo_real") {
      const arr = conhec.exemplos.get(aid) ?? [];
      const n = normalizar(termo);
      arr.push({ termo_norm: n, tokens: new Set(tokenize(termo)) });
      conhec.exemplos.set(aid, arr);
    }
  }

  return {
    artigos,
    artKw: (artKw ?? []).map((k: any) => ({ ...k, termo_norm: normalizar(k.termo) })),
    subKw: (subKw ?? []).map((k: any) => ({ ...k, termo_norm: normalizar(k.termo), peso: Number(k.peso) || 1 })),
    espKw: (espKw ?? []).map((k: any) => ({ ...k, termo_norm: normalizar(k.termo), peso: Number(k.peso) || 1 })),
    subs: new Map((subs ?? []).map((s: any) => [s.id, s])),
    esps: new Map((esps ?? []).map((e: any) => [e.id, e])),
    cats: new Map((cats ?? []).map((c: any) => [c.id, c])),
    memoria: new Map((mem ?? []).map((m: any) => [m.descricao_normalizada, m.artigo_mestre_id])),
    docFreq,
    conhec,
  };
}

function fillHierarchy(bib: Bib, artigoMestreId: string) {
  const a = bib.artigos.find((x) => x.id === artigoMestreId);
  if (!a) return { artigo_mestre_id: null, categoria_id: null, subespecialidade_id: null, especialidade_id: null };
  const sub = bib.subs.get(a.subespecialidade_id);
  return {
    artigo_mestre_id: a.id,
    categoria_id: a.categoria_id,
    subespecialidade_id: a.subespecialidade_id,
    especialidade_id: sub?.especialidade_id ?? null,
  };
}

// ---- Scoring por candidato ----------------------------------------------

type CandScore = {
  art: ArtigoBib;
  score_texto: number;
  score_final: number;
  hits: KeywordHit[];
  negs: KeywordHit[];
  unidadeCompat: 1 | 0 | -1;
  tokensPartilhados: string[];
};

function scoreCandidato(
  art: ArtigoBib,
  origemTokenSet: Set<string>,
  origemNorm: string,
  unidadeOrigem: string,
  bib: Bib,
  totalArtigos: number,
  artHitsForArt: KeywordHit[],
  artNegsForArt: KeywordHit[],
  espHitsCap: number,
  subespHitsCap: number,
  espNegs: KeywordHit[],
  subespNegs: KeywordHit[],
): CandScore | null {
  // 1) Similaridade textual
  const partilhados: string[] = [];
  for (const t of art.token_set) if (origemTokenSet.has(t)) partilhados.push(t);
  const cobertura = art.tokens.length > 0 ? partilhados.length / art.tokens.length : 0;
  const score_texto = Math.round(cobertura * 100);

  // 2) Bónus n-gramas (frase contígua do mestre presente no original)
  let bonusN = 0;
  for (const tg of art.trigrams) {
    if (origemNorm.includes(tg)) { bonusN += PESOS_CLASSIFICACAO.NGRAMA3; if (bonusN >= PESOS_CLASSIFICACAO.NGRAMA_CAP) break; }
  }
  if (bonusN < PESOS_CLASSIFICACAO.NGRAMA_CAP) {
    for (const bg of art.bigrams) {
      if (origemNorm.includes(bg)) { bonusN += PESOS_CLASSIFICACAO.NGRAMA2; if (bonusN >= PESOS_CLASSIFICACAO.NGRAMA_CAP) break; }
    }
  }
  bonusN = Math.min(bonusN, PESOS_CLASSIFICACAO.NGRAMA_CAP);

  // 3) Bónus tokens raros (< 2% dos artigos)
  let bonusR = 0;
  const limiarRaro = Math.max(2, Math.floor(totalArtigos * 0.02));
  for (const t of partilhados) {
    const df = bib.docFreq.get(t) ?? 0;
    if (df > 0 && df <= limiarRaro) {
      bonusR += PESOS_CLASSIFICACAO.TOKEN_RARO;
      if (bonusR >= PESOS_CLASSIFICACAO.TOKEN_RARO_CAP) break;
    }
  }
  bonusR = Math.min(bonusR, PESOS_CLASSIFICACAO.TOKEN_RARO_CAP);

  // 4) Unidade — combina compatibilidade da unidade do artigo mestre
  //    com a lista alargada "unidade_compativel" do conhecimento estruturado.
  const unidadesCompat = bib.conhec.unidades.get(art.id);
  let unidadeCompat = compararUnidades(unidadeOrigem, art.unidade_norm);
  if (unidadeCompat !== 1 && unidadesCompat && unidadeOrigem && unidadesCompat.has(unidadeOrigem)) {
    unidadeCompat = 1;
  }
  if (unidadeCompat !== 1 && unidadesCompat && unidadeOrigem && unidadesCompat.size > 0 && !unidadesCompat.has(unidadeOrigem)) {
    unidadeCompat = -1;
  }
  const bonusU = unidadeCompat === 1 ? PESOS_CLASSIFICACAO.UNIDADE_OK
               : unidadeCompat === -1 ? PESOS_CLASSIFICACAO.UNIDADE_BAD
               : 0;

  // 5) Keywords positivas/negativas de artigo
  const bonusArtKw = artHitsForArt.reduce((s, h) => s + h.pontos, 0);
  const penalArtKw = artNegsForArt.reduce((s, h) => s + h.pontos, 0);

  // 5b) Conhecimento estruturado: negativos incompatíveis e concorrentes
  let penalIncompat = 0;
  const incompatHits: KeywordHit[] = [];
  for (const n of bib.conhec.negIncompat.get(art.id) ?? []) {
    if (termMatches(origemNorm, origemTokenSet, n.termo_norm)) {
      penalIncompat += n.peso < 0 ? n.peso : -Math.abs(n.peso);
      incompatHits.push({
        termo: n.termo, nivel: "artigo", entidade_id: art.id, entidade_nome: art.descricao,
        peso: 1, pontos: n.peso < 0 ? n.peso : -Math.abs(n.peso),
      });
    }
  }
  let penalConcor = 0;
  const concorHits: KeywordHit[] = [];
  for (const n of bib.conhec.negConcorrente.get(art.id) ?? []) {
    if (termMatches(origemNorm, origemTokenSet, n.termo_norm)) {
      penalConcor += n.peso < 0 ? n.peso : -Math.abs(n.peso);
      concorHits.push({
        termo: n.termo, nivel: "artigo", entidade_id: art.id, entidade_nome: art.descricao,
        peso: 1, pontos: n.peso < 0 ? n.peso : -Math.abs(n.peso),
      });
    }
  }

  // 5c) Exemplos reais — similaridade textual (Jaccard nos tokens)
  let bonusExemplos = 0;
  const exemplos = bib.conhec.exemplos.get(art.id) ?? [];
  if (exemplos.length && origemTokenSet.size) {
    let melhor = 0;
    for (const ex of exemplos) {
      if (!ex.tokens.size) continue;
      let inter = 0;
      for (const t of ex.tokens) if (origemTokenSet.has(t)) inter++;
      const uni = ex.tokens.size + origemTokenSet.size - inter;
      const sim = uni > 0 ? inter / uni : 0;
      if (sim > melhor) melhor = sim;
    }
    bonusExemplos = Math.round(melhor * 40);
  }

  // 6) Filtro de elegibilidade conservador
  const temArtKeywordPositiva = artHitsForArt.length > 0;
  const elegivel =
    temArtKeywordPositiva ||
    score_texto >= PESOS_CLASSIFICACAO.MIN_TEXTO ||
    (score_texto >= PESOS_CLASSIFICACAO.MIN_TEXTO_UNIDADE && unidadeCompat === 1) ||
    bonusExemplos >= 25;
  if (!elegivel) return null;

  const score_final =
    score_texto + bonusN + bonusR + espHitsCap + subespHitsCap + bonusU + bonusArtKw + penalArtKw +
    penalIncompat + penalConcor + bonusExemplos +
    espNegs.reduce((s, h) => s + h.pontos, 0) +
    subespNegs.reduce((s, h) => s + h.pontos, 0);

  // Hit sintético "similaridade textual" para a sidebar IA Explica
  const hits: KeywordHit[] = [];
  if (score_texto > 0) {
    hits.push({
      termo: partilhados.length ? `similaridade textual: ${partilhados.join(", ")}` : "similaridade textual",
      nivel: "artigo",
      entidade_id: art.id,
      entidade_nome: art.descricao,
      peso: 1,
      pontos: score_texto,
    });
  }
  hits.push(...artHitsForArt);
  if (bonusExemplos > 0) {
    hits.push({
      termo: `exemplo real similar (${bonusExemplos} pts)`,
      nivel: "artigo", entidade_id: art.id, entidade_nome: art.descricao,
      peso: 1, pontos: bonusExemplos,
    });
  }

  return {
    art,
    score_texto,
    score_final,
    hits,
    negs: [...artNegsForArt, ...incompatHits, ...concorHits],
    unidadeCompat,
    tokensPartilhados: partilhados,
  };
}

function classifyArtigo(
  artigo: { id: string; orcamento_id: string; descricao: string; unidade: string | null; quantidade: number | null },
  bib: Bib,
): ClassificacaoResultado {
  const norm = normalizar(artigo.descricao);
  const tokens = tokenize(artigo.descricao);
  const tokenSet = new Set(tokens);
  const unidadeOrigem = normalizarUnidade(artigo.unidade);
  const base = {
    artigo_origem_id: artigo.id,
    orcamento_id: artigo.orcamento_id,
    descricao_original: artigo.descricao,
    unidade_original: artigo.unidade,
    quantidade_original: artigo.quantidade,
    candidatos: [] as Candidato[],
  };

  // 1) Aprendido
  const aprendido = bib.memoria.get(norm);
  if (aprendido) {
    const h = fillHierarchy(bib, aprendido);
    const a = bib.artigos.find((x) => x.id === aprendido);
    return {
      ...base, ...h,
      confianca: 100, estado: "classificado_auto", metodo_match: "aprendido",
      motivo: `Aprendido de validações anteriores → "${a?.descricao ?? "—"}"`,
    };
  }

  // 2) Exato
  const exatos = bib.artigos.filter((a) => a.descricao_norm === norm);
  if (exatos.length === 1) {
    const h = fillHierarchy(bib, exatos[0].id);
    return {
      ...base, ...h,
      confianca: 100, estado: "classificado_auto", metodo_match: "exato",
      motivo: `Descrição idêntica ao artigo mestre "${exatos[0].descricao}"`,
    };
  }
  if (exatos.length > 1) {
    const candidatos: Candidato[] = exatos.slice(0, 3).map((a) => ({
      artigo_mestre_id: a.id, descricao: a.descricao, score: 100,
      motivo: "Descrição exatamente igual",
    }));
    return {
      ...base, candidatos,
      artigo_mestre_id: null, categoria_id: null, subespecialidade_id: null, especialidade_id: null,
      confianca: 50, estado: "necessita_revisao", metodo_match: "exato",
      motivo: `${exatos.length} artigos mestres com descrição idêntica — escolher um`,
    };
  }

  if (tokens.length === 0) {
    return {
      ...base,
      artigo_mestre_id: null, categoria_id: null, subespecialidade_id: null, especialidade_id: null,
      confianca: 0, estado: "sem_classificacao", metodo_match: "nenhum",
      motivo: "Descrição vazia ou irrelevante",
    };
  }

  // 3) Hits por nível (recolhe, mas ESP/SUBESP só reforçam; não criam candidatos)
  const espHits = new Map<string, KeywordHit[]>();
  const espNeg = new Map<string, KeywordHit[]>();
  for (const k of bib.espKw) {
    if (!termMatches(norm, tokenSet, k.termo_norm)) continue;
    const esp = bib.esps.get(k.especialidade_id);
    const hit: KeywordHit = {
      termo: k.termo, nivel: "especialidade",
      entidade_id: k.especialidade_id, entidade_nome: esp?.nome ?? "—",
      peso: k.peso, pontos: 0,
    };
    const map = k.tipo === "negativa" ? espNeg : espHits;
    const arr = map.get(k.especialidade_id) ?? [];
    arr.push(hit);
    map.set(k.especialidade_id, arr);
  }

  const subHits = new Map<string, KeywordHit[]>();
  const subNeg = new Map<string, KeywordHit[]>();
  for (const k of bib.subKw) {
    if (!termMatches(norm, tokenSet, k.termo_norm)) continue;
    const sub = bib.subs.get(k.subespecialidade_id);
    const hit: KeywordHit = {
      termo: k.termo, nivel: "subespecialidade",
      entidade_id: k.subespecialidade_id, entidade_nome: sub?.nome ?? "—",
      peso: k.peso, pontos: 0,
    };
    const map = k.tipo === "negativa" ? subNeg : subHits;
    const arr = map.get(k.subespecialidade_id) ?? [];
    arr.push(hit);
    map.set(k.subespecialidade_id, arr);
  }

  const artHits = new Map<string, KeywordHit[]>();
  const artNeg = new Map<string, KeywordHit[]>();
  for (const k of bib.artKw) {
    if (!termMatches(norm, tokenSet, k.termo_norm)) continue;
    const a = bib.artigos.find((x) => x.id === k.artigo_id);
    if (!a) continue;
    const pts = k.tipo === "negativa" ? PESOS_CLASSIFICACAO.NEGATIVA : PESOS_CLASSIFICACAO.ART_KEYWORD;
    const hit: KeywordHit = {
      termo: k.termo, nivel: "artigo",
      entidade_id: k.artigo_id, entidade_nome: a.descricao,
      peso: 1, pontos: pts,
    };
    const map = k.tipo === "negativa" ? artNeg : artHits;
    const arr = map.get(k.artigo_id) ?? [];
    arr.push(hit);
    map.set(k.artigo_id, arr);
  }

  // 4) Construir lista de candidatos.
  //    Universo de candidatos: artigos com keyword positiva de artigo +
  //    todos os artigos do top de subespecialidades/especialidades com hits,
  //    mas só passam o filtro se tiverem similaridade textual mínima.
  const totalArtigos = bib.artigos.length;

  const candidatos: CandScore[] = [];
  const consideredArt = new Set<string>();

  const considerArtigo = (art: ArtigoBib) => {
    if (consideredArt.has(art.id)) return;
    consideredArt.add(art.id);

    const sub = bib.subs.get(art.subespecialidade_id);
    const espId = sub?.especialidade_id ?? null;

    // Reforços com teto (não acumulam para o infinito)
    const espArr = espId ? (espHits.get(espId) ?? []) : [];
    const subArr = subHits.get(art.subespecialidade_id) ?? [];
    const espCap = espArr.length > 0 ? PESOS_CLASSIFICACAO.ESP_CAP : 0;
    const subCap = subArr.length > 0 ? PESOS_CLASSIFICACAO.SUBESP_CAP : 0;

    const espNegArr = espId ? (espNeg.get(espId) ?? []).map(h => ({ ...h, pontos: PESOS_CLASSIFICACAO.NEGATIVA })) : [];
    const subNegArr = (subNeg.get(art.subespecialidade_id) ?? []).map(h => ({ ...h, pontos: PESOS_CLASSIFICACAO.NEGATIVA }));

    const cand = scoreCandidato(
      art, tokenSet, norm, unidadeOrigem, bib, totalArtigos,
      artHits.get(art.id) ?? [],
      artNeg.get(art.id) ?? [],
      espCap, subCap,
      espNegArr, subNegArr,
    );
    if (!cand) return;

    // Reforços com etiqueta visível (pontos cap, não os pontos brutos)
    if (espArr.length > 0) {
      cand.hits.push({ ...espArr[0], pontos: espCap });
    }
    if (subArr.length > 0) {
      cand.hits.push({ ...subArr[0], pontos: subCap });
    }
    cand.negs.push(...espNegArr, ...subNegArr);
    candidatos.push(cand);
  };

  // 4a) Sempre considerar artigos com keyword positiva de artigo
  for (const artId of artHits.keys()) {
    const a = bib.artigos.find((x) => x.id === artId);
    if (a) considerArtigo(a);
  }

  // 4b) Triagem por similaridade textual: percorrer todos os artigos cuja
  //     subespecialidade ou especialidade teve hit (universo já reduzido).
  //     Caso não haja hits a nenhum nível, percorrer todos (a similaridade
  //     filtra na mesma — é apenas O(n) tokens).
  const subEspComHit = new Set(subHits.keys());
  const espComHit = new Set(espHits.keys());

  const universo = subEspComHit.size > 0 || espComHit.size > 0
    ? bib.artigos.filter((a) => {
        if (subEspComHit.has(a.subespecialidade_id)) return true;
        const sub = bib.subs.get(a.subespecialidade_id);
        return sub ? espComHit.has(sub.especialidade_id) : false;
      })
    : bib.artigos;

  for (const a of universo) considerArtigo(a);

  // 5) Ranking
  candidatos.sort((a, b) => b.score_final - a.score_final);
  const ranked = candidatos.slice(0, 5);

  if (ranked.length === 0) {
    return {
      ...base,
      artigo_mestre_id: null, categoria_id: null, subespecialidade_id: null, especialidade_id: null,
      confianca: 0, estado: "sem_classificacao", metodo_match: "nenhum",
      motivo: "Nenhum artigo mestre com similaridade textual suficiente",
    };
  }

  const candArr: Candidato[] = ranked.slice(0, 3).map((c) => {
    const partes: string[] = [];
    if (c.score_texto > 0) partes.push(`similaridade ${c.score_texto}%`);
    if (c.tokensPartilhados.length) partes.push(`tokens: ${c.tokensPartilhados.slice(0, 6).join(", ")}`);
    if (c.unidadeCompat === 1) partes.push("unidade compatível");
    if (c.unidadeCompat === -1) partes.push("unidade incompatível");
    return {
      artigo_mestre_id: c.art.id,
      descricao: c.art.descricao,
      score: Math.max(0, Math.min(100, Math.round(c.score_final))),
      motivo: partes.join(" · "),
      keywords_hit: c.hits,
      negativas: c.negs,
    };
  });

  const top = ranked[0];
  const top2 = ranked[1];
  const topScore = Math.max(0, Math.min(100, Math.round(top.score_final)));
  const margem = top2 ? top.score_final - top2.score_final : Infinity;

  // 6) Decisão conservadora
  const podeAuto =
    top.score_final >= PESOS_CLASSIFICACAO.LIMIAR_AUTO &&
    top.score_texto >= PESOS_CLASSIFICACAO.MIN_TEXTO_AUTO &&
    top.unidadeCompat !== -1 &&
    margem >= PESOS_CLASSIFICACAO.MARGEM_AUTO &&
    top.negs.length === 0;

  let estado: "classificado_auto" | "necessita_revisao" | "sem_classificacao";
  if (podeAuto) estado = "classificado_auto";
  else if (top.score_final >= PESOS_CLASSIFICACAO.LIMIAR_REVER) estado = "necessita_revisao";
  else estado = "sem_classificacao";

  const partesMot: string[] = [];
  partesMot.push(`Similaridade textual ${top.score_texto}%`);
  if (top.tokensPartilhados.length) partesMot.push(`(tokens: ${top.tokensPartilhados.slice(0, 6).join(", ")})`);
  if (top.unidadeCompat === 1) partesMot.push("· unidade compatível");
  if (top.unidadeCompat === -1) partesMot.push("· unidade INCOMPATÍVEL");
  if (top2 && margem < PESOS_CLASSIFICACAO.MARGEM_AUTO) partesMot.push(`· margem curta sobre 2º (${Math.round(margem)} pts)`);
  const motivo = partesMot.join(" ");

  if (estado === "sem_classificacao") {
    return {
      ...base, candidatos: candArr,
      artigo_mestre_id: null, categoria_id: null, subespecialidade_id: null, especialidade_id: null,
      confianca: topScore, estado, metodo_match: "nenhum",
      motivo: `${motivo} — score ${topScore} abaixo do limiar`,
    };
  }

  const h = fillHierarchy(bib, top.art.id);
  return {
    ...base, ...h, candidatos: candArr,
    confianca: topScore, estado, metodo_match: "keyword_artigo",
    motivo,
  };
}

export type ClassificacaoProgress = {
  total: number;
  done: number;
  classificados: number;
  pendentes: number;
  porAnalisar: number;
};

export async function runClassificacao(orcamentoId: string, onProgress?: (snapshot: ClassificacaoProgress) => void) {
  const { data: u } = await supabase.auth.getUser();
  const { data: run, error: runErr } = await supabase.from("orcamento_classificacao_run").insert({
    orcamento_id: orcamentoId, estado: "em_curso", iniciado_em: new Date().toISOString(), iniciado_por: u.user?.id ?? null,
  }).select("id").single();
  if (runErr) throw runErr;

  const { data: artigos } = await supabase
    .from("orcamento_artigos").select("id, orcamento_id, descricao, unidade, quantidade, ordem")
    .eq("orcamento_id", orcamentoId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: existentes } = await supabase
    .from("classificacao_artigos").select("artigo_origem_id, estado")
    .eq("orcamento_id", orcamentoId);
  const validados = new Set((existentes ?? []).filter((e: any) => e.estado === "validado").map((e: any) => e.artigo_origem_id));

  if ((existentes ?? []).some((e: any) => e.estado !== "validado")) {
    await supabase.from("classificacao_artigos").delete()
      .eq("orcamento_id", orcamentoId)
      .neq("estado", "validado");
  }

  const bib = await loadBib();

  const stats = { total: 0, auto_exato: 0, auto_aprendido: 0, parcial: 0, sem_classificacao: 0 };
  const toInsert: any[] = [];
  const lista = (artigos ?? []).filter((a: any) => !validados.has(a.id));
  stats.total = (artigos ?? []).length;

  const totalArtigos = stats.total;
  const jaValidados = totalArtigos - lista.length;
  const emit = (processados: number, cls: number, pend: number) => {
    if (!onProgress) return;
    onProgress({
      total: totalArtigos,
      done: jaValidados + processados,
      classificados: jaValidados + cls,
      pendentes: pend,
      porAnalisar: lista.length - processados,
    });
  };
  emit(0, 0, 0);

  let i = 0;
  let classificadosRun = 0;
  let pendentesRun = 0;
  for (const a of lista) {
    const r = classifyArtigo(a as any, bib);
    toInsert.push({
      artigo_origem_id: r.artigo_origem_id,
      orcamento_id: r.orcamento_id,
      descricao_original: r.descricao_original,
      unidade_original: r.unidade_original,
      quantidade_original: r.quantidade_original,
      artigo_mestre_id: r.artigo_mestre_id,
      categoria_id: r.categoria_id,
      subespecialidade_id: r.subespecialidade_id,
      especialidade_id: r.especialidade_id,
      confianca: r.confianca,
      estado: r.estado,
      metodo_match: r.metodo_match,
      motivo: r.motivo,
      candidatos: r.candidatos,
    });
    if (r.metodo_match === "exato" && r.estado === "classificado_auto") { stats.auto_exato++; classificadosRun++; }
    else if (r.metodo_match === "aprendido") { stats.auto_aprendido++; classificadosRun++; }
    else if (r.estado === "classificado_auto") { stats.auto_exato++; classificadosRun++; }
    else if (r.estado === "necessita_revisao") { stats.parcial++; pendentesRun++; }
    else { stats.sem_classificacao++; pendentesRun++; }
    i++;
    if (i % 10 === 0 || i === lista.length) emit(i, classificadosRun, pendentesRun);
  }

  for (let k = 0; k < toInsert.length; k += 200) {
    const chunk = toInsert.slice(k, k + 200);
    const { error } = await supabase.from("classificacao_artigos").insert(chunk);
    if (error) throw error;
  }

  await supabase.from("orcamento_classificacao_run").update({
    estado: "concluido", concluido_em: new Date().toISOString(),
    total_artigos: stats.total,
    auto_exato: stats.auto_exato,
    auto_aprendido: stats.auto_aprendido,
    parcial: stats.parcial,
    sem_classificacao: stats.sem_classificacao,
  }).eq("id", run.id);

  // Motor de Relações Construtivas — análise de omissões
  try {
    const { analisarOmissoes } = await import("@/lib/relacoes/analise");
    await analisarOmissoes(orcamentoId);
  } catch (err) {
    console.warn("[classificacao] análise de omissões falhou:", err);
  }

  return { runId: run.id, stats };
}



export async function aprenderClassificacao(descricao: string, artigoMestreId: string) {
  const norm = normalizar(descricao);
  if (!norm) return;
  const { data: u } = await supabase.auth.getUser();
  const { data: existing } = await supabase
    .from("classificacao_memoria").select("id, ocorrencias")
    .eq("descricao_normalizada", norm).maybeSingle();
  if (existing) {
    await supabase.from("classificacao_memoria").update({
      artigo_mestre_id: artigoMestreId,
      ocorrencias: (existing as any).ocorrencias + 1,
      ultimo_user_id: u.user?.id ?? null,
    }).eq("id", (existing as any).id);
  } else {
    await supabase.from("classificacao_memoria").insert({
      descricao_normalizada: norm,
      artigo_mestre_id: artigoMestreId,
      ultimo_user_id: u.user?.id ?? null,
    });
  }
}

export async function registarAprendizagem(args: {
  descricaoOriginal: string;
  especialidadeSugerida: string | null;
  especialidadeFinal: string;
  confiancaSugerida: number | null;
  obraId: string | null;
  acao: "validar" | "corrigir" | "remover";
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user?.id) return;
  await supabase.from("classificacao_aprendizagem").insert({
    user_id: u.user.id,
    descricao_original: args.descricaoOriginal,
    descricao_normalizada: normalizar(args.descricaoOriginal),
    especialidade_sugerida: args.especialidadeSugerida,
    especialidade_final: args.especialidadeFinal,
    confianca_sugerida: args.confiancaSugerida,
    obra_id: args.obraId,
    acao: args.acao,
  });
}
