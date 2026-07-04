import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_obras",
  title: "Listar obras",
  description: "Lista as obras acessíveis ao utilizador autenticado (código, nome, cliente, estado, localização).",
  inputSchema: {
    estado: z.string().optional().describe("Filtro opcional por estado da obra."),
    limite: z.number().int().min(1).max(200).optional().describe("Número máximo de resultados (por omissão 50)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ estado, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    let q = supabaseForUser(ctx)
      .from("obras")
      .select("id, codigo, nome, cliente, estado, localizacao, valor_estimado, data_inicio, data_fim_prevista")
      .order("created_at", { ascending: false })
      .limit(limite ?? 50);
    if (estado) q = q.eq("estado", estado);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return jsonResult(data);
  },
});
