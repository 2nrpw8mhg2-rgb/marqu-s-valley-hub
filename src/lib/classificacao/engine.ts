import { supabase } from "@/integrations/supabase/client";

export type Metodo = "exato" | "aprendido" | "keyword_artigo" | "keyword_subesp" | "keyword_esp" | "manual" | "nenhum";

export type Candidato = { artigo_mestre_id: string; descricao: string; score: number; motivo: string };

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

export function normalizar(t: string | null | undefined): string {
  if (!t) return "";
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(t: string): string[] {
  return normalizar(t).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
}

type Bib = {
  artigos: { id: string; descricao: string; descricao_norm: string; subespecialidade_id: string; categoria_id: string }[];
  artKw: { artigo_id: string; termo: string; tipo: "positiva" | "negativa" }[];
  subKw: { subespecialidade_id: string; termo: string; tipo: string; peso: number }[];
  espKw: { especialidade_id: string; termo: string; tipo: string; peso: number }[];
  subs: Map<string, { id: string; especialidade_id: string }>;
  memoria: Map<string, string>; // descricao_normalizada -> artigo_mestre_id
};

async function loadBib(): Promise<Bib> {
  const [{ data: arts }, { data: artKw }, { data: subKw }, { data: espKw }, { data: subs }, { data: mem }] = await Promise.all([
    supabase.from("biblioteca_artigos").select("id, descricao, subespecialidade_id, categoria_id").eq("ativo", true),
    supabase.from("biblioteca_artigo_keywords").select("artigo_id, termo, tipo"),
    supabase.from("biblioteca_subespecialidade_keywords").select("subespecialidade_id, termo, tipo, peso").eq("ativo", true),
    supabase.from("biblioteca_especialidade_keywords").select("especialidade_id, termo, tipo, peso").eq("ativo", true),
    supabase.from("biblioteca_subespecialidades").select("id, especialidade_id"),
    supabase.from("classificacao_memoria").select("descricao_normalizada, artigo_mestre_id"),
  ]);

  return {
    artigos: (arts ?? []).map((a: any) => ({ ...a, descricao_norm: normalizar(a.descricao) })),
    artKw: (artKw ?? []) as any,
    subKw: (subKw ?? []) as any,
    espKw: (espKw ?? []) as any,
    subs: new Map((subs ?? []).map((s: any) => [s.id, s])),
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

function classifyArtigo(
  artigo: { id: string; orcamento_id: string; descricao: string; unidade: string | null; quantidade: number | null },
  bib: Bib,
): ClassificacaoResultado {
  const norm = normalizar(artigo.descricao);
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

  // 3) Score por keywords sobre artigos
  const tokens = tokenize(artigo.descricao);
  const tokenSet = new Set(tokens);
  if (tokens.length > 0) {
    const scores = new Map<string, { score: number; hits: string[]; neg: boolean }>();

    // Match por art_kw
    for (const k of bib.artKw) {
      const termoNorm = normalizar(k.termo);
      const hit = tokens.includes(termoNorm) || norm.includes(termoNorm);
      if (!hit) continue;
      const cur = scores.get(k.artigo_id) ?? { score: 0, hits: [], neg: false };
      if (k.tipo === "negativa") cur.neg = true;
      else { cur.score += 30; cur.hits.push(k.termo); }
      scores.set(k.artigo_id, cur);
    }

    // Boost por descricao_norm semelhança (overlap de tokens)
    for (const a of bib.artigos) {
      const artToks = tokenize(a.descricao);
      let overlap = 0;
      for (const t of artToks) if (tokenSet.has(t)) overlap++;
      if (overlap === 0) continue;
      const ratio = overlap / Math.max(artToks.length, 1);
      const boost = Math.round(ratio * 70);
      const cur = scores.get(a.id) ?? { score: 0, hits: [], neg: false };
      cur.score += boost;
      scores.set(a.id, cur);
    }

    const ranked = Array.from(scores.entries())
      .filter(([, v]) => !v.neg && v.score > 0)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.score - a.score);

    if (ranked.length > 0) {
      const top = ranked[0];
      const topArt = bib.artigos.find((a) => a.id === top.id)!;
      const candidatos: Candidato[] = ranked.slice(0, 3).map((r) => {
        const a = bib.artigos.find((x) => x.id === r.id)!;
        return {
          artigo_mestre_id: r.id, descricao: a.descricao, score: Math.min(100, r.score),
          motivo: r.hits.length ? `Palavras-chave: ${r.hits.join(", ")}` : "Sobreposição de termos da descrição",
        };
      });
      if (top.score >= 70) {
        const h = fillHierarchy(bib, top.id);
        return {
          ...base, ...h, candidatos,
          confianca: 50, estado: "necessita_revisao", metodo_match: "keyword_artigo",
          motivo: `Match parcial com "${topArt.descricao}" (score ${Math.min(100, top.score)})${top.hits.length ? ` · keywords: ${top.hits.join(", ")}` : ""}`,
        };
      }
      return {
        ...base, candidatos,
        artigo_mestre_id: null, categoria_id: null, subespecialidade_id: null, especialidade_id: null,
        confianca: 0, estado: "sem_classificacao", metodo_match: "nenhum",
        motivo: `Sem correspondência segura. ${candidatos.length} candidato(s) com score baixo.`,
      };
    }
  }

  // 4) Nada
  return {
    ...base,
    artigo_mestre_id: null, categoria_id: null, subespecialidade_id: null, especialidade_id: null,
    confianca: 0, estado: "sem_classificacao", metodo_match: "nenhum",
    motivo: "Nenhuma correspondência encontrada na Biblioteca Mestra",
  };
}

export async function runClassificacao(orcamentoId: string, onProgress?: (done: number, total: number) => void) {
  // Cria run
  const { data: u } = await supabase.auth.getUser();
  const { data: run, error: runErr } = await supabase.from("orcamento_classificacao_run").insert({
    orcamento_id: orcamentoId, estado: "em_curso", iniciado_em: new Date().toISOString(), iniciado_por: u.user?.id ?? null,
  }).select("id").single();
  if (runErr) throw runErr;

  // Lê artigos do orçamento
  const { data: artigos } = await supabase
    .from("orcamento_artigos").select("id, orcamento_id, descricao, unidade, quantidade")
    .eq("orcamento_id", orcamentoId);

  // Preserva linhas validadas existentes
  const { data: existentes } = await supabase
    .from("classificacao_artigos").select("artigo_origem_id, estado")
    .eq("orcamento_id", orcamentoId);
  const validados = new Set((existentes ?? []).filter((e: any) => e.estado === "validado").map((e: any) => e.artigo_origem_id));

  // Apaga não-validados para reclassificar
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

  let i = 0;
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
    if (r.metodo_match === "exato") stats.auto_exato++;
    else if (r.metodo_match === "aprendido") stats.auto_aprendido++;
    else if (r.estado === "necessita_revisao") stats.parcial++;
    else stats.sem_classificacao++;
    i++;
    if (onProgress && i % 25 === 0) onProgress(i, lista.length);
  }

  // Batch insert
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
