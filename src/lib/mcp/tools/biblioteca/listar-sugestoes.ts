import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";

export default defineTool({
  name: "listar_sugestoes",
  title: "Listar sugestões pendentes",
  description: "Devolve sugestões pendentes de revisão humana.",
  inputSchema: {
    estado: z.enum(["pendente", "aceite", "rejeitada", "expirada"]).default("pendente"),
    tipo: z.enum(["reclassificar", "fundir", "renomear", "nova_relacao", "novo_conhecimento", "remover"]).optional(),
    limite: z.number().int().min(1).max(500).default(100),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ estado, tipo, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    let q = sb.from("biblioteca_sugestao").select("*, artigo:biblioteca_artigos(id, codigo, descricao)").eq("estado", estado).order("created_at", { ascending: false }).limit(limite);
    if (tipo) q = q.eq("tipo", tipo);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return jsonResult({ total: data?.length ?? 0, sugestoes: data ?? [], origem: "dados_reais", razao: `Sugestões com estado ${estado}.` });
  },
});
