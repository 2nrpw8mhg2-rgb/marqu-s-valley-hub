import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../supabase";

export default defineTool({
  name: "obter_obra",
  title: "Obter obra",
  description: "Devolve os detalhes completos de uma obra pelo seu id.",
  inputSchema: {
    id: z.string().uuid().describe("UUID da obra."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const { data, error } = await supabaseForUser(ctx)
      .from("obras")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!data) return errorResult("Obra não encontrada.");
    return jsonResult(data);
  },
});
