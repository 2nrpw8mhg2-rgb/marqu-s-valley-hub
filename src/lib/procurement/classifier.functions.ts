// Server functions: aprendizagem global, auditoria de pacotes e classificação IA.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  classificarComContexto,
  normalizar,
  pertenceAoPacote,
  type ArtigoComVizinhos,
} from "./classifier";
import { ESPECIALIDADES, type Especialidade } from "./especialidades";

const ArtigoSchema = z.object({
  id: z.string().optional(),
  codigo: z.string().nullable().optional(),
  descricao: z.string().nullable().optional(),
  capituloCodigo: z.string().nullable().optional(),
  capitulo: z.string().nullable().optional(),
  subcapitulo: z.string().nullable().optional(),
});

// -----------------------------------------------------------------------------
// 1) Registar correção (aprendizagem)
// -----------------------------------------------------------------------------

export const registarCorrecao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        artigo: ArtigoSchema,
        especialidadeAnterior: z.string().nullable().optional(),
        especialidadeFinal: z.string(),
        confiancaAnterior: z.number().nullable().optional(),
        obraId: z.string().nullable().optional(),
        acao: z.enum(["move", "add", "remove", "change"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const desc = data.artigo.descricao ?? "";
    const { error } = await supabase.from("classificacao_aprendizagem").insert({
      user_id: userId,
      descricao_original: desc,
      descricao_normalizada: normalizar(desc),
      codigo_artigo: data.artigo.codigo ?? null,
      capitulo: data.artigo.capitulo ?? null,
      subcapitulo: data.artigo.subcapitulo ?? null,
      especialidade_sugerida: data.especialidadeAnterior ?? null,
      especialidade_final: data.especialidadeFinal,
      confianca_sugerida: data.confiancaAnterior ?? null,
      obra_id: data.obraId ?? null,
      acao: data.acao,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -----------------------------------------------------------------------------
// 2) Procurar aprendizagem por descrição normalizada (consenso global)
// -----------------------------------------------------------------------------

export const consultarAprendizagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ descricao: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const norm = normalizar(data.descricao);
    if (!norm || norm.length < 8) return null;
    const { data: rows, error } = await context.supabase
      .from("classificacao_aprendizagem")
      .select("especialidade_final")
      .eq("descricao_normalizada", norm)
      .limit(50);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return null;
    const contagem = new Map<string, number>();
    for (const r of rows) {
      contagem.set(r.especialidade_final, (contagem.get(r.especialidade_final) ?? 0) + 1);
    }
    let topEsp = "";
    let topN = 0;
    for (const [e, n] of contagem) if (n > topN) { topEsp = e; topN = n; }
    const total = rows.length;
    return {
      especialidade: topEsp as Especialidade,
      ocorrencias: topN,
      total,
      confianca: Math.min(0.99, 0.7 + (topN / total) * 0.25),
    };
  });

// -----------------------------------------------------------------------------
// 3) Reanalisar pacote — auditoria pós-geração
// -----------------------------------------------------------------------------

export const reanalisarPacote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ pacoteId: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: pacote, error: ePac } = await supabase
      .from("procurement_pacotes")
      .select("id, especialidade, orcamento_id, obra_id, grupo_consulta")
      .eq("id", data.pacoteId)
      .single();
    if (ePac) throw new Error(ePac.message);

    const especialidade = pacote.especialidade;

    const { data: pacoteArtigos, error: ePA } = await supabase
      .from("procurement_pacote_artigos")
      .select("id, artigo_id, codigo, descricao, capitulo, subcapitulo")
      .eq("pacote_id", data.pacoteId);
    if (ePA) throw new Error(ePA.message);

    const { data: todosArtigos, error: eTA } = await supabase
      .from("orcamento_artigos")
      .select("id, codigo, descricao, ordem, capitulo:orcamento_capitulos(codigo, descricao)")
      .eq("orcamento_id", pacote.orcamento_id)
      .order("ordem", { ascending: true });
    if (eTA) throw new Error(eTA.message);

    const artigosOrd = (todosArtigos ?? []).map((a: any) => ({
      id: a.id,
      codigo: a.codigo,
      descricao: a.descricao,
      capitulo: a.capitulo?.descricao ?? null,
      capituloCodigo: a.capitulo?.codigo ?? null,
    }));
    const porId = new Map(artigosOrd.map((a) => [a.id, a]));

    function comVizinhos(idx: number): ArtigoComVizinhos {
      const base = artigosOrd[idx];
      return {
        ...base,
        vizinhosAntes: artigosOrd.slice(Math.max(0, idx - 2), idx),
        vizinhosDepois: artigosOrd.slice(idx + 1, idx + 3),
      };
    }

    // Auditoria 1: artigos que estão no pacote mas talvez não devessem
    const sinalizados: Array<{
      pacoteArtigoId: string;
      codigo: string | null;
      descricao: string | null;
      sugestao: string | null;
      confianca: number;
      motivo: string;
    }> = [];
    for (const pa of pacoteArtigos ?? []) {
      if (!pa.artigo_id || !porId.has(pa.artigo_id)) continue;
      const idx = artigosOrd.findIndex((a) => a.id === pa.artigo_id);
      const r = pertenceAoPacote(comVizinhos(idx), especialidade);
      if (!r.pertence) {
        sinalizados.push({
          pacoteArtigoId: pa.id,
          codigo: pa.codigo,
          descricao: pa.descricao,
          sugestao: r.sugestao,
          confianca: r.confianca,
          motivo: r.motivo,
        });
      }
    }

    // Auditoria 2: artigos do orçamento que deveriam estar e não estão
    const jaIncluidos = new Set((pacoteArtigos ?? []).map((p) => p.artigo_id).filter(Boolean));
    const sugeridos: Array<{
      artigoId: string;
      codigo: string | null;
      descricao: string | null;
      confianca: number;
      motivo: string;
    }> = [];
    for (let i = 0; i < artigosOrd.length; i++) {
      const a = artigosOrd[i];
      if (jaIncluidos.has(a.id)) continue;
      const r = pertenceAoPacote(comVizinhos(i), especialidade);
      if (r.pertence && r.confianca >= 0.8) {
        sugeridos.push({
          artigoId: a.id,
          codigo: a.codigo,
          descricao: a.descricao,
          confianca: r.confianca,
          motivo: r.motivo,
        });
      }
    }

    // Artigos tecnicamente incoerentes saem do pacote e vão para "Por Classificar".
    if (sinalizados.length > 0 && especialidade !== "Por Classificar") {
      const { data: destinoExistente, error: eDestino } = await supabase
        .from("procurement_pacotes")
        .select("id")
        .eq("orcamento_id", pacote.orcamento_id)
        .eq("especialidade", "Por Classificar")
        .maybeSingle();
      if (eDestino) throw new Error(eDestino.message);

      let destinoId = destinoExistente?.id as string | undefined;
      if (!destinoId) {
        const { data: novoDestino, error: eNovoDestino } = await supabase
          .from("procurement_pacotes")
          .insert({
            orcamento_id: pacote.orcamento_id,
            obra_id: pacote.obra_id ?? null,
            nome: "Por Classificar",
            especialidade: "Por Classificar",
            estado: "por_preparar",
            grupo_consulta: pacote.grupo_consulta ?? null,
          } as any)
          .select("id")
          .single();
        if (eNovoDestino) throw new Error(eNovoDestino.message);
        destinoId = novoDestino.id;
      }

      const ids = sinalizados.map((s) => s.pacoteArtigoId);
      await supabase
        .from("procurement_pacote_artigos")
        .update({
          pacote_id: destinoId,
          especialidade: "Por Classificar",
          sinalizado_revisao: true,
          confianca: 0.25,
          motivo: `Movido para Por Classificar por reanálise técnica do pacote ${especialidade}`,
        })
        .in("id", ids);
    } else if (sinalizados.length > 0) {
      const ids = sinalizados.map((s) => s.pacoteArtigoId);
      await supabase
        .from("procurement_pacote_artigos")
        .update({ sinalizado_revisao: true })
        .in("id", ids);
    }
    // Limpa flags dos que agora estão OK
    const idsOk = (pacoteArtigos ?? [])
      .filter((pa) => !sinalizados.some((s) => s.pacoteArtigoId === pa.id))
      .map((pa) => pa.id);
    if (idsOk.length > 0) {
      await supabase
        .from("procurement_pacote_artigos")
        .update({ sinalizado_revisao: false })
        .in("id", idsOk);
    }

    return { sinalizados, sugeridos, especialidade };
  });

// -----------------------------------------------------------------------------
// 4) Classificar artigos em lote (com aprendizagem + contexto)
//    Usado na criação de pacotes para devolver scores antes de inserir.
// -----------------------------------------------------------------------------

export const classificarLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orcamentoId: z.string(),
        especialidadeAlvo: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: artigos, error } = await supabase
      .from("orcamento_artigos")
      .select("id, codigo, descricao, ordem, capitulo:orcamento_capitulos(codigo, descricao)")
      .eq("orcamento_id", data.orcamentoId)
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);

    const lista = (artigos ?? []).map((a: any) => ({
      id: a.id,
      codigo: a.codigo,
      descricao: a.descricao,
      capitulo: a.capitulo?.descricao ?? null,
      capituloCodigo: a.capitulo?.codigo ?? null,
    }));

    // Carrega aprendizagem global para todos os hashes (uma única query)
    const normalizadas = Array.from(new Set(lista.map((a) => normalizar(a.descricao ?? ""))))
      .filter((s) => s.length >= 8);
    let aprendMap = new Map<string, { especialidade: string; n: number; total: number }>();
    if (normalizadas.length > 0) {
      const { data: aprendRows } = await supabase
        .from("classificacao_aprendizagem")
        .select("descricao_normalizada, especialidade_final")
        .in("descricao_normalizada", normalizadas);
      const agg = new Map<string, Map<string, number>>();
      for (const r of aprendRows ?? []) {
        const m = agg.get(r.descricao_normalizada) ?? new Map<string, number>();
        m.set(r.especialidade_final, (m.get(r.especialidade_final) ?? 0) + 1);
        agg.set(r.descricao_normalizada, m);
      }
      for (const [norm, m] of agg) {
        let topEsp = ""; let topN = 0; let total = 0;
        for (const [e, n] of m) { total += n; if (n > topN) { topEsp = e; topN = n; } }
        aprendMap.set(norm, { especialidade: topEsp, n: topN, total });
      }
    }

    const resultados = lista.map((a, idx) => {
      const norm = normalizar(a.descricao ?? "");
      const aprend = aprendMap.get(norm);
      if (aprend && aprend.n >= 2 && aprend.n / aprend.total >= 0.66) {
        return {
          id: a.id,
          especialidade: aprend.especialidade,
          confianca: Math.min(0.98, 0.75 + (aprend.n / aprend.total) * 0.2),
          motivo: `Aprendido com ${aprend.n} correções anteriores`,
          pertence: aprend.especialidade === data.especialidadeAlvo,
        };
      }
      const r = pertenceAoPacote(
        {
          ...a,
          vizinhosAntes: lista.slice(Math.max(0, idx - 2), idx),
          vizinhosDepois: lista.slice(idx + 1, idx + 3),
        },
        data.especialidadeAlvo,
      );
      const c = classificarComContexto(a);
      return {
        id: a.id,
        especialidade: c.especialidade,
        confianca: r.confianca,
        motivo: r.motivo,
        pertence: r.pertence,
      };
    });

    return resultados;
  });

export const ESPECIALIDADES_DISPONIVEIS = ESPECIALIDADES;
