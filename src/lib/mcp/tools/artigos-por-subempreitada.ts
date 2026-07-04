import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../supabase";

export default defineTool({
  name: "obter_artigos_por_subempreitada",
  title: "Artigos por subempreitada",
  description:
    "Devolve todos os artigos de um orçamento pertencentes a uma subempreitada (ou sem classificação quando subempreitada_id for null).",
  inputSchema: {
    orcamento_id: z.string().uuid(),
    subempreitada_id: z
      .string()
      .uuid()
      .nullable()
      .describe("UUID da subempreitada. Passar null para obter os artigos ainda sem classificação."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ orcamento_id, subempreitada_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("orcamento_artigos")
      .select(
        "id, capitulo_id, codigo, descricao, unidade, quantidade, preco_unitario, updated_at, subempreitada_id, subempreitada_sugerida_id, subempreitada_confianca, subempreitada_origem, subempreitada_razao, subempreitada_termos_match, subempreitada_validada_manual, subempreitada:subempreitadas!subempreitada_id(codigo, nome), sugerida:subempreitadas!subempreitada_sugerida_id(codigo, nome), capitulo:orcamento_capitulos(descricao)",
      )
      .eq("orcamento_id", orcamento_id);
    q = subempreitada_id === null ? q.is("subempreitada_id", null) : q.eq("subempreitada_id", subempreitada_id);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    const artigos = (data ?? []).map((a: any) => {
      const sub = Array.isArray(a.subempreitada) ? a.subempreitada[0] : a.subempreitada;
      const sug = Array.isArray(a.sugerida) ? a.sugerida[0] : a.sugerida;
      const cap = Array.isArray(a.capitulo) ? a.capitulo[0] : a.capitulo;
      return {
        id: a.id,
        codigo: a.codigo,
        descricao: a.descricao,
        unidade: a.unidade,
        quantidade: a.quantidade,
        preco_unitario: a.preco_unitario,
        capitulo_descricao: cap?.descricao ?? null,
        updated_at: a.updated_at ?? null,
        subempreitada_id: a.subempreitada_id ?? null,
        subempreitada_codigo: sub?.codigo ?? null,
        subempreitada_nome: sub?.nome ?? null,
        subempreitada_sugerida_id: a.subempreitada_sugerida_id ?? null,
        subempreitada_sugerida_codigo: sug?.codigo ?? null,
        subempreitada_sugerida_nome: sug?.nome ?? null,
        subempreitada_confianca: a.subempreitada_confianca ?? null,
        subempreitada_origem: a.subempreitada_origem ?? null,
        subempreitada_razao: a.subempreitada_razao ?? null,
        subempreitada_termos_match: a.subempreitada_termos_match ?? [],
        subempreitada_validada_manual: a.subempreitada_validada_manual ?? false,
      };
    });
    return jsonResult(artigos);
  },
});
