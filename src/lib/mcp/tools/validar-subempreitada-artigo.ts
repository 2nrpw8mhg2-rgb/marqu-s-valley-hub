import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../supabase";
import { normalizar } from "@/lib/subempreitadas/engine";

export default defineTool({
  name: "validar_subempreitada_artigo",
  title: "Validar subempreitada de artigo",
  description:
    "Atribui manualmente uma subempreitada a um artigo de orçamento e grava a aprendizagem para casos futuros.",
  inputSchema: {
    artigo_id: z.string().uuid(),
    subempreitada_id: z.string().uuid().nullable(),
    validado_manual: z.boolean().optional().default(true),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ artigo_id, subempreitada_id, validado_manual }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const { data: art, error: e1 } = await sb
      .from("orcamento_artigos")
      .select("id, descricao")
      .eq("id", artigo_id)
      .maybeSingle();
    if (e1) return errorResult(e1.message);
    if (!art) return errorResult("Artigo não encontrado.");

    const { error: e2 } = await sb
      .from("orcamento_artigos")
      .update({
        subempreitada_id,
        subempreitada_confianca: subempreitada_id ? 1 : 0,
        subempreitada_origem: "manual",
        subempreitada_validada_manual: validado_manual ?? true,
      })
      .eq("id", artigo_id);
    if (e2) return errorResult(e2.message);

    if (subempreitada_id) {
      await sb.from("subempreitada_aprendizagem").insert({
        descricao_normalizada: normalizar(art.descricao),
        subempreitada_id,
        user_id: ctx.getUserId(),
        peso: 1,
      });
    }
    return jsonResult({ ok: true, artigo_id, subempreitada_id, validado_manual: validado_manual ?? true });
  },
});
