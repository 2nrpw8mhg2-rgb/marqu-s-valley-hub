import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";

export default defineTool({
  name: "detetar_lacunas",
  title: "Detetar lacunas na Biblioteca",
  description: "Cruza artigos de orçamentos reais com a Biblioteca Mestra para identificar termos frequentes sem cobertura.",
  inputSchema: { minimo_ocorrencias: z.number().int().min(2).default(3), limite: z.number().int().min(1).max(500).default(100) },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ minimo_ocorrencias, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    // Artigos de orçamentos sem match com biblioteca
    const { data, error } = await sb.from("orcamento_artigos")
      .select("descricao, unidade")
      .is("subempreitada_id", null)
      .limit(5000);
    if (error) return errorResult(error.message);

    const norm = (s: string) => (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter((w) => w.length > 4);
    const freq: Record<string, number> = {};
    for (const r of data ?? []) for (const t of norm(r.descricao)) freq[t] = (freq[t] ?? 0) + 1;

    // Termos já cobertos
    const { data: cobertos } = await sb.from("biblioteca_artigo_conhecimento").select("termo").eq("ativo", true).limit(50000);
    const cobertoSet = new Set((cobertos ?? []).map((c: any) => c.termo.toLowerCase()));

    const lacunas = Object.entries(freq)
      .filter(([t, n]) => n >= minimo_ocorrencias && !cobertoSet.has(t))
      .sort((a, b) => b[1] - a[1])
      .slice(0, limite)
      .map(([termo, ocorrencias]) => ({ termo, ocorrencias }));

    return jsonResult({ total: lacunas.length, lacunas, origem: "cruzamento_mq", razao: "Termos frequentes em MQ sem cobertura na Biblioteca." });
  },
});
