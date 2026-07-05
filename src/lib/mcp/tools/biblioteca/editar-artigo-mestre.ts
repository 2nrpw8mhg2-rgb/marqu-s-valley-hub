import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";
import { normalizarPtPt, recalcularQualidade, registarAprendizagem } from "./_shared";

export default defineTool({
  name: "editar_artigo_mestre",
  title: "Editar artigo mestre",
  description: "Atualiza propriedades de um artigo mestre. Regista evento de aprendizagem.",
  inputSchema: {
    id: z.string().uuid(),
    codigo: z.string().optional(),
    descricao: z.string().optional(),
    unidade: z.string().optional(),
    unidade_id: z.string().uuid().nullable().optional(),
    subespecialidade_id: z.string().uuid().optional(),
    categoria_id: z.string().uuid().optional(),
    observacoes: z.string().nullable().optional(),
    ativo: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ id, ...patch }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = typeof v === "string" ? normalizarPtPt(v) : v;
    if (!Object.keys(clean).length) return errorResult("Nada para atualizar.");
    const { data, error } = await sb.from("biblioteca_artigos").update(clean).eq("id", id).select("*").single();
    if (error) return errorResult(error.message);
    await registarAprendizagem(sb, id, "artigo_editado", { campos: Object.keys(clean) }, ctx.getUserId());
    const q = await recalcularQualidade(sb, id);
    return jsonResult({ artigo: data, qualidade: q, origem: "edicao_utilizador", razao: `Atualizados: ${Object.keys(clean).join(", ")}` });
  },
});
