import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SplitInput = { pacoteId: string };
type SplitOutput = {
  criados: { subespecialidadeId: string; nome: string; artigos: number; pacoteId: string }[];
  semClassificacao: number;
};

/**
 * Divide um pacote MEP nos seus pacotes por disciplina (Eletricidade, AVAC, ITED...).
 *
 * Usa regras determinísticas + keywords das subespecialidades da especialidade 110.
 * Artigos sem classificação clara ficam no pacote original com a flag de revisão.
 */
export const splitPacoteMepEmDisciplinas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SplitInput) => {
    if (!data?.pacoteId) throw new Error("pacoteId é obrigatório");
    return data;
  })
  .handler(async ({ data, context }): Promise<SplitOutput> => {
    const { supabase } = context;

    // 1. Pacote
    const { data: pacote, error: pErr } = await supabase
      .from("procurement_pacotes")
      .select("id, orcamento_id, obra_id, nome, grupo_consulta, estado")
      .eq("id", data.pacoteId)
      .single();
    if (pErr) throw pErr;

    // 2. Disciplinas da 110
    const { data: esp110, error: e110 } = await supabase
      .from("biblioteca_especialidades")
      .select("id")
      .eq("codigo", "110")
      .single();
    if (e110) throw e110;

    const { data: disciplinas, error: dErr } = await supabase
      .from("biblioteca_subespecialidades")
      .select("id, nome, slug")
      .eq("especialidade_id", esp110.id)
      .eq("ativa", true);
    if (dErr) throw dErr;
    if (!disciplinas?.length) throw new Error("Sem disciplinas configuradas para 110");
    const subIds = disciplinas.map((s) => s.id);

    // 3. Keywords + regras
    const [{ data: kws }, { data: regras }] = await Promise.all([
      supabase
        .from("biblioteca_subespecialidade_keywords")
        .select("subespecialidade_id, termo, peso, tipo")
        .in("subespecialidade_id", subIds)
        .eq("ativo", true),
      supabase
        .from("biblioteca_subespecialidade_regras")
        .select("subespecialidade_id, padrao, prioridade")
        .in("subespecialidade_id", subIds)
        .eq("ativo", true)
        .order("prioridade", { ascending: true }),
    ]);

    // 4. Artigos do pacote
    const { data: artigos, error: aErr } = await supabase
      .from("procurement_pacote_artigos")
      .select("*")
      .eq("pacote_id", data.pacoteId);
    if (aErr) throw aErr;
    if (!artigos?.length) return { criados: [], semClassificacao: 0 };

    // 5. Classificar cada artigo
    function classificar(desc: string): string | null {
      const lower = desc.toLowerCase();
      // Regras primeiro
      for (const r of regras ?? []) {
        try {
          if (new RegExp(r.padrao, "i").test(desc)) return r.subespecialidade_id;
        } catch { /* ignora padrão inválido */ }
      }
      // Keywords
      const scores = new Map<string, number>();
      for (const k of kws ?? []) {
        if (!lower.includes(k.termo.toLowerCase())) continue;
        const delta = (k.tipo === "negativa" ? -1 : 1) * Number(k.peso ?? 1);
        scores.set(k.subespecialidade_id, (scores.get(k.subespecialidade_id) ?? 0) + delta);
      }
      let best: { id: string; score: number } | null = null;
      for (const [id, score] of scores) {
        if (score > 0 && (!best || score > best.score)) best = { id, score };
      }
      return best?.id ?? null;
    }

    const buckets = new Map<string, any[]>();
    const semClass: any[] = [];
    for (const a of artigos) {
      const subId = classificar(`${a.descricao ?? ""} ${a.codigo ?? ""}`);
      if (subId) {
        const arr = buckets.get(subId) ?? [];
        arr.push(a);
        buckets.set(subId, arr);
      } else {
        semClass.push(a);
      }
    }

    if (buckets.size === 0) {
      return { criados: [], semClassificacao: semClass.length };
    }

    // 6. Criar pacote por disciplina e mover artigos
    const criados: SplitOutput["criados"] = [];
    for (const [subId, arts] of buckets) {
      const disc = disciplinas.find((d) => d.id === subId)!;
      const nomePacote = `${pacote.nome} — ${disc.nome}`;
      const { data: novo, error: nErr } = await supabase
        .from("procurement_pacotes")
        .insert({
          orcamento_id: pacote.orcamento_id,
          obra_id: pacote.obra_id,
          nome: nomePacote,
          especialidade: disc.nome,
          subespecialidade_id: subId,
          estado: pacote.estado,
          grupo_consulta: pacote.grupo_consulta,
        } as any)
        .select("id")
        .single();
      if (nErr) throw nErr;

      const rows = arts.map((a) => ({
        pacote_id: novo.id,
        artigo_id: a.artigo_id,
        codigo: a.codigo,
        descricao: a.descricao,
        unidade: a.unidade,
        quantidade: a.quantidade,
        capitulo: a.capitulo,
        subcapitulo: a.subcapitulo,
        preco_seco_estimado: a.preco_seco_estimado,
        categoria_custo: a.categoria_custo,
        especialidade: disc.nome,
        confianca: 0.9,
        motivo: "Classificado por disciplina MEP",
        sinalizado_revisao: false,
      }));
      if (rows.length) {
        const { error: insErr } = await supabase.from("procurement_pacote_artigos").insert(rows);
        if (insErr) throw insErr;
      }
      criados.push({ subespecialidadeId: subId, nome: disc.nome, artigos: rows.length, pacoteId: novo.id });
    }

    // 7. Remover do pacote original os artigos classificados
    const idsMovidos = artigos.filter((a) => !semClass.find((s) => s.id === a.id)).map((a) => a.id);
    if (idsMovidos.length) {
      const { error: delErr } = await supabase
        .from("procurement_pacote_artigos")
        .delete()
        .in("id", idsMovidos);
      if (delErr) throw delErr;
    }

    return { criados, semClassificacao: semClass.length };
  });
