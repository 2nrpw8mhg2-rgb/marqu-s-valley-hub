import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";
import { detetarPtBr, normalizarPtPt, recalcularQualidade, registarAprendizagem } from "./_shared";

const TIPO = z.enum(["palavra_chave", "sinonimo", "expressao", "material", "unidade_compativel", "capitulo_tipico", "exemplo_real", "negativo_concorrente", "negativo_incompativel"]);

export default defineTool({
  name: "adicionar_conhecimento_artigo",
  title: "Adicionar conhecimento a um artigo",
  description: "Adiciona palavras-chave, sinónimos, expressões, materiais, exemplos ou negativos a um artigo mestre. Nunca elimina o existente. Sempre pt-PT.",
  inputSchema: {
    artigo_id: z.string().uuid(),
    tipo: TIPO,
    termos: z.array(z.string().min(1)).min(1),
    origem: z.enum(["utilizador", "ia", "aprendizagem"]).default("utilizador"),
    exemplo_ref: z.object({ origem: z.enum(["mq", "orcamento", "obra"]), ref_id: z.string().optional() }).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ artigo_id, tipo, termos, origem, exemplo_ref }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);

    // Deteção pt-BR
    const avisos: string[] = [];
    for (const t of termos) {
      const br = detetarPtBr(t);
      if (br.length) avisos.push(`"${t}" contém termos pt-BR: ${br.join(", ")} — normalizado.`);
    }

    // Validação: negativos incompatíveis devem ser de OUTRA especialidade (heurística: aviso se termo é palavra-chave própria)
    if (tipo === "negativo_incompativel") {
      const { data: proprio } = await sb.from("biblioteca_artigo_conhecimento")
        .select("termo").eq("artigo_mestre_id", artigo_id).in("tipo", ["palavra_chave", "sinonimo"]);
      const propriosSet = new Set((proprio ?? []).map((r: any) => r.termo.toLowerCase()));
      for (const t of termos) if (propriosSet.has(t.toLowerCase())) avisos.push(`"${t}" já é palavra-chave/sinónimo — não deve ser negativo incompatível.`);
    }

    const rows = termos.map((t) => ({
      artigo_mestre_id: artigo_id,
      tipo,
      termo: normalizarPtPt(t.trim()),
      origem,
      ativo: true,
      exemplos: exemplo_ref ? [exemplo_ref] : null,
    }));
    const { error } = await sb.from("biblioteca_artigo_conhecimento").insert(rows);
    if (error) return errorResult(error.message);
    await registarAprendizagem(sb, artigo_id, `conhecimento_adicionado:${tipo}`, { n: rows.length }, ctx.getUserId());
    const q = await recalcularQualidade(sb, artigo_id);
    return jsonResult({ inseridos: rows.length, qualidade: q, avisos, origem, razao: `Adicionados ${rows.length} termos de tipo ${tipo}.` });
  },
});
