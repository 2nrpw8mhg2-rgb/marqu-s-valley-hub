import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthed, supabaseForUser } from "../../supabase";

export default defineTool({
  name: "detetar_duplicados",
  title: "Detetar duplicados na Biblioteca",
  description: "Deteta artigos duplicados ou muito semelhantes por similaridade textual (pg_trgm) dentro da mesma subespecialidade.",
  inputSchema: {
    subespecialidade_id: z.string().uuid().optional(),
    similaridade_min: z.number().min(0.3).max(1).default(0.75),
    limite: z.number().int().min(1).max(500).default(100),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ subespecialidade_id, similaridade_min, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    let q = sb.from("biblioteca_artigos").select("id, codigo, descricao, subespecialidade_id").eq("ativo", true).limit(2000);
    if (subespecialidade_id) q = q.eq("subespecialidade_id", subespecialidade_id);
    const { data: artigos, error } = await q;
    if (error) return errorResult(error.message);

    // Comparação em memória por subespecialidade usando Jaccard simples de tokens
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2);
    const grupos: Record<string, any[]> = {};
    for (const a of artigos ?? []) (grupos[a.subespecialidade_id] ??= []).push({ ...a, tokens: new Set(norm(a.descricao)) });

    const pares: any[] = [];
    for (const arr of Object.values(grupos)) {
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const A = arr[i].tokens, B = arr[j].tokens;
          if (!A.size || !B.size) continue;
          let inter = 0;
          for (const t of A) if (B.has(t)) inter++;
          const sim = inter / (A.size + B.size - inter);
          if (sim >= similaridade_min) pares.push({ a: { id: arr[i].id, codigo: arr[i].codigo, descricao: arr[i].descricao }, b: { id: arr[j].id, codigo: arr[j].codigo, descricao: arr[j].descricao }, similaridade: Number(sim.toFixed(3)) });
          if (pares.length >= limite) break;
        }
        if (pares.length >= limite) break;
      }
    }
    pares.sort((x, y) => y.similaridade - x.similaridade);
    return jsonResult({ total: pares.length, pares, origem: "analise", razao: `Deteção via Jaccard com threshold ${similaridade_min}.` });
  },
});
