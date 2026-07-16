import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function scoreMatch(query: string, nome: string, codigo: string | null): number {
  const q = norm(query);
  const n = norm(nome);
  const c = codigo ? norm(codigo) : "";
  if (!q) return 0;
  if (n === q || (c && c === q)) return 100;
  if (c && c === q) return 95;
  if (n.startsWith(q)) return 80;
  if (n.includes(q)) return 60;
  const qt = new Set(q.split(" ").filter((t) => t.length >= 2));
  const nt = new Set(n.split(" ").filter((t) => t.length >= 2));
  let shared = 0;
  for (const t of qt) if (nt.has(t)) shared++;
  if (shared > 0) return 30 + 10 * shared;
  return 0;
}

export default defineTool({
  name: "pesquisar_subespecialidade",
  title: "Pesquisar subespecialidade por nome",
  description:
    "Pesquisa subespecialidades da Biblioteca Mestra por nome (tolerante a maiúsculas, acentos e correspondências parciais). Devolve o id, especialidade pai, contagens de artigos e score de qualidade. Nunca escreve dados.",
  inputSchema: {
    nome: z.string().trim().min(2),
    especialidade_nome: z.string().trim().min(2).optional(),
    apenas_ativas: z.boolean().default(true),
    limite: z.number().int().min(1).max(20).default(10),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);

    let espQ = sb.from("biblioteca_especialidades").select("id, codigo, nome");
    if (input.apenas_ativas) espQ = espQ.eq("ativa", true);
    const { data: esp, error: eEsp } = await espQ;
    if (eEsp) return errorResult(eEsp.message);
    const espById = new Map((esp ?? []).map((e: any) => [e.id, e]));

    let subQ = sb.from("biblioteca_subespecialidades").select("id, codigo, nome, especialidade_id");
    if (input.apenas_ativas) subQ = subQ.eq("ativa", true);
    const { data: subs, error: eSub } = await subQ;
    if (eSub) return errorResult(eSub.message);

    const espFilter = input.especialidade_nome ? norm(input.especialidade_nome) : null;

    const scored = (subs ?? [])
      .map((s: any) => {
        const parent = espById.get(s.especialidade_id) as any;
        if (espFilter && !norm(parent?.nome ?? "").includes(espFilter)) return null;
        const score = scoreMatch(input.nome, s.nome, s.codigo);
        if (score === 0) return null;
        return { sub: s, parent, score };
      })
      .filter((x): x is { sub: any; parent: any; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limite);

    if (scored.length === 0) {
      return jsonResult({
        match_unico: false,
        correspondencias: [],
        razao: `Sem correspondências para "${input.nome}". Usar listar_subespecialidades para ver a estrutura completa.`,
      });
    }

    const subIds = scored.map((x) => x.sub.id);
    const { data: artigos, error: eArt } = await sb
      .from("biblioteca_artigos")
      .select("id, subespecialidade_id, ativo")
      .in("subespecialidade_id", subIds);
    if (eArt) return errorResult(eArt.message);

    const bucket: Record<string, { ativos: number; total: number; ids: string[] }> = {};
    for (const a of artigos ?? []) {
      const sid = (a as any).subespecialidade_id as string;
      const b = (bucket[sid] ??= { ativos: 0, total: 0, ids: [] });
      b.total++;
      if ((a as any).ativo) b.ativos++;
      b.ids.push((a as any).id);
    }
    const allArtIds = Object.values(bucket).flatMap((b) => b.ids);
    const qualMap: Record<string, number> = {};
    if (allArtIds.length > 0) {
      const { data: q, error: eQ } = await sb
        .from("biblioteca_artigo_qualidade")
        .select("artigo_id, score_qualidade")
        .in("artigo_id", allArtIds);
      if (eQ) return errorResult(eQ.message);
      for (const r of q ?? []) qualMap[(r as any).artigo_id] = Number((r as any).score_qualidade) || 0;
    }

    const correspondencias = scored.map((x) => {
      const b = bucket[x.sub.id];
      const vals = (b?.ids ?? []).map((id) => qualMap[id]).filter((v) => typeof v === "number");
      const score_medio_qualidade = vals.length
        ? Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3))
        : null;
      return {
        id: x.sub.id,
        codigo: x.sub.codigo,
        nome: x.sub.nome,
        especialidade: { id: x.parent?.id ?? null, codigo: x.parent?.codigo ?? null, nome: x.parent?.nome ?? null },
        n_artigos_ativos: b?.ativos ?? 0,
        n_artigos_total: b?.total ?? 0,
        score_medio_qualidade,
        score_match: x.score,
      };
    });

    const top = correspondencias[0];
    const segundo = correspondencias[1];
    const match_unico =
      correspondencias.length === 1 || (top.score_match === 100 && (!segundo || segundo.score_match < 100));

    const razao = match_unico
      ? correspondencias.length === 1
        ? "Encontrada 1 correspondência."
        : "Correspondência exata identificada como única."
      : `${correspondencias.length} correspondências possíveis — pedir ao utilizador para especificar qual a pretendida.`;

    return jsonResult({
      match_unico,
      subespecialidade: match_unico ? { ...top, score_match: undefined } : undefined,
      correspondencias,
      razao,
    });
  },
});
