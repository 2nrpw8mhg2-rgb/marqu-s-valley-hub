import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";

export default defineTool({
  name: "dashboard_biblioteca_qualidade",
  title: "Dashboard de qualidade da Biblioteca",
  description: "Métricas globais em tempo real: totais, score médio, cobertura, sugestões pendentes, artigos por estado.",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const [esp, sub, cat, art, artAtivos, conh, rel, qual, sugPend] = await Promise.all([
      sb.from("biblioteca_especialidades").select("*", { count: "exact", head: true }),
      sb.from("biblioteca_subespecialidades").select("*", { count: "exact", head: true }),
      sb.from("biblioteca_categorias").select("*", { count: "exact", head: true }),
      sb.from("biblioteca_artigos").select("*", { count: "exact", head: true }),
      sb.from("biblioteca_artigos").select("*", { count: "exact", head: true }).eq("ativo", true),
      sb.from("biblioteca_artigo_conhecimento").select("tipo").eq("ativo", true).limit(50000),
      sb.from("biblioteca_artigo_relacoes").select("*", { count: "exact", head: true }),
      sb.from("biblioteca_artigo_qualidade").select("score_qualidade, completude"),
      sb.from("biblioteca_sugestao").select("*", { count: "exact", head: true }).eq("estado", "pendente"),
    ]);
    if (art.error || conh.error) return errorResult(art.error?.message ?? conh.error?.message ?? "erro");

    const contPorTipo: Record<string, number> = {};
    for (const c of conh.data ?? []) contPorTipo[c.tipo] = (contPorTipo[c.tipo] ?? 0) + 1;

    const qs = qual.data ?? [];
    const scoreMedio = qs.length ? qs.reduce((s: number, r: any) => s + Number(r.score_qualidade), 0) / qs.length : 0;
    const completos = qs.filter((r: any) => Number(r.completude) >= 0.8).length;
    const total = artAtivos.count ?? 0;

    return jsonResult({
      totais: {
        especialidades: esp.count ?? 0,
        subespecialidades: sub.count ?? 0,
        categorias: cat.count ?? 0,
        artigos: art.count ?? 0,
        artigos_ativos: total,
        relacoes: rel.count ?? 0,
        sugestoes_pendentes: sugPend.count ?? 0,
      },
      conhecimento_por_tipo: contPorTipo,
      qualidade: {
        score_medio: Number(scoreMedio.toFixed(3)),
        artigos_com_qualidade_calculada: qs.length,
        artigos_completos: completos,
        cobertura: total ? Number((qs.length / total).toFixed(3)) : 0,
      },
      origem: "dados_reais",
      razao: "Snapshot em tempo real da Biblioteca Mestra.",
    });
  },
});
