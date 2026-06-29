import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ScopeInput =
  | { tipo: "especialidade"; especialidadeId: string }
  | { tipo: "subespecialidade"; subespecialidadeId: string }
  | { tipo: "artigo"; artigoId: string };

function validateScope(s: any): ScopeInput {
  if (!s?.tipo) throw new Error("scope.tipo obrigatório");
  if (s.tipo === "especialidade" && s.especialidadeId) return s;
  if (s.tipo === "subespecialidade" && s.subespecialidadeId) return s;
  if (s.tipo === "artigo" && s.artigoId) return s;
  throw new Error("scope inválido");
}

export const previewKnowledgeScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { scope: ScopeInput }) => ({ scope: validateScope(data?.scope) }))
  .handler(async ({ data }) => {
    const { previewScope } = await import("./knowledge-builder.server");
    return previewScope(data.scope);
  });

export const startKnowledgeRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { scope: ScopeInput; modo: "manter" | "novos" | "regenerar" }) => {
    if (!["manter", "novos", "regenerar"].includes(data?.modo)) throw new Error("modo inválido");
    return { scope: validateScope(data.scope), modo: data.modo };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scopeIds: Record<string, string> = {};
    if (data.scope.tipo === "especialidade") scopeIds.especialidadeId = data.scope.especialidadeId;
    if (data.scope.tipo === "subespecialidade") scopeIds.subespecialidadeId = data.scope.subespecialidadeId;
    if (data.scope.tipo === "artigo") scopeIds.artigoId = data.scope.artigoId;

    const { data: row, error } = await supabase
      .from("biblioteca_knowledge_run")
      .insert({
        scope_tipo: data.scope.tipo,
        scope_ids: scopeIds,
        modo: data.modo,
        estado: "pendente",
        iniciado_por: userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    const runId = row.id as string;
    // dispara em background
    const { processRun } = await import("./knowledge-builder.server");
    void processRun(runId).catch((e) => console.error("knowledge run failed", e));

    return { runId };
  });

export const getKnowledgeRunStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { runId: string }) => {
    if (!data?.runId) throw new Error("runId obrigatório");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("biblioteca_knowledge_run")
      .select("*")
      .eq("id", data.runId)
      .single();
    if (error) throw error;
    return row;
  });

export const cancelKnowledgeRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { runId: string }) => {
    if (!data?.runId) throw new Error("runId obrigatório");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("biblioteca_knowledge_run")
      .update({ cancelar: true })
      .eq("id", data.runId);
    if (error) throw error;
    return { ok: true };
  });

export const aprovarConhecimentoRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { runId: string }) => {
    if (!data?.runId) throw new Error("runId obrigatório");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: run, error } = await context.supabase
      .from("biblioteca_knowledge_run")
      .select("resumo")
      .eq("id", data.runId)
      .single();
    if (error) throw error;
    const termos = ((run?.resumo as any)?.termos ?? []) as Array<{ id: string; novo: boolean; origem: string }>;
    const ids = termos.filter((t) => t.novo && t.origem === "ia").map((t) => t.id);
    if (!ids.length) return { ok: true, aprovados: 0 };
    const { error: upErr } = await context.supabase
      .from("biblioteca_artigo_conhecimento")
      .update({ origem: "utilizador" })
      .in("id", ids);
    if (upErr) throw upErr;
    return { ok: true, aprovados: ids.length };
  });

