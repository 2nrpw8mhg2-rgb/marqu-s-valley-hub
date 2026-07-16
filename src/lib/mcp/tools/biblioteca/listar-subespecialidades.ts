import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";

export default defineTool({
  name: "listar_subespecialidades",
  title: "Listar subespecialidades da Biblioteca Mestra",
  description:
    "Devolve a estrutura completa da Biblioteca Mestra organizada por especialidade, com id, nome, número de artigos ativos/total e score médio de qualidade por subespecialidade. Útil para descobrir IDs sem depender de UUIDs manuais.",
  inputSchema: {
    especialidade_id: z.string().uuid().optional(),
    apenas_ativas: z.boolean().default(true),
    incluir_qualidade: z.boolean().default(true),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);

    let espQ = sb.from("biblioteca_especialidades").select("id, codigo, nome").order("ordem", { ascending: true });
    if (input.apenas_ativas) espQ = espQ.eq("ativa", true);
    const { data: esp, error: eEsp } = await espQ;
    if (eEsp) return errorResult(eEsp.message);

    let subQ = sb
      .from("biblioteca_subespecialidades")
      .select("id, codigo, nome, especialidade_id")
      .order("ordem", { ascending: true });
    if (input.apenas_ativas) subQ = subQ.eq("ativa", true);
    if (input.especialidade_id) subQ = subQ.eq("especialidade_id", input.especialidade_id);
    const { data: subs, error: eSub } = await subQ;
    if (eSub) return errorResult(eSub.message);

    const { data: artigos, error: eArt } = await sb
      .from("biblioteca_artigos")
      .select("id, subespecialidade_id, ativo");
    if (eArt) return errorResult(eArt.message);

    const artByCat: Record<string, { ativos: number; total: number; ids: string[] }> = {};
    for (const a of artigos ?? []) {
      const sid = (a as any).subespecialidade_id as string | null;
      if (!sid) continue;
      const b = (artByCat[sid] ??= { ativos: 0, total: 0, ids: [] });
      b.total++;
      if ((a as any).ativo) b.ativos++;
      b.ids.push((a as any).id);
    }

    const scoreBySub: Record<string, number | null> = {};
    if (input.incluir_qualidade) {
      const allIds = Object.values(artByCat).flatMap((b) => b.ids);
      if (allIds.length > 0) {
        const CHUNK = 500;
        const qualMap: Record<string, number> = {};
        for (let i = 0; i < allIds.length; i += CHUNK) {
          const slice = allIds.slice(i, i + CHUNK);
          const { data: q, error: eQ } = await sb
            .from("biblioteca_artigo_qualidade")
            .select("artigo_id, score_qualidade")
            .in("artigo_id", slice);
          if (eQ) return errorResult(eQ.message);
          for (const r of q ?? []) qualMap[(r as any).artigo_id] = Number((r as any).score_qualidade) || 0;
        }
        for (const [sid, b] of Object.entries(artByCat)) {
          const vals = b.ids.map((id) => qualMap[id]).filter((v) => typeof v === "number");
          scoreBySub[sid] = vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)) : null;
        }
      }
    }

    const especialidades = (esp ?? []).map((e: any) => {
      const filhas = (subs ?? [])
        .filter((s: any) => s.especialidade_id === e.id)
        .map((s: any) => {
          const b = artByCat[s.id];
          return {
            id: s.id,
            codigo: s.codigo,
            nome: s.nome,
            n_artigos_ativos: b?.ativos ?? 0,
            n_artigos_total: b?.total ?? 0,
            score_medio_qualidade: input.incluir_qualidade ? scoreBySub[s.id] ?? null : null,
          };
        });
      return { id: e.id, codigo: e.codigo, nome: e.nome, subespecialidades: filhas };
    });

    const totais = {
      n_especialidades: especialidades.length,
      n_subespecialidades: (subs ?? []).length,
      n_artigos_ativos: Object.values(artByCat).reduce((s, b) => s + b.ativos, 0),
      n_artigos_total: Object.values(artByCat).reduce((s, b) => s + b.total, 0),
    };

    return jsonResult({
      especialidades,
      totais,
      parametros: input,
      razao: "Estrutura hierárquica da Biblioteca Mestra com contagens e qualidade agregada.",
    });
  },
});
