import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../supabase";
import { classificarArtigo, type AprendizagemHit, type Subempreitada } from "@/lib/subempreitadas/engine";

export default defineTool({
  name: "separar_orcamento_por_subempreitada",
  title: "Separar orçamento por subempreitada",
  description:
    "Executa o motor de classificação por subempreitada num orçamento (preservando os artigos validados manualmente) e devolve o resumo da operação.",
  inputSchema: {
    orcamento_id: z.string().uuid(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ orcamento_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const inicio = Date.now();

    const { data: subsRaw, error: eSubs } = await sb
      .from("subempreitadas")
      .select("id, codigo, nome, palavras_chave, termos_exclusao, ativo")
      .eq("ativo", true);
    if (eSubs) return errorResult(eSubs.message);
    const subs = (subsRaw ?? []) as Subempreitada[];

    const { data: apr, error: eApr } = await sb
      .from("subempreitada_aprendizagem")
      .select("descricao_normalizada, subempreitada_id, peso");
    if (eApr) return errorResult(eApr.message);
    const aprendizagem = (apr ?? []) as AprendizagemHit[];

    const { data: artigos, error: eArt } = await sb
      .from("orcamento_artigos")
      .select("id, codigo, descricao, unidade, subempreitada_validada_manual, capitulo:orcamento_capitulos(descricao)")
      .eq("orcamento_id", orcamento_id)
      .eq("subempreitada_validada_manual", false);
    if (eArt) return errorResult(eArt.message);

    let classificados = 0;
    let semClassificacao = 0;
    let baixaConfianca = 0;
    let conflitos = 0;

    for (const a of artigos ?? []) {
      if ((a as any).subempreitada_validada_manual === true) continue;
      const capDesc = Array.isArray((a as any).capitulo)
        ? (a as any).capitulo[0]?.descricao
        : (a as any).capitulo?.descricao;
      const r = classificarArtigo(
        { codigo: a.codigo, descricao: a.descricao, unidade: (a as any).unidade ?? null, capitulo_descricao: capDesc ?? null },
        subs,
        null,
        aprendizagem,
      );
      await sb
        .from("orcamento_artigos")
        .update({
          subempreitada_id: r.subempreitada_id,
          subempreitada_sugerida_id: r.subempreitada_sugerida_id,
          subempreitada_confianca: r.confianca,
          subempreitada_origem: r.origem,
          subempreitada_razao: r.razao,
          subempreitada_termos_match: r.termos_match,
        })
        .eq("id", a.id);
      if (r.subempreitada_id) classificados++;
      else semClassificacao++;
      if (r.origem === "baixa_confianca") baixaConfianca++;
      if (r.origem === "conflito") conflitos++;
    }

    return jsonResult({
      orcamento_id,
      artigos_processados: artigos?.length ?? 0,
      artigos_classificados: classificados,
      sem_classificacao: semClassificacao,
      baixa_confianca: baixaConfianca,
      conflitos,
      tempo_ms: Date.now() - inicio,
    });
  },
});
