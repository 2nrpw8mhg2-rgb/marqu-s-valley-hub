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
export const PESOS_CLASSIFICACAO = {
  ESP: 20,
  SUBESP: 30,
  CAT: 40,
  ART: 60,
  NEGATIVA: -80,
  LIMIAR_AUTO: 90,
  LIMIAR_REVER: 70,
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

type Bib = {
  artigos: { id: string; descricao: string; descricao_norm: string; subespecialidade_id: string; categoria_id: string }[];
  artKw: { artigo_id: string; termo: string; termo_norm: string; tipo: "positiva" | "negativa" }[];
  subKw: { subespecialidade_id: string; termo: string; termo_norm: string; tipo: string; peso: number }[];
  espKw: { especialidade_id: string; termo: string; termo_norm: string; tipo: string; peso: number }[];
  subs: Map<string, { id: string; nome: string; especialidade_id: string }>;
  esps: Map<string, { id: string; nome: string }>;
  cats: Map<string, { id: string; nome: string; subespecialidade_id: string }>;
  memoria: Map<string, string>;
};

async function loadBib(): Promise<Bib> {
  const [{ data: arts }, { data: artKw }, { data: subKw }, { data: espKw }, { data: subs }, { data: esps }, { data: cats }, { data: mem }] = await Promise.all([
    supabase.from("biblioteca_artigos").select("id, descricao, subespecialidade_id, categoria_id").eq("ativo", true),
    supabase.from("biblioteca_artigo_keywords").select("artigo_id, termo, tipo"),
    supabase.from("biblioteca_subespecialidade_keywords").select("subespecialidade_id, termo, tipo, peso").eq("ativo", true),
    supabase.from("biblioteca_especialidade_keywords").select("especialidade_id, termo, tipo, peso").eq("ativo", true),
    supabase.from("biblioteca_subespecialidades").select("id, nome, especialidade_id"),
    supabase.from("biblioteca_especialidades").select("id, nome"),
    supabase.from("biblioteca_categorias").select("id, nome, subespecialidade_id"),
    supabase.from("classificacao_memoria").select("descricao_normalizada, artigo_mestre_id"),
  ]);

  return {
    artigos: (arts ?? []).map((a: any) => ({ ...a, descricao_norm: normalizar(a.descricao) })),
    artKw: (artKw ?? []).map((k: any) => ({ ...k, termo_norm: normalizar(k.termo) })),
    subKw: (subKw ?? []).map((k: any) => ({ ...k, termo_norm: normalizar(k.termo), peso: Number(k.peso) || 1 })),
    espKw: (espKw ?? []).map((k: any) => ({ ...k, termo_norm: normalizar(k.termo), peso: Number(k.peso) || 1 })),
    subs: new Map((subs ?? []).map((s: any) => [s.id, s])),
    esps: new Map((esps ?? []).map((e: any) => [e.id, e])),
    cats: new Map((cats ?? []).map((c: any) => [c.id, c])),
    memoria: new Map((mem ?? []).map((m: any) => [m.descricao_normalizada, m.artigo_mestre_id])),
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

function estadoFromScore(score: number): "classificado_auto" | "necessita_revisao" | "sem_classificacao" {
  if (score >= PESOS_CLASSIFICACAO.LIMIAR_AUTO) return "classificado_auto";
  if (score >= PESOS_CLASSIFICACAO.LIMIAR_REVER) return "necessita_revisao";
  return "sem_classificacao";
}

function classifyArtigo(
  artigo: { id: string; orcamento_id: string; descricao: string; unidade: string | null; quantidade: number | null },
  bib: Bib,
): ClassificacaoResultado {
  const norm = normalizar(artigo.descricao);
  const tokens = tokenize(artigo.descricao);
  const tokenSet = new Set(tokens);
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

  // 3) Scoring hierárquico por palavras-chave

  // 3a) Hits por especialidade
  const espHits = new Map<string, KeywordHit[]>();
  const espNeg = new Map<string, KeywordHit[]>();
  for (const k of bib.espKw) {
    if (!termMatches(norm, tokenSet, k.termo_norm)) continue;
    const esp = bib.esps.get(k.especialidade_id);
    const pts = (k.tipo === "negativa" ? PESOS_CLASSIFICACAO.NEGATIVA : PESOS_CLASSIFICACAO.ESP) * k.peso;
    const hit: KeywordHit = {
      termo: k.termo, nivel: "especialidade",
      entidade_id: k.especialidade_id, entidade_nome: esp?.nome ?? "—",
      peso: k.peso, pontos: pts,
    };
    const map = k.tipo === "negativa" ? espNeg : espHits;
    const arr = map.get(k.especialidade_id) ?? [];
    arr.push(hit);
    map.set(k.especialidade_id, arr);
  }

  // 3b) Hits por subespecialidade
  const subHits = new Map<string, KeywordHit[]>();
  const subNeg = new Map<string, KeywordHit[]>();
  for (const k of bib.subKw) {
    if (!termMatches(norm, tokenSet, k.termo_norm)) continue;
    const sub = bib.subs.get(k.subespecialidade_id);
    const pts = (k.tipo === "negativa" ? PESOS_CLASSIFICACAO.NEGATIVA : PESOS_CLASSIFICACAO.SUBESP) * k.peso;
    const hit: KeywordHit = {
      termo: k.termo, nivel: "subespecialidade",
      entidade_id: k.subespecialidade_id, entidade_nome: sub?.nome ?? "—",
      peso: k.peso, pontos: pts,
    };
    const map = k.tipo === "negativa" ? subNeg : subHits;
    const arr = map.get(k.subespecialidade_id) ?? [];
    arr.push(hit);
    map.set(k.subespecialidade_id, arr);
  }

  // 3c) Hits por artigo
  const artHits = new Map<string, KeywordHit[]>();
  const artNeg = new Map<string, KeywordHit[]>();
  for (const k of bib.artKw) {
    if (!termMatches(norm, tokenSet, k.termo_norm)) continue;
    const a = bib.artigos.find((x) => x.id === k.artigo_id);
    if (!a) continue;
    const pts = (k.tipo === "negativa" ? PESOS_CLASSIFICACAO.NEGATIVA : PESOS_CLASSIFICACAO.ART) * 1;
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

  // 3d) Acumula por candidato (artigos com qualquer hit positivo a algum nível)
  const candidatos = new Map<string, { score: number; hits: KeywordHit[]; negs: KeywordHit[] }>();
  const considerArt = (artId: string) => {
    if (candidatos.has(artId)) return;
    const a = bib.artigos.find((x) => x.id === artId);
    if (!a) return;
    const sub = bib.subs.get(a.subespecialidade_id);
    const espId = sub?.especialidade_id ?? null;
    const hits: KeywordHit[] = [];
    const negs: KeywordHit[] = [];
    let score = 0;
    for (const h of artHits.get(artId) ?? []) { hits.push(h); score += h.pontos; }
    for (const h of subHits.get(a.subespecialidade_id) ?? []) { hits.push(h); score += h.pontos; }
    if (espId) for (const h of espHits.get(espId) ?? []) { hits.push(h); score += h.pontos; }
    for (const h of artNeg.get(artId) ?? []) { negs.push(h); score += h.pontos; }
    for (const h of subNeg.get(a.subespecialidade_id) ?? []) { negs.push(h); score += h.pontos; }
    if (espId) for (const h of espNeg.get(espId) ?? []) { negs.push(h); score += h.pontos; }
    if (hits.length > 0) candidatos.set(artId, { score, hits, negs });
  };

  // Artigos com hit direto
  for (const artId of artHits.keys()) considerArt(artId);
  // Artigos cuja subesp teve hit (herdam pontos)
  for (const subId of subHits.keys()) {
    for (const a of bib.artigos) if (a.subespecialidade_id === subId) considerArt(a.id);
  }
  // Artigos cuja esp teve hit (herdam pontos)
  for (const espId of espHits.keys()) {
    for (const [subId, sub] of bib.subs) {
      if (sub.especialidade_id !== espId) continue;
      for (const a of bib.artigos) if (a.subespecialidade_id === subId) considerArt(a.id);
    }
  }

  const ranked = Array.from(candidatos.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (ranked.length === 0) {
    return {
      ...base,
      artigo_mestre_id: null, categoria_id: null, subespecialidade_id: null, especialidade_id: null,
      confianca: 0, estado: "sem_classificacao", metodo_match: "nenhum",
      motivo: "Nenhuma palavra-chave da Biblioteca Mestra encontrada",
    };
  }

  const candArr: Candidato[] = ranked.slice(0, 3).map((r) => {
    const a = bib.artigos.find((x) => x.id === r.id)!;
    const termos = Array.from(new Set(r.hits.map((h) => h.termo)));
    return {
      artigo_mestre_id: r.id,
      descricao: a.descricao,
      score: Math.max(0, Math.min(100, Math.round(r.score))),
      motivo: termos.length
        ? `Encontradas keywords: ${termos.join(", ")}`
        : "Sem keywords positivas",
      keywords_hit: r.hits,
      negativas: r.negs,
    };
  });

  const top = ranked[0];
  const topScore = Math.max(0, Math.min(100, Math.round(top.score)));
  const estado = estadoFromScore(topScore);
  const termosTop = Array.from(new Set(top.hits.map((h) => h.termo)));
  const motivo = termosTop.length
    ? `Classificado por palavras-chave: ${termosTop.join(", ")}`
    : "Sem palavras-chave positivas";

  if (estado === "sem_classificacao") {
    return {
      ...base, candidatos: candArr,
      artigo_mestre_id: null, categoria_id: null, subespecialidade_id: null, especialidade_id: null,
      confianca: topScore, estado, metodo_match: "nenhum",
      motivo: `${motivo} (score ${topScore} abaixo do limiar)`,
    };
  }

  const h = fillHierarchy(bib, top.id);
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
    .from("orcamento_artigos").select("id, orcamento_id, descricao, unidade, quantidade")
    .eq("orcamento_id", orcamentoId);

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
    if (r.metodo_match === "exato") { stats.auto_exato++; classificadosRun++; }
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
