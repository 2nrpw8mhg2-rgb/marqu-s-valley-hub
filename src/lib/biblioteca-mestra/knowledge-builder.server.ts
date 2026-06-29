import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Sb = SupabaseClient<Database>;

const TIPO_LIMIT = 8;
const MQ_TOP = 40;
const CANDIDATOS_TOP = 60;
const ORC_FETCH_PER_TOKEN = 80;
const VIZINHOS_LIMIT = 15;
const VIZINHO_EXEMPLOS = 5;

type FonteOrigem = "historico" | "candidatos" | "vizinhos" | "inferido";

type GeneratedTermo = {
  termo: string;
  peso: number;
  confianca: number;
  justificacao?: string;
  fonte?: FonteOrigem;
};
type Generated = {
  palavras_chave: GeneratedTermo[];
  sinonimos: GeneratedTermo[];
  expressoes: GeneratedTermo[];
  materiais: GeneratedTermo[];
  termos_negativos: GeneratedTermo[];
};

const TIPO_MAP = {
  palavras_chave: { tipo: "palavra_chave", pesoDefault: 30, sign: 1 },
  sinonimos: { tipo: "sinonimo", pesoDefault: 10, sign: 1 },
  expressoes: { tipo: "expressao", pesoDefault: 40, sign: 1 },
  materiais: { tipo: "material", pesoDefault: 8, sign: 1 },
  termos_negativos: { tipo: "termo_negativo", pesoDefault: -30, sign: -1 },
} as const;

const FONTE_TO_ORIGEM: Record<FonteOrigem, "mapas_quantidades" | "orcamentos_brutos" | "artigos_vizinhos" | "ia"> = {
  historico: "mapas_quantidades",
  candidatos: "orcamentos_brutos",
  vizinhos: "artigos_vizinhos",
  inferido: "ia",
};

const STOPWORDS = new Set([
  "para", "com", "sem", "por", "dos", "das", "que", "uma", "uns", "umas",
  "este", "esta", "estes", "estas", "pelo", "pela", "nos", "nas", "como",
  "fornecimento", "aplicacao", "execucao", "incluindo", "tudo", "necessario",
  "respetivos", "respetivas", "incluindo", "trabalhos",
]);

function admin(): Sb {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

export type Scope =
  | { tipo: "especialidade"; especialidadeId: string }
  | { tipo: "subespecialidade"; subespecialidadeId: string }
  | { tipo: "artigo"; artigoId: string };

export type Modo = "manter" | "novos" | "regenerar";

async function listarArtigosDoScope(sb: Sb, scope: Scope): Promise<string[]> {
  if (scope.tipo === "artigo") return [scope.artigoId];
  if (scope.tipo === "subespecialidade") {
    const { data, error } = await sb
      .from("biblioteca_artigos")
      .select("id")
      .eq("subespecialidade_id", scope.subespecialidadeId)
      .eq("ativo", true);
    if (error) throw error;
    return (data ?? []).map((r) => r.id);
  }
  const { data: subs, error: subsErr } = await sb
    .from("biblioteca_subespecialidades")
    .select("id")
    .eq("especialidade_id", scope.especialidadeId);
  if (subsErr) throw subsErr;
  const subIds = (subs ?? []).map((s) => s.id);
  if (!subIds.length) return [];
  const { data, error } = await sb
    .from("biblioteca_artigos")
    .select("id")
    .in("subespecialidade_id", subIds)
    .eq("ativo", true);
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

export async function previewScope(scope: Scope) {
  const sb = admin();
  const ids = await listarArtigosDoScope(sb, scope);
  if (!ids.length) return { artigos: 0, classificacoesReais: 0, artigosSemDados: 0 };

  const { data: cls } = await sb
    .from("classificacao_artigos")
    .select("artigo_mestre_id")
    .in("artigo_mestre_id", ids)
    .in("estado", ["validado", "classificado_auto"]);

  const comDados = new Set((cls ?? []).map((r) => r.artigo_mestre_id as string));
  return {
    artigos: ids.length,
    classificacoesReais: cls?.length ?? 0,
    artigosSemDados: ids.length - comDados.size,
  };
}

type HistoricoEntry = { descricao: string; ocorrencias: number; validado: boolean };
type CandidatoEntry = { descricao: string; score: number };
type VizinhoEntry = { codigo: string; descricao: string; exemplos: string[] };

type Fontes = {
  artigo: { codigo: string; descricao: string; observacoes: string };
  contexto: { especialidade: string; subespecialidade: string; categoria: string };
  historico: HistoricoEntry[];
  totalHistorico: number;
  historicoValidados: number;
  historicoAuto: number;
  candidatos: CandidatoEntry[];
  totalCandidatos: number;
  vizinhos: VizinhoEntry[];
  vizinhosArtigos: number;
  existentes: { tipo: string; termo: string }[];
  semHistorico: boolean;
};

async function recolherFontes(sb: Sb, artigoId: string): Promise<Fontes> {
  const { data: a } = await sb
    .from("biblioteca_artigos")
    .select(
      "id, codigo, descricao, observacoes, subespecialidade_id, categoria_id, " +
        "biblioteca_subespecialidades(nome, especialidade_id, biblioteca_especialidades(nome)), " +
        "biblioteca_categorias(nome)"
    )
    .eq("id", artigoId)
    .single();

  const aAny = a as any;
  const subRel = aAny?.biblioteca_subespecialidades;
  const especialidadeNome = subRel?.biblioteca_especialidades?.nome ?? "";
  const subespecialidadeNome = subRel?.nome ?? "";
  const categoriaNome = aAny?.biblioteca_categorias?.nome ?? "";
  const subespecialidadeId = aAny?.subespecialidade_id as string | null;
  const artigoDescricao = (aAny?.descricao ?? "") as string;

  // ===== FONTE A — histórico classificado =====
  const { data: mqRaw } = await sb
    .from("classificacao_artigos")
    .select("descricao_original, estado, artigo_origem_id")
    .eq("artigo_mestre_id", artigoId)
    .in("estado", ["validado", "classificado_auto"])
    .limit(500);

  const freq = new Map<string, { count: number; validado: boolean }>();
  let historicoValidados = 0;
  let historicoAuto = 0;
  const orcArtigosJaClassificados = new Set<string>();
  for (const r of mqRaw ?? []) {
    if (r.artigo_origem_id) orcArtigosJaClassificados.add(r.artigo_origem_id as string);
    const d = (r.descricao_original ?? "").trim();
    if (!d) continue;
    const key = d.toLowerCase().replace(/\s+/g, " ").slice(0, 220);
    const isVal = (r.estado as string) === "validado";
    if (isVal) historicoValidados++;
    else historicoAuto++;
    const cur = freq.get(key);
    if (cur) {
      cur.count++;
      if (isVal) cur.validado = true;
    } else {
      freq.set(key, { count: 1, validado: isVal });
    }
  }
  const historico: HistoricoEntry[] = [...freq.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, MQ_TOP)
    .map(([descricao, v]) => ({ descricao, ocorrencias: v.count, validado: v.validado }));

  // ===== FONTE B — orçamentos brutos por similaridade textual =====
  const existentesKw = await sb
    .from("biblioteca_artigo_conhecimento")
    .select("tipo, termo")
    .eq("artigo_mestre_id", artigoId);
  const existentes = existentesKw.data ?? [];

  const tokensSet = new Set<string>();
  tokenize(artigoDescricao).forEach((t) => tokensSet.add(t));
  for (const e of existentes) {
    if (e.tipo === "palavra_chave" || e.tipo === "expressao") {
      tokenize(e.termo as string).forEach((t) => tokensSet.add(t));
    }
  }
  tokenize(subespecialidadeNome).forEach((t) => tokensSet.add(t));
  tokenize(categoriaNome).forEach((t) => tokensSet.add(t));
  const tokens = [...tokensSet].slice(0, 6);

  const brutoMap = new Map<string, { hits: number; orig: string }>();
  if (tokens.length) {
    for (const tok of tokens) {
      const { data: rows } = await sb
        .from("orcamento_artigos")
        .select("id, descricao")
        .ilike("descricao", `%${tok}%`)
        .limit(ORC_FETCH_PER_TOKEN);
      for (const r of rows ?? []) {
        if (orcArtigosJaClassificados.has(r.id as string)) continue;
        const desc = (r.descricao ?? "").trim();
        if (!desc) continue;
        const key = normalize(desc).slice(0, 220);
        const cur = brutoMap.get(key);
        if (cur) cur.hits++;
        else brutoMap.set(key, { hits: 1, orig: desc.slice(0, 220) });
      }
    }
  }
  const maxHits = Math.max(1, tokens.length);
  const candidatos: CandidatoEntry[] = [...brutoMap.values()]
    .map((v) => ({ descricao: v.orig, score: v.hits / maxHits }))
    .filter((c) => c.score >= 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATOS_TOP);

  // ===== FONTE C — artigos vizinhos =====
  const vizinhos: VizinhoEntry[] = [];
  if (subespecialidadeId) {
    const { data: vizArts } = await sb
      .from("biblioteca_artigos")
      .select("id, codigo, descricao")
      .eq("subespecialidade_id", subespecialidadeId)
      .eq("ativo", true)
      .neq("id", artigoId)
      .limit(VIZINHOS_LIMIT);
    for (const v of vizArts ?? []) {
      const { data: exs } = await sb
        .from("classificacao_artigos")
        .select("descricao_original")
        .eq("artigo_mestre_id", v.id as string)
        .in("estado", ["validado", "classificado_auto"])
        .limit(VIZINHO_EXEMPLOS);
      const exemplos = (exs ?? [])
        .map((e) => (e.descricao_original ?? "").trim())
        .filter(Boolean)
        .slice(0, VIZINHO_EXEMPLOS);
      if (exemplos.length || (v.descricao as string)) {
        vizinhos.push({
          codigo: (v.codigo as string) ?? "",
          descricao: (v.descricao as string) ?? "",
          exemplos,
        });
      }
    }
  }

  return {
    artigo: {
      codigo: aAny?.codigo ?? "",
      descricao: artigoDescricao,
      observacoes: aAny?.observacoes ?? "",
    },
    contexto: { especialidade: especialidadeNome, subespecialidade: subespecialidadeNome, categoria: categoriaNome },
    historico,
    totalHistorico: mqRaw?.length ?? 0,
    historicoValidados,
    historicoAuto,
    candidatos,
    totalCandidatos: brutoMap.size,
    vizinhos,
    vizinhosArtigos: vizinhos.length,
    existentes,
    semHistorico: (mqRaw?.length ?? 0) === 0,
  };
}

function buildPrompt(fontes: Fontes, modo: Modo) {
  const { artigo, contexto, historico, candidatos, vizinhos, existentes, semHistorico } = fontes;

  const linhasA = historico.length
    ? historico
        .map((m) => `  (${m.ocorrencias}x)${m.validado ? " [validado]" : ""} ${m.descricao}`)
        .join("\n")
    : "  (nenhuma)";

  const linhasB = candidatos.length
    ? candidatos.map((c) => `  (sim ${c.score.toFixed(2)}) ${c.descricao}`).join("\n")
    : "  (nenhuma)";

  const linhasC = vizinhos.length
    ? vizinhos
        .map((v) => {
          const ex = v.exemplos.length ? ` — exs: ${v.exemplos.slice(0, 2).join(" | ").slice(0, 180)}` : "";
          return `  • ${v.codigo} ${v.descricao}${ex}`;
        })
        .join("\n")
    : "  (nenhum)";

  const existentesTxt =
    modo === "novos" && existentes.length
      ? `\nTermos já existentes (NÃO repetir):\n${existentes
          .slice(0, 200)
          .map((e) => `- [${e.tipo}] ${e.termo}`)
          .join("\n")}`
      : "";

  const avisoSemHist = semHistorico
    ? "\n⚠ ATENÇÃO: este artigo NÃO tem histórico validado. Sê conservador: confiança ≤ 65, " +
      "prioriza FONTE B e usa FONTE C para discriminar termos negativos."
    : "";

  return `És um engenheiro de conhecimento técnico de construção civil em Portugal.
Constrói a base de conhecimento de UM artigo da Biblioteca Mestra, em português europeu,
para um motor de classificação de mapas de quantidades.

ARTIGO MESTRE
- Código: ${artigo.codigo}
- Descrição: ${artigo.descricao}
- Observações: ${artigo.observacoes || "—"}

CONTEXTO ESTRUTURAL
- Especialidade: ${contexto.especialidade}
- Subespecialidade: ${contexto.subespecialidade}
- Categoria: ${contexto.categoria}

═════ FONTES ═════
FONTE A — Histórico classificado para ESTE artigo (peso ALTO, ${historico.length} entradas, ${fontes.totalHistorico} ocorrências totais):
${linhasA}

FONTE B — Descrições BRUTAS candidatas (peso MÉDIO, top ${candidatos.length} de ${fontes.totalCandidatos} encontradas em orçamentos importados ainda não classificados):
${linhasB}

FONTE C — Artigos VIZINHOS na mesma subespecialidade (peso BAIXO, usar p/ termos negativos e diferenciação):
${linhasC}
${existentesTxt}${avisoSemHist}

GERA até ${TIPO_LIMIT} elementos por tipo, em JSON estrito:
{
  "palavras_chave": [{"termo":"...","peso":<5..50>,"confianca":<0..100>,"fonte":"historico|candidatos|vizinhos|inferido","justificacao":"..."}],
  "sinonimos":      [{"termo":"...","peso":<5..30>,"confianca":<0..100>,"fonte":"...","justificacao":"..."}],
  "expressoes":     [{"termo":"...","peso":<10..60>,"confianca":<0..100>,"fonte":"...","justificacao":"..."}],
  "materiais":      [{"termo":"...","peso":<3..20>,"confianca":<0..100>,"fonte":"...","justificacao":"..."}],
  "termos_negativos":[{"termo":"...","peso":<5..40>,"confianca":<0..100>,"fonte":"...","justificacao":"..."}]
}

REGRAS DE CONFIANÇA POR FONTE
- fonte="historico" → 80-95 (95 se aparecer em descrições [validado])
- fonte="candidatos" → 55-80 (proporcional à similaridade observada)
- fonte="vizinhos" → 40-60 (usar sobretudo p/ termos_negativos)
- fonte="inferido" → 50-70 (terminologia técnica geral relacionada)

REGRAS
- Termos técnicos, minúsculas, sem pontuação supérflua, PT-PT.
- Expressões são frases curtas (2-6 palavras) típicas de MQ, ex: "fornecimento e aplicação de".
- Termos negativos: palavras associadas a OUTROS artigos (ver FONTE C) que devem reduzir confiança neste.
- "fonte" é OBRIGATÓRIO em cada termo.
- justificacao = UMA frase curta (máx. 120 caracteres).
- NÃO inventes materiais sem evidência nas fontes.
- Devolve APENAS o JSON, sem comentários, sem markdown.`;
}

async function callAI(prompt: string): Promise<Generated> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY em falta");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Devolve apenas JSON válido." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`IA ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : {};
  }
  const validFontes: FonteOrigem[] = ["historico", "candidatos", "vizinhos", "inferido"];
  const norm = (arr: any): GeneratedTermo[] =>
    Array.isArray(arr)
      ? arr
          .map((x) => {
            const fonteRaw = String(x?.fonte ?? "inferido").toLowerCase();
            const fonte: FonteOrigem = (validFontes as string[]).includes(fonteRaw)
              ? (fonteRaw as FonteOrigem)
              : "inferido";
            return {
              termo: String(x?.termo ?? "").trim(),
              peso: Math.round(Number(x?.peso) || 0),
              confianca: Math.max(0, Math.min(100, Math.round(Number(x?.confianca) || 60))),
              justificacao: x?.justificacao ? String(x.justificacao).trim().slice(0, 200) : undefined,
              fonte,
            };
          })
          .filter((x) => x.termo.length > 0)
          .slice(0, TIPO_LIMIT)
      : [];
  return {
    palavras_chave: norm(parsed.palavras_chave),
    sinonimos: norm(parsed.sinonimos),
    expressoes: norm(parsed.expressoes),
    materiais: norm(parsed.materiais),
    termos_negativos: norm(parsed.termos_negativos),
  };
}

type PersistResult = { inseridos: number; perTipo: Record<string, number> };

function calcOcorrenciasEExemplos(
  termo: string,
  historico: HistoricoEntry[],
  candidatos: CandidatoEntry[]
): { ocorrencias: number; exemplos: string[] } {
  const t = normalize(termo);
  if (!t) return { ocorrencias: 0, exemplos: [] };
  let oc = 0;
  const ex: string[] = [];
  for (const h of historico) {
    if (normalize(h.descricao).includes(t)) {
      oc += h.ocorrencias;
      if (ex.length < 3) ex.push(`[hist] ${h.descricao.slice(0, 160)}`);
    }
  }
  for (const c of candidatos) {
    if (ex.length >= 3) break;
    if (normalize(c.descricao).includes(t)) {
      ex.push(`[cand] ${c.descricao.slice(0, 160)}`);
    }
  }
  return { ocorrencias: oc, exemplos: ex };
}

async function persistir(
  sb: Sb,
  artigoId: string,
  gen: Generated,
  modo: Modo,
  fontes: Fontes
): Promise<PersistResult> {
  if (modo === "regenerar") {
    await sb
      .from("biblioteca_artigo_conhecimento")
      .delete()
      .eq("artigo_mestre_id", artigoId)
      .in("origem", ["ia", "mapas_quantidades", "orcamentos_brutos", "artigos_vizinhos"]);
  }

  const { data: existentes } = await sb
    .from("biblioteca_artigo_conhecimento")
    .select("tipo, termo")
    .eq("artigo_mestre_id", artigoId);
  const setExist = new Set(
    (existentes ?? []).map((e) => `${e.tipo}::${e.termo.toLowerCase()}`)
  );

  const rows: any[] = [];
  const perTipo: Record<string, number> = {
    palavra_chave: 0, sinonimo: 0, expressao: 0, material: 0, termo_negativo: 0,
  };

  for (const k of Object.keys(TIPO_MAP) as (keyof typeof TIPO_MAP)[]) {
    const meta = TIPO_MAP[k];
    for (const t of gen[k]) {
      const key = `${meta.tipo}::${t.termo.toLowerCase()}`;
      if (setExist.has(key)) continue;
      setExist.add(key);
      const peso = Number.isFinite(t.peso) && t.peso !== 0 ? t.peso : meta.pesoDefault;
      const pesoFinal = meta.sign < 0 ? -Math.abs(peso) : Math.abs(peso);
      const { ocorrencias, exemplos } = calcOcorrenciasEExemplos(t.termo, fontes.historico, fontes.candidatos);
      // Prefer reported fonte; auto-promote to historico if termo really aparece no histórico.
      let fonte: FonteOrigem = t.fonte ?? "inferido";
      if (ocorrencias > 0 && fonte === "inferido") fonte = "historico";
      const origem = FONTE_TO_ORIGEM[fonte];
      rows.push({
        artigo_mestre_id: artigoId,
        tipo: meta.tipo,
        termo: t.termo,
        peso: pesoFinal,
        confianca: t.confianca,
        origem,
        ativo: true,
        ocorrencias,
        justificacao: t.justificacao ?? null,
        exemplos,
      });
      perTipo[meta.tipo]++;
    }
  }

  if (rows.length) {
    const { error } = await sb.from("biblioteca_artigo_conhecimento").insert(rows);
    if (error) throw error;
  }
  return { inseridos: rows.length, perTipo };
}

async function appendLog(sb: Sb, runId: string, msg: string) {
  const { data } = await sb
    .from("biblioteca_knowledge_run")
    .select("log")
    .eq("id", runId)
    .single();
  const log: any[] = ((data?.log as any) ?? []).slice(-49);
  log.push({ ts: new Date().toISOString(), msg });
  await sb.from("biblioteca_knowledge_run").update({ log }).eq("id", runId);
}

export async function processRun(runId: string) {
  const sb = admin();
  try {
    const { data: run, error } = await sb
      .from("biblioteca_knowledge_run")
      .select("*")
      .eq("id", runId)
      .single();
    if (error || !run) throw error ?? new Error("Run não encontrada");

    const scope: Scope =
      run.scope_tipo === "especialidade"
        ? { tipo: "especialidade", especialidadeId: (run.scope_ids as any).especialidadeId }
        : run.scope_tipo === "subespecialidade"
        ? { tipo: "subespecialidade", subespecialidadeId: (run.scope_ids as any).subespecialidadeId }
        : { tipo: "artigo", artigoId: (run.scope_ids as any).artigoId };

    const ids = await listarArtigosDoScope(sb, scope);

    await sb
      .from("biblioteca_knowledge_run")
      .update({ estado: "em_curso", total_artigos: ids.length })
      .eq("id", runId);
    await appendLog(sb, runId, `Início: ${ids.length} artigos no âmbito`);

    const counts: Record<string, number> = {
      palavra_chave: 0, sinonimo: 0, expressao: 0, material: 0, termo_negativo: 0,
    };
    const fontesAgg = {
      historico_validado: 0,
      historico_auto: 0,
      candidatos_brutos: 0,
      vizinhos_analisados: 0,
    };
    let processados = 0;
    let saltados = 0;
    let falhados = 0;
    let ultimaFontes: Fontes | null = null;

    for (const artigoId of ids) {
      const { data: chk } = await sb
        .from("biblioteca_knowledge_run")
        .select("cancelar")
        .eq("id", runId)
        .single();
      if (chk?.cancelar) {
        await appendLog(sb, runId, "Cancelado pelo utilizador");
        await sb
          .from("biblioteca_knowledge_run")
          .update({ estado: "cancelado", concluido_em: new Date().toISOString() })
          .eq("id", runId);
        return;
      }

      try {
        if (run.modo === "manter") {
          const { count } = await sb
            .from("biblioteca_artigo_conhecimento")
            .select("id", { count: "exact", head: true })
            .eq("artigo_mestre_id", artigoId);
          if ((count ?? 0) > 0) {
            saltados++;
            processados++;
            await sb
              .from("biblioteca_knowledge_run")
              .update({ processados, saltados })
              .eq("id", runId);
            continue;
          }
        }

        const fontes = await recolherFontes(sb, artigoId);
        ultimaFontes = fontes;
        fontesAgg.historico_validado += fontes.historicoValidados;
        fontesAgg.historico_auto += fontes.historicoAuto;
        fontesAgg.candidatos_brutos += fontes.totalCandidatos;
        fontesAgg.vizinhos_analisados += fontes.vizinhosArtigos;

        const prompt = buildPrompt(fontes, run.modo as Modo);
        const gen = await callAI(prompt);
        const res = await persistir(sb, artigoId, gen, run.modo as Modo, fontes);

        for (const k of Object.keys(res.perTipo)) counts[k] = (counts[k] ?? 0) + res.perTipo[k];
        processados++;
        await sb
          .from("biblioteca_knowledge_run")
          .update({
            processados,
            counts,
            ultimo_artigo: `${fontes.artigo.codigo} — ${fontes.artigo.descricao}`.slice(0, 200),
          })
          .eq("id", runId);
        await appendLog(
          sb,
          runId,
          `✓ ${fontes.artigo.codigo} — ${res.inseridos} termos · A:${fontes.totalHistorico} B:${fontes.totalCandidatos} C:${fontes.vizinhosArtigos}`
        );
      } catch (e: any) {
        falhados++;
        processados++;
        await sb
          .from("biblioteca_knowledge_run")
          .update({ processados, falhados })
          .eq("id", runId);
        await appendLog(sb, runId, `✗ ${artigoId}: ${String(e?.message ?? e).slice(0, 200)}`);
      }
    }

    let resumo: any = { fontes: fontesAgg, counts };
    if (scope.tipo === "artigo") {
      const { data: rows } = await sb
        .from("biblioteca_artigo_conhecimento")
        .select("tipo, confianca, peso, origem")
        .eq("artigo_mestre_id", scope.artigoId)
        .eq("ativo", true);
      const perTipo: Record<string, number> = {
        palavra_chave: 0, sinonimo: 0, expressao: 0, material: 0, termo_negativo: 0,
      };
      const perOrigem: Record<string, number> = {};
      let somaPeso = 0;
      let somaPesoConf = 0;
      for (const r of rows ?? []) {
        perTipo[r.tipo as string] = (perTipo[r.tipo as string] ?? 0) + 1;
        perOrigem[r.origem as string] = (perOrigem[r.origem as string] ?? 0) + 1;
        const p = Math.abs(Number(r.peso) || 0);
        somaPeso += p;
        somaPesoConf += p * (Number(r.confianca) || 0);
      }
      resumo = {
        perTipo,
        perOrigem,
        total: (rows ?? []).length,
        confiancaGlobal: somaPeso > 0 ? Math.round(somaPesoConf / somaPeso) : 0,
        counts,
        fontes: fontesAgg,
        semHistorico: ultimaFontes?.semHistorico ?? false,
      };
    }

    await sb
      .from("biblioteca_knowledge_run")
      .update({ estado: "concluido", concluido_em: new Date().toISOString(), resumo })
      .eq("id", runId);
    await appendLog(sb, runId, `Concluído: ${processados} processados, ${saltados} saltados, ${falhados} falhados`);
  } catch (e: any) {
    await sb
      .from("biblioteca_knowledge_run")
      .update({
        estado: "erro",
        erro_msg: String(e?.message ?? e).slice(0, 500),
        concluido_em: new Date().toISOString(),
      })
      .eq("id", runId);
  }
}
