import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SuggestInput = { descricao: string; subespecialidadeId: string };
type SuggestOutput = { categoriaId: string; confianca: number };

type SuggestSubInput = { descricao: string; especialidadeId: string };
type SuggestSubOutput = { subespecialidadeId: string; confianca: number; via: "regra" | "keyword" | "ia" | "fallback" };

/**
 * Dada uma especialidade marcada como `subesp_como_disciplina` (ex. 110 — MEP),
 * escolhe a disciplina/subespecialidade mais provável para uma descrição livre.
 * Aplica regras determinísticas → keywords → IA, por esta ordem.
 */
export const suggestSubespecialidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SuggestSubInput) => {
    if (!data?.descricao || !data?.especialidadeId) {
      throw new Error("descricao e especialidadeId são obrigatórios");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<SuggestSubOutput> => {
    const { supabase } = context;
    const descLower = data.descricao.toLowerCase();

    const { data: subs, error: subsErr } = await supabase
      .from("biblioteca_subespecialidades")
      .select("id, nome, slug, descricao")
      .eq("especialidade_id", data.especialidadeId)
      .eq("ativa", true)
      .order("ordem");
    if (subsErr) throw subsErr;
    if (!subs || subs.length === 0) throw new Error("Sem subespecialidades disponíveis");

    // 1. Regras determinísticas
    const { data: regras } = await supabase
      .from("biblioteca_subespecialidade_regras")
      .select("subespecialidade_id, padrao, prioridade")
      .eq("ativo", true)
      .order("prioridade", { ascending: true });
    if (regras) {
      for (const r of regras) {
        if (!subs.find((s) => s.id === r.subespecialidade_id)) continue;
        try {
          if (new RegExp(r.padrao, "i").test(data.descricao)) {
            return { subespecialidadeId: r.subespecialidade_id, confianca: 0.98, via: "regra" };
          }
        } catch { /* padrão inválido ignora */ }
      }
    }

    // 2. Keywords positivas — escolhe a disciplina com maior soma de pesos
    const subIds = subs.map((s) => s.id);
    const { data: kws } = await supabase
      .from("biblioteca_subespecialidade_keywords")
      .select("subespecialidade_id, termo, peso, tipo")
      .in("subespecialidade_id", subIds)
      .eq("ativo", true);
    if (kws && kws.length) {
      const scores = new Map<string, number>();
      for (const k of kws) {
        if (!descLower.includes(k.termo.toLowerCase())) continue;
        const delta = (k.tipo === "negativa" ? -1 : 1) * Number(k.peso ?? 1);
        scores.set(k.subespecialidade_id, (scores.get(k.subespecialidade_id) ?? 0) + delta);
      }
      let best: { id: string; score: number } | null = null;
      for (const [id, score] of scores) {
        if (score > 0 && (!best || score > best.score)) best = { id, score };
      }
      if (best) {
        const conf = Math.min(0.95, 0.5 + best.score * 0.15);
        return { subespecialidadeId: best.id, confianca: conf, via: "keyword" };
      }
    }

    // 3. IA (Lovable Gateway)
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { subespecialidadeId: subs[0].id, confianca: 0, via: "fallback" };
    }
    const list = subs.map((s, i) => `${i + 1}. ${s.nome}${s.descricao ? ` — ${s.descricao}` : ""}`).join("\n");
    const prompt = `És um classificador de artigos de construção em Portugal, especificamente para Especialidades Técnicas (MEP). Dada a descrição, escolhe a disciplina mais adequada. Responde apenas com JSON {"index": <número>, "confianca": <0..1>}.

Descrição: "${data.descricao}"

Disciplinas:
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
      return { subespecialidadeId: subs[0].id, confianca: 0, via: "fallback" };
    }
    const payload = await res.json();
    const content = payload?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { index?: number; confianca?: number };
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const idx = (parsed.index ?? 1) - 1;
    const chosen = subs[idx] ?? subs[0];
    return { subespecialidadeId: chosen.id, confianca: Math.max(0, Math.min(1, parsed.confianca ?? 0.5)), via: "ia" };
  });

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
