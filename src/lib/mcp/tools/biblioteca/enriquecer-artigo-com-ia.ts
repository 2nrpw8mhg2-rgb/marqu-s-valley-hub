import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";
import { normalizarPtPt, recalcularQualidade, registarAprendizagem } from "./_shared";

const PROMPT = `És um especialista técnico de orçamentação de construção civil em Portugal.
Analisa o artigo mestre abaixo e gera conhecimento estruturado em Português de Portugal (NUNCA português do Brasil).
Responde APENAS com JSON no formato:
{
  "palavras_chave": [...],
  "sinonimos": [...],
  "expressoes": [...],
  "materiais": [...],
  "ferramentas": [...],
  "equipamentos": [...],
  "unidades_compativeis": [...],
  "capitulos_tipicos": [...],
  "exemplos_reais": [...],
  "negativos_concorrentes": [...],
  "negativos_incompativeis": [...],
  "relacoes_sugeridas": [{ "tipo": "complementa|depende_de|antecede|substitui|incompativel", "descricao": "..." }],
  "score_qualidade_estimado": 0.0,
  "razao": "..."
}
Regras:
- pt-PT: usa "betão" (não "concreto"), "cofragem" (não "forma"), "tubagem" (não "tubulação").
- Negativos concorrentes = variantes da MESMA especialidade que podem ser confundidas.
- Negativos incompatíveis = termos de OUTRAS especialidades (evita palavras semelhantes).
- Não inventes exemplos: se não tiveres exemplos reais, devolve [].`;

export default defineTool({
  name: "enriquecer_artigo_com_ia",
  title: "Enriquecer artigo com IA",
  description: "Analisa um artigo mestre e gera proposta de enriquecimento (palavras-chave, sinónimos, negativos, relações). Não persiste — devolve proposta para revisão. Use `aplicar_enriquecimento_ia` para gravar.",
  inputSchema: {
    id: z.string().uuid(),
    contexto_extra: z.string().optional(),
    aplicar: z.boolean().default(false).describe("Se true, aplica automaticamente (só admin)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  handler: async ({ id, contexto_extra, aplicar }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const { data: art, error } = await sb.from("biblioteca_artigos").select("*, subesp:biblioteca_subespecialidades(nome), cat:biblioteca_categorias(nome)").eq("id", id).maybeSingle();
    if (error) return errorResult(error.message);
    if (!art) return errorResult("Artigo não encontrado.");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return errorResult("LOVABLE_API_KEY não configurada.");

    const contexto = `Artigo:
- Código: ${art.codigo}
- Descrição: ${art.descricao}
- Unidade: ${art.unidade}
- Subespecialidade: ${(art.subesp as any)?.nome ?? "?"}
- Categoria: ${(art.cat as any)?.nome ?? "?"}
${contexto_extra ? `- Contexto adicional: ${contexto_extra}` : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: PROMPT }, { role: "user", content: contexto }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return errorResult(`IA falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const payload = await res.json();
    let proposta: any;
    try { proposta = JSON.parse(payload?.choices?.[0]?.message?.content ?? "{}"); } catch { proposta = {}; }

    // Normaliza tudo para pt-PT
    const normList = (arr?: string[]) => (arr ?? []).map((t) => normalizarPtPt(String(t).trim())).filter(Boolean);
    const clean = {
      palavras_chave: normList(proposta.palavras_chave),
      sinonimos: normList(proposta.sinonimos),
      expressoes: normList(proposta.expressoes),
      materiais: normList(proposta.materiais),
      unidades_compativeis: normList(proposta.unidades_compativeis),
      capitulos_tipicos: normList(proposta.capitulos_tipicos),
      exemplos_reais: normList(proposta.exemplos_reais),
      negativos_concorrentes: normList(proposta.negativos_concorrentes),
      negativos_incompativeis: normList(proposta.negativos_incompativeis),
      relacoes_sugeridas: proposta.relacoes_sugeridas ?? [],
      score_qualidade_estimado: proposta.score_qualidade_estimado ?? null,
      razao: proposta.razao ?? "Proposta gerada por IA.",
    };

    if (!aplicar) {
      // Grava sugestão para revisão
      await sb.from("biblioteca_sugestao").insert({
        artigo_id: id,
        tipo: "novo_conhecimento",
        payload: clean,
        justificacao: clean.razao,
        confianca: clean.score_qualidade_estimado,
        origem: "ia",
        criado_por: ctx.getUserId(),
      });
      return jsonResult({ proposta: clean, aplicado: false, origem: "ia", razao: "Proposta gravada como sugestão pendente. Use `aplicar_enriquecimento_ia` ou `aprovar_sugestao` para persistir." });
    }

    // aplicar imediatamente
    const rows: any[] = [];
    const push = (tipo: string, arr: string[]) => { for (const t of arr) rows.push({ artigo_mestre_id: id, tipo, termo: t, origem: "ia", ativo: true, confianca: clean.score_qualidade_estimado ?? 0.5 }); };
    push("palavra_chave", clean.palavras_chave);
    push("sinonimo", clean.sinonimos);
    push("expressao", clean.expressoes);
    push("material", clean.materiais);
    push("unidade_compativel", clean.unidades_compativeis);
    push("capitulo_tipico", clean.capitulos_tipicos);
    push("exemplo_real", clean.exemplos_reais);
    push("negativo_concorrente", clean.negativos_concorrentes);
    push("negativo_incompativel", clean.negativos_incompativeis);
    if (rows.length) await sb.from("biblioteca_artigo_conhecimento").insert(rows);
    await registarAprendizagem(sb, id, "enriquecido_ia", { total: rows.length }, ctx.getUserId());
    const q = await recalcularQualidade(sb, id);
    return jsonResult({ proposta: clean, aplicado: true, inseridos: rows.length, qualidade: q, origem: "ia", razao: "Enriquecimento aplicado." });
  },
});
