import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";
import { normalizarPtPt, recalcularQualidade, registarAprendizagem } from "./_shared";

export default defineTool({
  name: "criar_artigo_mestre",
  title: "Criar artigo mestre",
  description: "Cria um novo artigo mestre na Biblioteca com conhecimento inicial opcional. Texto normalizado para pt-PT.",
  inputSchema: {
    subespecialidade_id: z.string().uuid(),
    categoria_id: z.string().uuid(),
    codigo: z.string().min(1),
    descricao: z.string().min(3),
    unidade: z.string().min(1),
    unidade_id: z.string().uuid().optional(),
    observacoes: z.string().optional(),
    palavras_chave: z.array(z.string()).optional(),
    sinonimos: z.array(z.string()).optional(),
    expressoes: z.array(z.string()).optional(),
    materiais: z.array(z.string()).optional(),
    negativos_concorrentes: z.array(z.string()).optional(),
    negativos_incompativeis: z.array(z.string()).optional(),
    exemplos: z.array(z.string()).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const { data: art, error } = await sb.from("biblioteca_artigos").insert({
      subespecialidade_id: input.subespecialidade_id,
      categoria_id: input.categoria_id,
      codigo: input.codigo,
      descricao: normalizarPtPt(input.descricao),
      unidade: input.unidade,
      unidade_id: input.unidade_id ?? null,
      observacoes: input.observacoes ? normalizarPtPt(input.observacoes) : null,
      ativo: true,
    }).select("*").single();
    if (error) return errorResult(error.message);

    const rows: any[] = [];
    const push = (tipo: string, arr?: string[]) => {
      for (const t of arr ?? []) rows.push({ artigo_mestre_id: art.id, tipo, termo: normalizarPtPt(t.trim()), origem: "utilizador", ativo: true });
    };
    push("palavra_chave", input.palavras_chave);
    push("sinonimo", input.sinonimos);
    push("expressao", input.expressoes);
    push("material", input.materiais);
    push("negativo_concorrente", input.negativos_concorrentes);
    push("negativo_incompativel", input.negativos_incompativeis);
    push("exemplo_real", input.exemplos);
    if (rows.length) await sb.from("biblioteca_artigo_conhecimento").insert(rows);

    await registarAprendizagem(sb, art.id, "artigo_criado", { codigo: input.codigo }, ctx.getUserId());
    const q = await recalcularQualidade(sb, art.id);

    return jsonResult({ artigo: art, conhecimento_inserido: rows.length, qualidade: q, origem: "criacao_utilizador", razao: "Artigo criado com sucesso." });
  },
});
