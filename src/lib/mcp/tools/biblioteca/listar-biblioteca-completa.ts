import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";

export default defineTool({
  name: "listar_biblioteca_completa",
  title: "Listar Biblioteca Mestra completa",
  description: "Devolve a Biblioteca Mestra paginada com especialidades, subespecialidades, categorias e artigos, incluindo métricas de qualidade.",
  inputSchema: {
    especialidade_id: z.string().uuid().optional(),
    subespecialidade_id: z.string().uuid().optional(),
    categoria_id: z.string().uuid().optional(),
    apenas_ativos: z.boolean().default(true),
    limite: z.number().int().min(1).max(500).default(200),
    offset: z.number().int().min(0).default(0),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);

    let q = sb
      .from("biblioteca_artigos")
      .select(
        "id, codigo, descricao, unidade, unidade_id, tipo, estado_ia, ativo, subespecialidade_id, categoria_id, subempreitada_principal_id, updated_at, created_at, biblioteca_artigo_qualidade(score_qualidade, completude, n_palavras_chave, n_sinonimos, n_expressoes, n_materiais, n_negativos, n_exemplos, n_relacoes)",
        { count: "exact" },
      )
      .order("codigo", { ascending: true })
      .range(input.offset, input.offset + input.limite - 1);
    if (input.apenas_ativos) q = q.eq("ativo", true);
    if (input.subespecialidade_id) q = q.eq("subespecialidade_id", input.subespecialidade_id);
    if (input.categoria_id) q = q.eq("categoria_id", input.categoria_id);
    if (input.especialidade_id) {
      const { data: subs } = await sb.from("biblioteca_subespecialidades").select("id").eq("especialidade_id", input.especialidade_id);
      const ids = (subs ?? []).map((s: any) => s.id);
      if (ids.length === 0) return jsonResult({ total: 0, artigos: [], hierarquia: [] });
      q = q.in("subespecialidade_id", ids);
    }
    const { data: artigos, error, count } = await q;
    if (error) return errorResult(error.message);

    const [esp, sub, cat] = await Promise.all([
      sb.from("biblioteca_especialidades").select("id, codigo, nome").eq("ativa", true).order("ordem"),
      sb.from("biblioteca_subespecialidades").select("id, codigo, nome, especialidade_id").eq("ativa", true).order("ordem"),
      sb.from("biblioteca_categorias").select("id, codigo, nome, subespecialidade_id").eq("ativa", true).order("ordem"),
    ]);

    return jsonResult({
      total: count ?? 0,
      offset: input.offset,
      limite: input.limite,
      hierarquia: { especialidades: esp.data ?? [], subespecialidades: sub.data ?? [], categorias: cat.data ?? [] },
      artigos: artigos ?? [],
      origem: "dados_reais",
      razao: "Consulta paginada com contagem exata e métricas de qualidade por artigo.",
    });
  },
});
