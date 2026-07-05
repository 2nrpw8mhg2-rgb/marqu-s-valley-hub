import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";
import { recalcularQualidade, registarAprendizagem } from "./_shared";

const TIPO = z.enum(["complementa", "depende_de", "antecede", "substitui", "incompativel", "opcional"]);
const OBRIG = z.enum(["obrigatorio", "muito_frequente", "frequente", "opcional", "raro"]);

export default defineTool({
  name: "criar_relacao_artigo",
  title: "Criar relação entre artigos",
  description: "Cria uma relação entre dois artigos mestre. O inverso é gerado automaticamente pelo trigger.",
  inputSchema: {
    artigo_origem_id: z.string().uuid(),
    artigo_destino_id: z.string().uuid(),
    tipo_relacao: TIPO,
    obrigatoriedade: OBRIG.default("frequente"),
    confianca: z.number().min(0).max(1).default(0.8),
    observacoes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    if (input.artigo_origem_id === input.artigo_destino_id) return errorResult("Origem e destino têm de ser diferentes.");
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("biblioteca_artigo_relacoes").upsert({
      ...input,
      origem: "manual",
      created_by: ctx.getUserId(),
    }, { onConflict: "artigo_origem_id,artigo_destino_id,tipo_relacao" }).select("*").single();
    if (error) return errorResult(error.message);
    await registarAprendizagem(sb, input.artigo_origem_id, "relacao_criada", { destino: input.artigo_destino_id, tipo: input.tipo_relacao }, ctx.getUserId());
    await Promise.all([recalcularQualidade(sb, input.artigo_origem_id), recalcularQualidade(sb, input.artigo_destino_id)]);
    return jsonResult({ relacao: data, origem: "manual", razao: "Relação criada. Inversa gerada automaticamente." });
  },
});
