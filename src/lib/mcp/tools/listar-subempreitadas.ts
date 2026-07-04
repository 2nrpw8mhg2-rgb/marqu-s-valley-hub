import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_subempreitadas",
  title: "Listar subempreitadas",
  description: "Lista todas as subempreitadas ativas (categorias de execução em obra).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const { data, error } = await supabaseForUser(ctx)
      .from("subempreitadas")
      .select("id, codigo, nome, descricao, ordem, ativo")
      .eq("ativo", true)
      .order("ordem", { ascending: true });
    if (error) return errorResult(error.message);
    return jsonResult(data ?? []);
  },
});
