import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../supabase";

export default defineTool({
  name: "pesquisar_biblioteca",
  title: "Pesquisar biblioteca",
  description: "Pesquisa artigos na biblioteca mestra por texto (código ou descrição).",
  inputSchema: {
    texto: z.string().min(1).describe("Texto a pesquisar em código ou descrição."),
    limite: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ texto, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const { data, error } = await supabaseForUser(ctx)
      .from("biblioteca_artigos")
      .select("id, codigo, descricao, unidade, tipo, categoria_id, subespecialidade_id")
      .or(`codigo.ilike.%${texto}%,descricao.ilike.%${texto}%`)
      .eq("ativo", true)
      .limit(limite ?? 30);
    if (error) return errorResult(error.message);
    return jsonResult(data);
  },
});
