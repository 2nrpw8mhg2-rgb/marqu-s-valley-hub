import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../supabase";

export default defineTool({
  name: "obter_orcamento",
  title: "Obter orçamento",
  description: "Devolve um orçamento com os seus capítulos e artigos.",
  inputSchema: {
    id: z.string().uuid().describe("UUID do orçamento."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const { data: orc, error: e1 } = await sb.from("orcamentos").select("*").eq("id", id).maybeSingle();
    if (e1) return errorResult(e1.message);
    if (!orc) return errorResult("Orçamento não encontrado.");
    const { data: capitulos, error: e2 } = await sb
      .from("orcamento_capitulos")
      .select("*")
      .eq("orcamento_id", id);
    if (e2) return errorResult(e2.message);
    const { data: artigos, error: e3 } = await sb
      .from("orcamento_artigos")
      .select("id, capitulo_id, codigo, descricao, unidade, quantidade, preco_unitario")
      .eq("orcamento_id", id);
    if (e3) return errorResult(e3.message);
    return jsonResult({ orcamento: orc, capitulos, artigos });
  },
});
