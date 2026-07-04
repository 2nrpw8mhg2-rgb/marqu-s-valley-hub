import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_orcamentos",
  title: "Listar orçamentos",
  description: "Lista orçamentos, opcionalmente filtrados por obra.",
  inputSchema: {
    obra_id: z.string().uuid().optional().describe("UUID opcional da obra para filtrar."),
    limite: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ obra_id, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    let q = supabaseForUser(ctx)
      .from("orcamentos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limite ?? 50);
    if (obra_id) q = q.eq("obra_id", obra_id);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return jsonResult(data);
  },
});
