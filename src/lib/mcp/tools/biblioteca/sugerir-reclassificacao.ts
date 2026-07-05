import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";

export default defineTool({
  name: "sugerir_reclassificacao",
  title: "Sugerir reclassificação de artigo",
  description: "Grava uma sugestão de mudança de subespecialidade/categoria para revisão humana. Nunca aplica automaticamente.",
  inputSchema: {
    artigo_id: z.string().uuid(),
    nova_subespecialidade_id: z.string().uuid().optional(),
    nova_categoria_id: z.string().uuid().optional(),
    justificacao: z.string().min(5),
    confianca: z.number().min(0).max(1).default(0.7),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("biblioteca_sugestao").insert({
      artigo_id: input.artigo_id,
      tipo: "reclassificar",
      payload: { nova_subespecialidade_id: input.nova_subespecialidade_id, nova_categoria_id: input.nova_categoria_id },
      justificacao: input.justificacao,
      confianca: input.confianca,
      origem: "ia",
      criado_por: ctx.getUserId(),
    }).select("*").single();
    if (error) return errorResult(error.message);
    return jsonResult({ sugestao: data, origem: "sugestao", razao: "Sugestão gravada. Requer aprovação humana." });
  },
});
