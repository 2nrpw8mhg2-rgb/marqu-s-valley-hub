import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";
import { isAdmin, recalcularQualidade, registarAprendizagem } from "./_shared";

export default defineTool({
  name: "aprovar_sugestao",
  title: "Aprovar ou rejeitar sugestão",
  description: "Aprova (aplica) ou rejeita uma sugestão pendente. Só admin.",
  inputSchema: {
    id: z.string().uuid(),
    decisao: z.enum(["aceitar", "rejeitar"]),
    nota: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ id, decisao, nota }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    if (!(await isAdmin(sb, ctx.getUserId()!))) return errorResult("Requer permissão de administrador.");
    const { data: s, error } = await sb.from("biblioteca_sugestao").select("*").eq("id", id).maybeSingle();
    if (error) return errorResult(error.message);
    if (!s) return errorResult("Sugestão não encontrada.");
    if (s.estado !== "pendente") return errorResult(`Sugestão já ${s.estado}.`);

    if (decisao === "rejeitar") {
      await sb.from("biblioteca_sugestao").update({ estado: "rejeitada", revisto_por: ctx.getUserId(), revisto_em: new Date().toISOString() }).eq("id", id);
      return jsonResult({ id, decisao, origem: "utilizador", razao: nota ?? "Rejeitada." });
    }

    // Aceitar → aplica payload por tipo
    if (s.tipo === "reclassificar") {
      const patch: any = {};
      if (s.payload.nova_subespecialidade_id) patch.subespecialidade_id = s.payload.nova_subespecialidade_id;
      if (s.payload.nova_categoria_id) patch.categoria_id = s.payload.nova_categoria_id;
      if (Object.keys(patch).length) await sb.from("biblioteca_artigos").update(patch).eq("id", s.artigo_id);
    } else if (s.tipo === "novo_conhecimento") {
      const p = s.payload ?? {};
      const rows: any[] = [];
      const push = (tipo: string, arr?: string[]) => { for (const t of arr ?? []) rows.push({ artigo_mestre_id: s.artigo_id, tipo, termo: t, origem: "ia", ativo: true }); };
      push("palavra_chave", p.palavras_chave);
      push("sinonimo", p.sinonimos);
      push("expressao", p.expressoes);
      push("material", p.materiais);
      push("unidade_compativel", p.unidades_compativeis);
      push("capitulo_tipico", p.capitulos_tipicos);
      push("exemplo_real", p.exemplos_reais);
      push("negativo_concorrente", p.negativos_concorrentes);
      push("negativo_incompativel", p.negativos_incompativeis);
      if (rows.length) await sb.from("biblioteca_artigo_conhecimento").insert(rows);
    }

    await sb.from("biblioteca_sugestao").update({ estado: "aceite", revisto_por: ctx.getUserId(), revisto_em: new Date().toISOString() }).eq("id", id);
    if (s.artigo_id) {
      await registarAprendizagem(sb, s.artigo_id, "sugestao_aceite", { tipo: s.tipo }, ctx.getUserId());
      await recalcularQualidade(sb, s.artigo_id);
    }
    return jsonResult({ id, decisao, origem: "utilizador", razao: "Sugestão aplicada." });
  },
});
