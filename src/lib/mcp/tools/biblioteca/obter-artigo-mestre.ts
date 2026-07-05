import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";

export default defineTool({
  name: "obter_artigo_mestre",
  title: "Obter artigo mestre",
  description: "Devolve um artigo mestre com todo o conhecimento associado, relações, qualidade e histórico.",
  inputSchema: { id: z.string().uuid() },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const { data: artigo, error } = await sb
      .from("biblioteca_artigos")
      .select("*, biblioteca_artigo_qualidade(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!artigo) return errorResult("Artigo não encontrado.");

    const [conhecimento, relacoesOrig, relacoesDest, aprendizagem] = await Promise.all([
      sb.from("biblioteca_artigo_conhecimento").select("*").eq("artigo_mestre_id", id).eq("ativo", true),
      sb.from("biblioteca_artigo_relacoes").select("*, destino:biblioteca_artigos!artigo_destino_id(id, codigo, descricao)").eq("artigo_origem_id", id),
      sb.from("biblioteca_artigo_relacoes").select("*, origem_art:biblioteca_artigos!artigo_origem_id(id, codigo, descricao)").eq("artigo_destino_id", id),
      sb.from("biblioteca_aprendizagem_evento").select("*").eq("artigo_id", id).order("created_at", { ascending: false }).limit(30),
    ]);

    const conh = conhecimento.data ?? [];
    const agrupado: Record<string, any[]> = {};
    for (const c of conh) (agrupado[c.tipo] ??= []).push(c);

    return jsonResult({
      artigo,
      conhecimento: agrupado,
      relacoes: { como_origem: relacoesOrig.data ?? [], como_destino: relacoesDest.data ?? [] },
      historico_aprendizagem: aprendizagem.data ?? [],
      origem: "dados_reais",
      razao: "Vista completa do artigo com conhecimento agrupado por tipo.",
    });
  },
});
