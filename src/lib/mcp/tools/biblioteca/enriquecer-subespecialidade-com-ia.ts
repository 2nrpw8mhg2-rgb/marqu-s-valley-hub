import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";
import { detetarPtBr, normalizarPtPt, recalcularQualidade, registarAprendizagem } from "./_shared";

const PROMPT_SISTEMA = `És um especialista técnico de orçamentação de construção civil em Portugal.
Analisas artigos mestre de uma biblioteca técnica e produzes conhecimento estruturado em Português de Portugal (pt-PT).

REGRAS DE IDIOMA (CRÍTICAS):
- Nunca uses português do Brasil.
- Termos PROIBIDOS → substitutos pt-PT:
  * "tijolo baiano" → "tijolo cerâmico furado"
  * "alvenaria de concreto" → "alvenaria de bloco de betão"
  * "concreto" → "betão"
  * "contrapiso" → "betonilha"
  * "drywall" → "placa de gesso cartonado" (ou "pladur")
  * "massa corrida" → "barramento" / "estuque"
  * "forma" (de betão) → "cofragem"
  * "concretagem" → "betonagem"
  * "tubulação" → "tubagem"
  * "encanamento" → "canalização"
  * "banheiro" → "casa de banho"
  * "arquivo" (ficheiro) → "ficheiro"
- Terminologia pt-PT preferida: betão, cofragem, betonilha, tijolo cerâmico, bloco de betão, placa de gesso cartonado, argamassa de assentamento, caixilharia, mapa de quantidades.

REGRAS DE CONTEÚDO:
- Palavras-chave: substantivos/curtos, específicos ao artigo (não genéricos como "obra", "material").
- Sinónimos: designações alternativas reais para o MESMO trabalho.
- Expressões: locuções técnicas que aparecem em cadernos de encargos e MQ.
- Materiais: componentes físicos usados (não ferramentas).
- Capítulos típicos: nomes de capítulos onde este artigo costuma aparecer no MQ.
- Exemplos reais: descrições curtas como surgem em MQ reais. Se não conheceres, devolve [].
- Negativos concorrentes: variantes da MESMA especialidade fáceis de confundir com este artigo.
- Negativos incompatíveis: termos de OUTRAS especialidades que NÃO se referem a este artigo.
- Relações: sugestões qualitativas (não inventes IDs).

RESPONDE APENAS COM JSON VÁLIDO neste formato exacto:
{
  "palavras_chave": [...],
  "sinonimos": [...],
  "expressoes": [...],
  "materiais": [...],
  "capitulos_tipicos": [...],
  "exemplos_reais": [...],
  "negativos_concorrentes": [...],
  "negativos_incompativeis": [...],
  "relacoes_sugeridas": [{ "tipo": "complementa|depende_de|antecede|substitui|incompativel", "descricao": "...", "codigo_alvo": "opcional" }],
  "confianca": 0.0
}`;

type Proposta = {
  palavras_chave: string[];
  sinonimos: string[];
  expressoes: string[];
  materiais: string[];
  capitulos_tipicos: string[];
  exemplos_reais: string[];
  negativos_concorrentes: string[];
  negativos_incompativeis: string[];
  relacoes_sugeridas: Array<{ tipo: string; descricao?: string; codigo_alvo?: string }>;
  confianca: number;
};

const TIPO_TO_CONHECIMENTO = {
  palavras_chave: "palavra_chave",
  sinonimos: "sinonimo",
  expressoes: "expressao",
  materiais: "material",
  capitulos_tipicos: "capitulo_tipico",
  exemplos_reais: "exemplo_real",
  negativos_concorrentes: "negativo_concorrente",
  negativos_incompativeis: "negativo_incompativel",
} as const;

const TIPO_RELACAO_VALIDAS = new Set(["complementa", "depende_de", "antecede", "substitui", "incompativel", "opcional"]);

function normList(arr: unknown, cap: number): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of arr) {
    if (typeof raw !== "string") continue;
    const t = normalizarPtPt(raw.trim());
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= cap) break;
  }
  return out;
}

async function chamarIA(apiKey: string, modelo: string, contexto: string, alvos: Record<string, number>): Promise<{ proposta: Proposta; erro?: string }> {
  const userPrompt = `Artigo mestre:
${contexto}

Alvos aproximados (não excedas muito):
- palavras_chave: ${alvos.palavras_chave}
- sinonimos: ${alvos.sinonimos}
- expressoes: ${alvos.expressoes}
- materiais: ${alvos.materiais}
- capitulos_tipicos: ${alvos.capitulos}
- exemplos_reais: ${alvos.exemplos}
- negativos_concorrentes: ${alvos.negativos_concorrentes}
- negativos_incompativeis: ${alvos.negativos_incompativeis}

Devolve JSON conforme o formato indicado.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modelo,
      messages: [{ role: "system", content: PROMPT_SISTEMA }, { role: "user", content: userPrompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return { proposta: emptyProposta(), erro: `IA ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const payload = await res.json();
  let raw: any = {};
  try { raw = JSON.parse(payload?.choices?.[0]?.message?.content ?? "{}"); } catch { return { proposta: emptyProposta(), erro: "IA devolveu JSON inválido." }; }
  return {
    proposta: {
      palavras_chave: normList(raw.palavras_chave, alvos.palavras_chave * 2),
      sinonimos: normList(raw.sinonimos, alvos.sinonimos * 2),
      expressoes: normList(raw.expressoes, alvos.expressoes * 2),
      materiais: normList(raw.materiais, alvos.materiais * 2),
      capitulos_tipicos: normList(raw.capitulos_tipicos, alvos.capitulos * 2),
      exemplos_reais: normList(raw.exemplos_reais, alvos.exemplos * 2),
      negativos_concorrentes: normList(raw.negativos_concorrentes, alvos.negativos_concorrentes * 2),
      negativos_incompativeis: normList(raw.negativos_incompativeis, alvos.negativos_incompativeis * 2),
      relacoes_sugeridas: Array.isArray(raw.relacoes_sugeridas) ? raw.relacoes_sugeridas.slice(0, 10) : [],
      confianca: typeof raw.confianca === "number" ? Math.max(0, Math.min(1, raw.confianca)) : 0.5,
    },
  };
}

function emptyProposta(): Proposta {
  return { palavras_chave: [], sinonimos: [], expressoes: [], materiais: [], capitulos_tipicos: [], exemplos_reais: [], negativos_concorrentes: [], negativos_incompativeis: [], relacoes_sugeridas: [], confianca: 0 };
}

export default defineTool({
  name: "enriquecer_subespecialidade_com_ia",
  title: "Enriquecer subespecialidade com IA (lote)",
  description: "Enriquece em lote todos os Artigos Mestre ativos de uma subespecialidade: gera palavras-chave, sinónimos, expressões, materiais, capítulos, exemplos, negativos e (opcional) relações. Nunca apaga nem reclassifica. Modo dry-run por defeito (aplicar=false). Sempre pt-PT.",
  inputSchema: {
    subespecialidade_id: z.string().uuid(),
    palavras_chave: z.number().int().min(0).max(50).default(10),
    sinonimos: z.number().int().min(0).max(50).default(10),
    expressoes: z.number().int().min(0).max(50).default(10),
    materiais: z.number().int().min(0).max(50).default(10),
    capitulos: z.number().int().min(0).max(30).default(5),
    exemplos: z.number().int().min(0).max(30).default(5),
    negativos_concorrentes: z.number().int().min(0).max(50).default(10),
    negativos_incompativeis: z.number().int().min(0).max(50).default(10),
    criar_relacoes: z.boolean().default(true),
    aplicar: z.boolean().default(false),
    limite: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
    modelo: z.string().default("google/gemini-2.5-flash"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return errorResult("LOVABLE_API_KEY não configurada.");
    const userId = ctx.getUserId();

    // 1. Ler subespecialidade + especialidade
    const { data: subesp, error: eSub } = await sb
      .from("biblioteca_subespecialidades")
      .select("id, nome, codigo, especialidade:biblioteca_especialidades(id, nome, codigo)")
      .eq("id", input.subespecialidade_id)
      .maybeSingle();
    if (eSub) return errorResult(eSub.message);
    if (!subesp) return errorResult("Subespecialidade não encontrada.");
    const espNome = (subesp.especialidade as any)?.nome ?? "?";

    // 2. Listar artigos
    const { data: artigos, error: eArt } = await sb
      .from("biblioteca_artigos")
      .select("id, codigo, descricao, unidade, categoria:biblioteca_categorias(nome)")
      .eq("subespecialidade_id", input.subespecialidade_id)
      .eq("ativo", true)
      .order("codigo", { ascending: true })
      .range(input.offset, input.offset + input.limite - 1);
    if (eArt) return errorResult(eArt.message);
    if (!artigos?.length) {
      return jsonResult({
        subespecialidade: { id: subesp.id, nome: subesp.nome, especialidade: espNome },
        totais: { artigos_encontrados: 0, artigos_enriquecidos: 0, artigos_ignorados: 0 },
        razao: "Sem artigos ativos nesta subespecialidade (no intervalo pedido).",
      });
    }

    const alvos = {
      palavras_chave: input.palavras_chave,
      sinonimos: input.sinonimos,
      expressoes: input.expressoes,
      materiais: input.materiais,
      capitulos: input.capitulos,
      exemplos: input.exemplos,
      negativos_concorrentes: input.negativos_concorrentes,
      negativos_incompativeis: input.negativos_incompativeis,
    };

    const totais = {
      artigos_encontrados: artigos.length,
      artigos_enriquecidos: 0,
      artigos_ignorados: 0,
      palavras_chave: 0,
      sinonimos: 0,
      expressoes: 0,
      materiais: 0,
      capitulos_tipicos: 0,
      exemplos_reais: 0,
      negativos_concorrentes: 0,
      negativos_incompativeis: 0,
      relacoes: 0,
    };
    const artigosOut: any[] = [];
    const propostasOut: any[] = [];
    const erros: Array<{ artigo_id: string; codigo: string; mensagem: string }> = [];
    let scoreAntesSum = 0;
    let scoreDepoisSum = 0;
    let scoreAntesN = 0;
    let scoreDepoisN = 0;

    // Índice de códigos → id para resolução de relações
    const codigoParaId = new Map<string, string>();
    for (const a of artigos) codigoParaId.set(a.codigo, a.id);

    for (const art of artigos) {
      try {
        // Conhecimento existente
        const { data: existentes } = await sb
          .from("biblioteca_artigo_conhecimento")
          .select("tipo, termo")
          .eq("artigo_mestre_id", art.id)
          .eq("ativo", true);
        const existentesSet = new Set<string>();
        for (const e of existentes ?? []) existentesSet.add(`${e.tipo}::${(e.termo as string).toLowerCase()}`);

        // Score antes
        const { data: qAntes } = await sb.from("biblioteca_artigo_qualidade").select("score_qualidade").eq("artigo_id", art.id).maybeSingle();
        const scoreAntes = qAntes?.score_qualidade ?? 0;
        scoreAntesSum += Number(scoreAntes); scoreAntesN++;

        // Chamar IA
        const contexto = `- Código: ${art.codigo}
- Descrição: ${art.descricao}
- Unidade: ${art.unidade}
- Especialidade: ${espNome}
- Subespecialidade: ${subesp.nome}
- Categoria: ${(art.categoria as any)?.nome ?? "?"}`;
        const { proposta, erro } = await chamarIA(apiKey, input.modelo, contexto, alvos);
        if (erro) { erros.push({ artigo_id: art.id, codigo: art.codigo, mensagem: erro }); totais.artigos_ignorados++; continue; }

        // Filtrar duplicados + limitar aos alvos
        const filtrarNovo = (tipo: string, arr: string[], cap: number) => {
          const out: string[] = [];
          for (const t of arr) {
            const key = `${tipo}::${t.toLowerCase()}`;
            if (existentesSet.has(key)) continue;
            existentesSet.add(key);
            out.push(t);
            if (out.length >= cap) break;
          }
          return out;
        };
        const adicionar: Record<string, string[]> = {
          palavra_chave: filtrarNovo("palavra_chave", proposta.palavras_chave, alvos.palavras_chave),
          sinonimo: filtrarNovo("sinonimo", proposta.sinonimos, alvos.sinonimos),
          expressao: filtrarNovo("expressao", proposta.expressoes, alvos.expressoes),
          material: filtrarNovo("material", proposta.materiais, alvos.materiais),
          capitulo_tipico: filtrarNovo("capitulo_tipico", proposta.capitulos_tipicos, alvos.capitulos),
          exemplo_real: filtrarNovo("exemplo_real", proposta.exemplos_reais, alvos.exemplos),
          negativo_concorrente: filtrarNovo("negativo_concorrente", proposta.negativos_concorrentes, alvos.negativos_concorrentes),
          negativo_incompativel: filtrarNovo("negativo_incompativel", proposta.negativos_incompativeis, alvos.negativos_incompativeis),
        };

        // Avisos pt-BR residuais
        const avisosPtBr: string[] = [];
        for (const arr of Object.values(adicionar)) {
          for (const t of arr) { const br = detetarPtBr(t); if (br.length) avisosPtBr.push(`${t} (${br.join(",")})`); }
        }
        if (avisosPtBr.length) erros.push({ artigo_id: art.id, codigo: art.codigo, mensagem: `Termos pt-BR normalizados: ${avisosPtBr.slice(0,5).join("; ")}` });

        const adicionados = {
          palavras_chave: adicionar.palavra_chave.length,
          sinonimos: adicionar.sinonimo.length,
          expressoes: adicionar.expressao.length,
          materiais: adicionar.material.length,
          capitulos_tipicos: adicionar.capitulo_tipico.length,
          exemplos_reais: adicionar.exemplo_real.length,
          negativos_concorrentes: adicionar.negativo_concorrente.length,
          negativos_incompativeis: adicionar.negativo_incompativel.length,
          relacoes: 0,
        };

        let scoreDepois: number | null = null;

        if (input.aplicar) {
          // Insert conhecimento
          const rows: any[] = [];
          for (const [tipo, termos] of Object.entries(adicionar)) {
            for (const t of termos) rows.push({ artigo_mestre_id: art.id, tipo, termo: t, origem: "ia", ativo: true, confianca: proposta.confianca });
          }
          if (rows.length) {
            const { error: eIns } = await sb.from("biblioteca_artigo_conhecimento").insert(rows);
            if (eIns) { erros.push({ artigo_id: art.id, codigo: art.codigo, mensagem: `insert conhecimento: ${eIns.message}` }); }
          }

          // Relações
          if (input.criar_relacoes) {
            for (const rel of proposta.relacoes_sugeridas) {
              if (!rel?.codigo_alvo || !TIPO_RELACAO_VALIDAS.has(rel.tipo)) continue;
              const destinoId = codigoParaId.get(rel.codigo_alvo);
              if (!destinoId || destinoId === art.id) continue;
              const { error: eRel } = await sb.from("biblioteca_artigo_relacoes").upsert({
                artigo_origem_id: art.id,
                artigo_destino_id: destinoId,
                tipo_relacao: rel.tipo,
                obrigatoriedade: "frequente",
                confianca: proposta.confianca,
                origem: "ia",
                observacoes: rel.descricao ?? null,
                created_by: userId ?? null,
              }, { onConflict: "artigo_origem_id,artigo_destino_id,tipo_relacao" });
              if (!eRel) { adicionados.relacoes++; totais.relacoes++; }
            }
          }

          await registarAprendizagem(sb, art.id, "enriquecido_ia_lote", { adicionados, subespecialidade_id: subesp.id }, userId);
          const q = await recalcularQualidade(sb, art.id);
          scoreDepois = q.score;
          scoreDepoisSum += Number(scoreDepois); scoreDepoisN++;
        } else {
          // Dry-run: gravar sugestão para revisão posterior
          await sb.from("biblioteca_sugestao").insert({
            artigo_id: art.id,
            tipo: "novo_conhecimento",
            payload: { adicionar, relacoes_sugeridas: proposta.relacoes_sugeridas },
            justificacao: `Proposta em lote da subespecialidade ${subesp.nome}.`,
            confianca: proposta.confianca,
            origem: "ia",
            criado_por: userId,
          });
          propostasOut.push({ artigo_id: art.id, codigo: art.codigo, adicionar, relacoes_sugeridas: proposta.relacoes_sugeridas });
        }

        // Totais
        totais.palavras_chave += adicionados.palavras_chave;
        totais.sinonimos += adicionados.sinonimos;
        totais.expressoes += adicionados.expressoes;
        totais.materiais += adicionados.materiais;
        totais.capitulos_tipicos += adicionados.capitulos_tipicos;
        totais.exemplos_reais += adicionados.exemplos_reais;
        totais.negativos_concorrentes += adicionados.negativos_concorrentes;
        totais.negativos_incompativeis += adicionados.negativos_incompativeis;
        totais.artigos_enriquecidos++;

        artigosOut.push({
          id: art.id,
          codigo: art.codigo,
          descricao: art.descricao,
          score_antes: Number(scoreAntes),
          score_depois: scoreDepois,
          adicionados,
          aplicado: input.aplicar,
        });
      } catch (e: any) {
        erros.push({ artigo_id: art.id, codigo: art.codigo, mensagem: String(e?.message ?? e) });
        totais.artigos_ignorados++;
      }
    }

    const scoreMedioAntes = scoreAntesN ? Number((scoreAntesSum / scoreAntesN).toFixed(3)) : 0;
    const scoreMedioDepois = scoreDepoisN ? Number((scoreDepoisSum / scoreDepoisN).toFixed(3)) : null;

    return jsonResult({
      subespecialidade: { id: subesp.id, nome: subesp.nome, codigo: subesp.codigo, especialidade: espNome },
      parametros: { aplicar: input.aplicar, criar_relacoes: input.criar_relacoes, limite: input.limite, offset: input.offset, modelo: input.modelo, alvos },
      totais,
      qualidade: {
        score_medio_antes: scoreMedioAntes,
        score_medio_depois: scoreMedioDepois,
        delta: scoreMedioDepois !== null ? Number((scoreMedioDepois - scoreMedioAntes).toFixed(3)) : null,
      },
      artigos: artigosOut,
      propostas: input.aplicar ? undefined : propostasOut,
      erros,
      origem: "ia",
      razao: input.aplicar
        ? `Enriquecidos ${totais.artigos_enriquecidos}/${totais.artigos_encontrados} artigos da subespecialidade "${subesp.nome}".`
        : `Dry-run: propostas geradas para ${totais.artigos_enriquecidos}/${totais.artigos_encontrados} artigos e gravadas como sugestões pendentes. Repetir com aplicar=true para persistir.`,
    });
  },
});
