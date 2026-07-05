import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";

export default defineTool({
  name: "auditar_biblioteca",
  title: "Auditar Biblioteca Mestra",
  description: "Executa auditoria completa: totais, artigos sem palavras-chave, sem sinónimos, sem negativos, sem exemplos, sem relações, nunca utilizados, qualidade média e recomendações.",
  inputSchema: { especialidade_id: z.string().uuid().optional() },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ especialidade_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const iniciado_por = ctx.getUserId();

    const { data: run } = await sb.from("biblioteca_auditoria_run").insert({ iniciado_por, ambito: { especialidade_id: especialidade_id ?? null } }).select("*").single();

    // Filtros
    let artQ = sb.from("biblioteca_artigos").select("id, codigo, descricao, subespecialidade_id, unidade, ativo").eq("ativo", true);
    if (especialidade_id) {
      const { data: subs } = await sb.from("biblioteca_subespecialidades").select("id").eq("especialidade_id", especialidade_id);
      artQ = artQ.in("subespecialidade_id", (subs ?? []).map((s: any) => s.id));
    }
    const { data: artigos } = await artQ;
    const ids = (artigos ?? []).map((a: any) => a.id);

    const [conh, rel, qual] = await Promise.all([
      sb.from("biblioteca_artigo_conhecimento").select("artigo_mestre_id, tipo").in("artigo_mestre_id", ids).eq("ativo", true),
      sb.from("biblioteca_artigo_relacoes").select("artigo_origem_id, artigo_destino_id").or(`artigo_origem_id.in.(${ids.join(",")}),artigo_destino_id.in.(${ids.join(",")})`),
      sb.from("biblioteca_artigo_qualidade").select("artigo_id, score_qualidade, n_utilizacoes").in("artigo_id", ids),
    ]);

    const conhPor: Record<string, Set<string>> = {};
    for (const c of conh.data ?? []) (conhPor[c.artigo_mestre_id] ??= new Set()).add(c.tipo);
    const relSet = new Set<string>();
    for (const r of rel.data ?? []) { relSet.add(r.artigo_origem_id); relSet.add(r.artigo_destino_id); }
    const qualMap = new Map((qual.data ?? []).map((q: any) => [q.artigo_id, q]));

    const semKw: any[] = [], semSin: any[] = [], semNeg: any[] = [], semEx: any[] = [], semRel: any[] = [], nuncaUsados: any[] = [];
    let scoreSum = 0, scoreN = 0;
    for (const a of artigos ?? []) {
      const s = conhPor[a.id] ?? new Set();
      if (!s.has("palavra_chave")) semKw.push({ id: a.id, codigo: a.codigo, descricao: a.descricao });
      if (!s.has("sinonimo")) semSin.push({ id: a.id, codigo: a.codigo });
      if (!s.has("negativo_concorrente") && !s.has("negativo_incompativel")) semNeg.push({ id: a.id, codigo: a.codigo });
      if (!s.has("exemplo_real")) semEx.push({ id: a.id, codigo: a.codigo });
      if (!relSet.has(a.id)) semRel.push({ id: a.id, codigo: a.codigo });
      const q = qualMap.get(a.id);
      if (q) { scoreSum += Number(q.score_qualidade ?? 0); scoreN++; if ((q.n_utilizacoes ?? 0) === 0) nuncaUsados.push({ id: a.id, codigo: a.codigo }); }
    }

    const scoreMedio = scoreN ? scoreSum / scoreN : 0;
    const cobertura = artigos?.length ? (scoreN / artigos.length) : 0;

    const recomendacoes: string[] = [];
    if (semKw.length) recomendacoes.push(`${semKw.length} artigos sem palavras-chave — correr enriquecimento IA em lote.`);
    if (semNeg.length > semKw.length * 0.5) recomendacoes.push(`Cobertura fraca de negativos (${semNeg.length}) — prejudica a classificação automática.`);
    if (semRel.length > (artigos?.length ?? 0) * 0.7) recomendacoes.push("Poucas relações entre artigos — considere criar sistemas construtivos.");

    const resumo = {
      totais: {
        artigos: artigos?.length ?? 0,
        sem_palavras_chave: semKw.length,
        sem_sinonimos: semSin.length,
        sem_negativos: semNeg.length,
        sem_exemplos: semEx.length,
        sem_relacoes: semRel.length,
        nunca_utilizados: nuncaUsados.length,
      },
      score_medio: Number(scoreMedio.toFixed(3)),
      cobertura_qualidade: Number(cobertura.toFixed(3)),
      amostras: {
        sem_palavras_chave: semKw.slice(0, 20),
        sem_negativos: semNeg.slice(0, 20),
        nunca_utilizados: nuncaUsados.slice(0, 20),
      },
      recomendacoes,
    };

    if (run) await sb.from("biblioteca_auditoria_run").update({ estado: "concluido", concluido_em: new Date().toISOString(), resumo }).eq("id", run.id);

    return jsonResult({ run_id: run?.id ?? null, resumo, origem: "auditoria", razao: "Auditoria concluída." });
  },
});
