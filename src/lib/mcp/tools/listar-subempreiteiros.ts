import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_subempreiteiros",
  title: "Listar subempreiteiros",
  description: "Lista subempreiteiros registados.",
  inputSchema: {
    texto: z.string().optional().describe("Pesquisa por nome."),
    limite: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ texto, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    let q = supabaseForUser(ctx)
      .from("subempreiteiros")
      .select("*")
      .limit(limite ?? 50);
    if (texto) q = q.ilike("nome", `%${texto}%`);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return jsonResult(data);
  },
});
