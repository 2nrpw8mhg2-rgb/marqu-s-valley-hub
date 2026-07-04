import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../supabase";

export default defineTool({
  name: "obter_resumo_subempreitadas_orcamento",
  title: "Resumo por subempreitada",
  description:
    "Agrega os artigos de um orçamento por subempreitada, devolvendo número de artigos, valor total e percentagem.",
  inputSchema: {
    orcamento_id: z.string().uuid(),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ orcamento_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const { data: artigos, error } = await sb
      .from("orcamento_artigos")
      .select("subempreitada_id, subempreitada_origem, quantidade, preco_unitario, subempreitada:subempreitadas(codigo, nome)")
      .eq("orcamento_id", orcamento_id);
    if (error) return errorResult(error.message);

    type Agg = { subempreitada_id: string | null; codigo: string | null; nome: string; numero_artigos: number; valor_total: number };
    const map = new Map<string, Agg>();
    let totalGeral = 0;
    const flags = { baixa_confianca: 0, conflito: 0, sem_regra: 0, sem_classificacao: 0 };
    for (const a of artigos ?? []) {
      const sub: any = Array.isArray((a as any).subempreitada) ? (a as any).subempreitada[0] : (a as any).subempreitada;
      const key = a.subempreitada_id ?? "__none__";
      const valor = Number(a.quantidade ?? 0) * Number(a.preco_unitario ?? 0);
      totalGeral += valor;
      const cur = map.get(key) ?? {
        subempreitada_id: a.subempreitada_id ?? null,
        codigo: sub?.codigo ?? null,
        nome: sub?.nome ?? "Sem classificação",
        numero_artigos: 0,
        valor_total: 0,
      };
      cur.numero_artigos += 1;
      cur.valor_total += valor;
      map.set(key, cur);
      if (!a.subempreitada_id) flags.sem_classificacao++;
      if (a.subempreitada_origem === "baixa_confianca") flags.baixa_confianca++;
      if (a.subempreitada_origem === "conflito") flags.conflito++;
      if (a.subempreitada_origem === "sem_regra") flags.sem_regra++;
    }
    const linhas = Array.from(map.values())
      .map((r) => ({
        ...r,
        valor_total: Number(r.valor_total.toFixed(2)),
        percentagem: totalGeral > 0 ? Number(((r.valor_total / totalGeral) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.valor_total - a.valor_total);

    return jsonResult({ total_geral: Number(totalGeral.toFixed(2)), linhas, necessita_validacao: flags });
  },
});
