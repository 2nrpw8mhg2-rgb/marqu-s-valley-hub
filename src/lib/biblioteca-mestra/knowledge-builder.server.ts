import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Sb = SupabaseClient<Database>;

const TIPO_LIMIT = 8;
const MQ_TOP = 40;

type GeneratedTermo = { termo: string; peso: number; confianca: number };
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

function admin(): Sb {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
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
  // especialidade
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

async function recolherFontes(sb: Sb, artigoId: string) {
  const { data: a } = await sb
    .from("biblioteca_artigos")
    .select(
      "id, codigo, descricao, observacoes, subespecialidade_id, categoria_id, " +
        "biblioteca_subespecialidades(nome, especialidade_id, biblioteca_especialidades(nome)), " +
        "biblioteca_categorias(nome)"
    )
    .eq("id", artigoId)
    .single();

  const { data: mqRaw } = await sb
    .from("classificacao_artigos")
    .select("descricao_original")
    .eq("artigo_mestre_id", artigoId)
    .in("estado", ["validado", "classificado_auto"])
    .limit(500);

  const freq = new Map<string, number>();
  for (const r of mqRaw ?? []) {
    const d = (r.descricao_original ?? "").trim();
    if (!d) continue;
    const key = d.toLowerCase().replace(/\s+/g, " ").slice(0, 220);
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const mqTop = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MQ_TOP)
    .map(([descricao, ocorrencias]) => ({ descricao, ocorrencias }));

  const subRel = (a as any)?.biblioteca_subespecialidades;
  const especialidadeNome = subRel?.biblioteca_especialidades?.nome ?? "";
  const subespecialidadeNome = subRel?.nome ?? "";
  const categoriaNome = (a as any)?.biblioteca_categorias?.nome ?? "";

  const { data: existentes } = await sb
    .from("biblioteca_artigo_conhecimento")
    .select("tipo, termo")
    .eq("artigo_mestre_id", artigoId);

  return {
    artigo: {
      codigo: a?.codigo ?? "",
      descricao: a?.descricao ?? "",
      observacoes: a?.observacoes ?? "",
    },
    contexto: { especialidade: especialidadeNome, subespecialidade: subespecialidadeNome, categoria: categoriaNome },
    mqTop,
    totalMq: mqRaw?.length ?? 0,
    existentes: existentes ?? [],
  };
}

function buildPrompt(fontes: Awaited<ReturnType<typeof recolherFontes>>, modo: Modo) {
  const { artigo, contexto, mqTop, totalMq, existentes } = fontes;
  const linhasMq = mqTop.length
    ? mqTop.map((m) => `  (${m.ocorrencias}x) ${m.descricao}`).join("\n")
    : "  (nenhuma)";

  const existentesTxt =
    modo === "novos" && existentes.length
      ? `\nTermos já existentes (NÃO repetir):\n${existentes
          .slice(0, 200)
          .map((e) => `- [${e.tipo}] ${e.termo}`)
          .join("\n")}`
      : "";

  return `És um engenheiro de conhecimento técnico de construção civil em Portugal.
A tua tarefa é construir a base de conhecimento de UM artigo da Biblioteca Mestra, em português europeu, para ser usada por um motor de classificação de mapas de quantidades.

ARTIGO MESTRE
- Código: ${artigo.codigo}
- Descrição: ${artigo.descricao}
- Observações: ${artigo.observacoes || "—"}

CONTEXTO ESTRUTURAL
- Especialidade: ${contexto.especialidade}
- Subespecialidade: ${contexto.subespecialidade}
- Categoria: ${contexto.categoria}

DESCRIÇÕES REAIS DE MAPAS DE QUANTIDADES JÁ CLASSIFICADAS PARA ESTE ARTIGO (${totalMq} registos, top ${mqTop.length}):
${linhasMq}
${existentesTxt}

GERA até ${TIPO_LIMIT} elementos por tipo, em JSON estrito, com esta forma exacta:
{
  "palavras_chave": [{"termo":"...","peso":<5..50>,"confianca":<0..100>}],
  "sinonimos":      [{"termo":"...","peso":<5..30>,"confianca":<0..100>}],
  "expressoes":     [{"termo":"...","peso":<10..60>,"confianca":<0..100>}],
  "materiais":      [{"termo":"...","peso":<3..20>,"confianca":<0..100>}],
  "termos_negativos":[{"termo":"...","peso":<5..40>,"confianca":<0..100>}]
}

REGRAS
- Os termos devem ser técnicos, em minúsculas, sem pontuação supérflua, em PT-PT.
- Expressões são frases curtas (2-6 palavras) típicas de MQ, ex: "fornecimento e aplicação de".
- Termos negativos são palavras associadas a OUTROS artigos que devem reduzir confiança neste; usa o contexto estrutural.
- Se houver poucas descrições reais, sê conservador (menos termos, confiança ≤ 70).
- A confiança deve refletir frequência e consistência observada.
- NÃO inventes materiais que não façam sentido para este artigo.
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
  const norm = (arr: any): GeneratedTermo[] =>
    Array.isArray(arr)
      ? arr
          .map((x) => ({
            termo: String(x?.termo ?? "").trim(),
            peso: Math.round(Number(x?.peso) || 0),
            confianca: Math.max(0, Math.min(100, Math.round(Number(x?.confianca) || 60))),
          }))
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

async function persistir(
  sb: Sb,
  artigoId: string,
  gen: Generated,
  modo: Modo
): Promise<PersistResult> {
  if (modo === "regenerar") {
    await sb
      .from("biblioteca_artigo_conhecimento")
      .delete()
      .eq("artigo_mestre_id", artigoId)
      .eq("origem", "ia");
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
    palavra_chave: 0,
    sinonimo: 0,
    expressao: 0,
    material: 0,
    termo_negativo: 0,
  };

  for (const k of Object.keys(TIPO_MAP) as (keyof typeof TIPO_MAP)[]) {
    const meta = TIPO_MAP[k];
    for (const t of gen[k]) {
      const key = `${meta.tipo}::${t.termo.toLowerCase()}`;
      if (setExist.has(key)) continue;
      setExist.add(key);
      const peso = Number.isFinite(t.peso) && t.peso !== 0 ? t.peso : meta.pesoDefault;
      const pesoFinal = meta.sign < 0 ? -Math.abs(peso) : Math.abs(peso);
      rows.push({
        artigo_mestre_id: artigoId,
        tipo: meta.tipo,
        termo: t.termo,
        peso: pesoFinal,
        confianca: t.confianca,
        origem: "ia",
        ativo: true,
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
      palavra_chave: 0,
      sinonimo: 0,
      expressao: 0,
      material: 0,
      termo_negativo: 0,
    };
    let processados = 0;
    let saltados = 0;
    let falhados = 0;

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
        const prompt = buildPrompt(fontes, run.modo as Modo);
        const gen = await callAI(prompt);
        const res = await persistir(sb, artigoId, gen, run.modo as Modo);

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
          `✓ ${fontes.artigo.codigo} — ${res.inseridos} termos (${fontes.totalMq} MQ)`
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

    await sb
      .from("biblioteca_knowledge_run")
      .update({ estado: "concluido", concluido_em: new Date().toISOString() })
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
