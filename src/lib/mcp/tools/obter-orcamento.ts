import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../supabase";

export default defineTool({
  name: "obter_orcamento",
  title: "Obter orçamento",
  description: "Devolve um orçamento com capítulos e artigos, incluindo a subempreitada atribuída a cada artigo.",
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
    const { data: artigosRaw, error: e3 } = await sb
      .from("orcamento_artigos")
      .select(
        "id, capitulo_id, codigo, descricao, unidade, quantidade, preco_unitario, updated_at, subempreitada_id, subempreitada_sugerida_id, subempreitada_confianca, subempreitada_origem, subempreitada_validada_manual, subempreitada_razao, subempreitada_termos_match, subempreitada:subempreitadas!subempreitada_id(codigo, nome), sugerida:subempreitadas!subempreitada_sugerida_id(codigo, nome)",
      )
      .eq("orcamento_id", id);
    if (e3) return errorResult(e3.message);
    const artigos = (artigosRaw ?? []).map((a: any) => {
      const sub = Array.isArray(a.subempreitada) ? a.subempreitada[0] : a.subempreitada;
      const sug = Array.isArray(a.sugerida) ? a.sugerida[0] : a.sugerida;
      return {
        id: a.id,
        capitulo_id: a.capitulo_id,
        codigo: a.codigo,
        descricao: a.descricao,
        unidade: a.unidade,
        quantidade: a.quantidade,
        preco_unitario: a.preco_unitario,
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
    return jsonResult({ orcamento: orc, capitulos, artigos });
  },
});
