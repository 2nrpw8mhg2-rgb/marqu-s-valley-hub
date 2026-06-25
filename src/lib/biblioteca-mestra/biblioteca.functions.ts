import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SuggestInput = { descricao: string; subespecialidadeId: string };
type SuggestOutput = { categoriaId: string; confianca: number };

export const suggestCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SuggestInput) => {
    if (!data?.descricao || !data?.subespecialidadeId) {
      throw new Error("descricao e subespecialidadeId são obrigatórios");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<SuggestOutput> => {
    const { supabase } = context;
    const { data: cats, error } = await supabase
      .from("biblioteca_categorias")
      .select("id, nome, descricao")
      .eq("subespecialidade_id", data.subespecialidadeId)
      .eq("ativa", true)
      .order("ordem");
    if (error) throw error;
    if (!cats || cats.length === 0) throw new Error("Sem categorias disponíveis");

    // Filtra "Por Classificar" — só queremos categorias reais como alvos
    const targets = cats.filter((c) => !(c.nome === "Por Classificar"));
    if (targets.length === 0) {
      // Mantém-se em "Por Classificar"
      const pc = cats.find((c) => c.nome === "Por Classificar")!;
      return { categoriaId: pc.id, confianca: 0 };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const list = targets.map((c, i) => `${i + 1}. ${c.nome}${c.descricao ? ` — ${c.descricao}` : ""}`).join("\n");
    const prompt = `És um classificador de artigos de construção em Portugal. Dada a descrição abaixo, escolhe a categoria mais adequada da lista. Responde apenas com JSON no formato {"index": <número>, "confianca": <0..1>}.

Descrição: "${data.descricao}"

Categorias disponíveis:
${list}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Lovable AI falhou (${res.status}): ${txt.slice(0, 200)}`);
    }
    const payload = await res.json();
    const content = payload?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { index?: number; confianca?: number };
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const idx = (parsed.index ?? 0) - 1;
    const chosen = targets[idx] ?? targets[0];
    return { categoriaId: chosen.id, confianca: Math.max(0, Math.min(1, parsed.confianca ?? 0.5)) };
  });
