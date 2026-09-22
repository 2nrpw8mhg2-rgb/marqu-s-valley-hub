import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classificarLoteComIA, MODELO_IA, type ArtigoParaIA, type SubempreitadaRef } from "./ia.server";
import { TAMANHO_LOTE_IA } from "./tipos";

function normalizarTexto(t: string) {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function carregarArtigos(sb: any, orcamento_id: string) {
  const out: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from("orcamento_artigos")
      .select(
        "id, codigo, descricao, unidade, quantidade, ordem, capitulo_id, capitulo:orcamento_capitulos(codigo, descricao)",
      )
      .eq("orcamento_id", orcamento_id)
      .order("ordem", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

/**
 * Passo 1 — prepara uma nova separação por IA.
 * Mantém intactas as classificações já validadas por humanos e devolve os lotes
 * de artigos que ainda precisam de ser analisados pela IA.
 */
export const iniciarSeparacaoConsultaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orcamento_id: string; obra_id: string | null; reprocessar_validados?: boolean }) =>
    z
      .object({
        orcamento_id: z.string().uuid(),
        obra_id: z.string().uuid().nullable(),
        reprocessar_validados: z.boolean().optional().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const artigos = await carregarArtigos(sb, data.orcamento_id);
    if (artigos.length === 0) throw new Error("Este Mapa de Quantidades não tem artigos lidos.");

    const { data: existentes, error: eExist } = await sb
      .from("consulta_ia_classificacoes")
      .select("artigo_id, validado_manual")
      .eq("orcamento_id", data.orcamento_id);
    if (eExist) throw new Error(eExist.message);

    const validados = new Set(
      (existentes ?? []).filter((c: any) => c.validado_manual && !data.reprocessar_validados).map((c: any) => c.artigo_id),
    );

    // Limpa resultados anteriores não validados — a IA volta a analisá-los.
    const aLimpar = (existentes ?? []).filter((c: any) => !validados.has(c.artigo_id)).map((c: any) => c.artigo_id);
    if (aLimpar.length > 0) {
      for (let i = 0; i < aLimpar.length; i += 500) {
        const { error } = await sb
          .from("consulta_ia_classificacoes")
          .delete()
          .eq("orcamento_id", data.orcamento_id)
          .in("artigo_id", aLimpar.slice(i, i + 500));
        if (error) throw new Error(error.message);
      }
    }

    const pendentes = artigos.filter((a) => !validados.has(a.id)).map((a) => a.id);

    const { data: run, error: eRun } = await sb
      .from("consulta_ia_runs")
      .insert({
        obra_id: data.obra_id,
        orcamento_id: data.orcamento_id,
        estado: "em_curso",
        modelo: MODELO_IA,
        total_artigos: artigos.length,
        processados: validados.size,
        user_id: context.userId,
      })
      .select("id")
      .single();
    if (eRun) throw new Error(eRun.message);

    const lotes: string[][] = [];
    for (let i = 0; i < pendentes.length; i += TAMANHO_LOTE_IA) {
      lotes.push(pendentes.slice(i, i + TAMANHO_LOTE_IA));
    }

    return {
      run_id: run.id as string,
      total_artigos: artigos.length,
      ja_validados: validados.size,
      lotes,
    };
  });

/**
 * Passo 2 — analisa um lote de artigos com IA e grava o resultado.
 * Devolve os artigos que ficaram por classificar para poderem ser repetidos.
 */
export const processarLoteConsultaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { run_id: string; orcamento_id: string; artigo_ids: string[] }) =>
    z
      .object({
        run_id: z.string().uuid(),
        orcamento_id: z.string().uuid(),
        artigo_ids: z.array(z.string().uuid()).min(1).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const todos = await carregarArtigos(sb, data.orcamento_id);
    const indicePorId = new Map<string, number>(todos.map((a: any, i: number) => [a.id, i]));

    const { data: subsRaw, error: eSubs } = await sb
      .from("subempreitadas")
      .select("id, codigo, nome, descricao")
      .eq("ativo", true)
      .order("ordem", { ascending: true });
    if (eSubs) throw new Error(eSubs.message);
    const subs = (subsRaw ?? []) as SubempreitadaRef[];
    const porCodigo = new Map(subs.map((s) => [s.codigo.toUpperCase(), s]));

    const { data: exemplosRaw } = await sb
      .from("consulta_ia_exemplos")
      .select("descricao, subempreitada:subempreitadas(codigo)")
      .order("created_at", { ascending: false })
      .limit(80);
    const exemplosValidados = (exemplosRaw ?? [])
      .map((e: any) => ({ descricao: e.descricao as string, codigo: e.subempreitada?.codigo as string }))
      .filter((e: any) => e.codigo);

    const { data: bibliotecaRaw } = await sb
      .from("biblioteca_artigos")
      .select("descricao, subempreitada:subempreitadas!biblioteca_artigos_subempreitada_principal_id_fkey(codigo)")
      .eq("ativo", true)
      .not("subempreitada_principal_id", "is", null)
      .limit(150);
    const biblioteca = (bibliotecaRaw ?? [])
      .map((b: any) => ({ descricao: b.descricao as string, codigo: b.subempreitada?.codigo as string }))
      .filter((b: any) => b.codigo);

    const artigosLote: ArtigoParaIA[] = data.artigo_ids
      .map((id) => {
        const idx = indicePorId.get(id);
        if (idx === undefined) return null;
        const a: any = todos[idx];
        const cap = Array.isArray(a.capitulo) ? a.capitulo[0] : a.capitulo;
        const capCodigo = (cap?.codigo ?? "").trim();
        const raizCodigo = capCodigo.split(".")[0];
        const raiz: any = todos.find((o: any) => {
          const c = Array.isArray(o.capitulo) ? o.capitulo[0] : o.capitulo;
          return (c?.codigo ?? "").trim() === raizCodigo;
        });
        const raizCap = raiz ? (Array.isArray(raiz.capitulo) ? raiz.capitulo[0] : raiz.capitulo) : null;
        const vizinhos = [todos[idx - 1], todos[idx + 1]]
          .filter(Boolean)
          .map((v: any) => `${v.codigo ?? ""} ${v.descricao}`.trim());
        return {
          id: a.id,
          codigo: a.codigo,
          descricao: a.descricao,
          unidade: a.unidade,
          quantidade: Number(a.quantidade ?? 0),
          capitulo_codigo: cap?.codigo ?? null,
          capitulo_descricao: cap?.descricao ?? null,
          capitulo_raiz: raizCap?.descricao ?? null,
          vizinhos,
        } as ArtigoParaIA;
      })
      .filter(Boolean) as ArtigoParaIA[];

    if (artigosLote.length === 0) throw new Error("Nenhum artigo válido neste lote.");

    const resultados = await classificarLoteComIA({
      artigos: artigosLote,
      subempreitadas: subs,
      exemplosValidados,
      biblioteca,
    });

    const porArtigo = new Map(resultados.map((r) => [r.artigo_id, r]));
    const linhas: any[] = [];
    const falhados: string[] = [];
    let atribuidos = 0;
    let revisao = 0;

    for (const a of artigosLote) {
      const r = porArtigo.get(a.id);
      if (!r) {
        falhados.push(a.id);
        continue;
      }
      const sub = r.subempreitada_codigo ? porCodigo.get(r.subempreitada_codigo.toUpperCase()) : undefined;
      const precisaRevisao = r.necessita_revisao || !sub || r.confianca < 0.7;
      if (sub) atribuidos++;
      if (precisaRevisao) revisao++;
      linhas.push({
        run_id: data.run_id,
        orcamento_id: data.orcamento_id,
        artigo_id: a.id,
        subempreitada_id: sub?.id ?? null,
        trabalho_principal: r.trabalho_principal || null,
        confianca: r.confianca,
        justificacao:
          r.justificacao +
          (!sub && r.subempreitada_codigo ? ` (a IA indicou um código inexistente: ${r.subempreitada_codigo})` : ""),
        necessita_revisao: precisaRevisao,
        sugestao_nova_subempreitada: r.sugestao_nova_subempreitada,
        validado_manual: false,
      });
    }

    if (linhas.length > 0) {
      const { error } = await sb
        .from("consulta_ia_classificacoes")
        .upsert(linhas, { onConflict: "orcamento_id,artigo_id" });
      if (error) throw new Error(error.message);
    }

    const { count } = await sb
      .from("consulta_ia_classificacoes")
      .select("id", { count: "exact", head: true })
      .eq("orcamento_id", data.orcamento_id);
    await sb
      .from("consulta_ia_runs")
      .update({ processados: count ?? 0 })
      .eq("id", data.run_id);

    return { run_id: data.run_id, processados: linhas.length, atribuidos, revisao, falhados, erro: null };
  });

/** Passo 3 — controlo de qualidade da separação. */
export const estadoSeparacaoConsultaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orcamento_id: string }) => z.object({ orcamento_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const artigos = await carregarArtigos(sb, data.orcamento_id);
    const { data: cls, error } = await sb
      .from("consulta_ia_classificacoes")
      .select("artigo_id, subempreitada_id, necessita_revisao, validado_manual, sugestao_nova_subempreitada")
      .eq("orcamento_id", data.orcamento_id);
    if (error) throw new Error(error.message);

    const vistos = new Set<string>();
    let duplicados = 0;
    for (const c of cls ?? []) {
      if (vistos.has(c.artigo_id)) duplicados++;
      vistos.add(c.artigo_id);
    }
    const artigosEmFalta = artigos.filter((a: any) => !vistos.has(a.id)).map((a: any) => a.id);
    const semSub = (cls ?? []).filter((c: any) => !c.subempreitada_id).length;
    const revisao = (cls ?? []).filter((c: any) => c.necessita_revisao && !c.validado_manual).length;
    const validados = (cls ?? []).filter((c: any) => c.validado_manual).length;
    const sugestoes = [
      ...new Set((cls ?? []).map((c: any) => c.sugestao_nova_subempreitada).filter(Boolean) as string[]),
    ];

    return {
      orcamento_id: data.orcamento_id,
      total_artigos: artigos.length,
      classificados: vistos.size,
      em_falta: artigosEmFalta.length,
      artigos_em_falta: artigosEmFalta,
      sem_subempreitada: semSub,
      necessitam_revisao: revisao,
      validados,
      duplicados,
      subempreitadas_invalidas: semSub,
      sugestoes_novas: sugestoes,
      completo: artigosEmFalta.length === 0 && artigos.length > 0,
    };
  });

/** Revisão humana — confirma ou corrige um ou vários artigos de uma vez. */
export const validarClassificacoesConsultaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orcamento_id: string; artigo_ids: string[]; subempreitada_id: string | null }) =>
    z
      .object({
        orcamento_id: z.string().uuid(),
        artigo_ids: z.array(z.string().uuid()).min(1),
        subempreitada_id: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: atuais, error: eAtuais } = await sb
      .from("consulta_ia_classificacoes")
      .select("artigo_id, subempreitada_id, trabalho_principal, artigo:orcamento_artigos(descricao)")
      .eq("orcamento_id", data.orcamento_id)
      .in("artigo_id", data.artigo_ids);
    if (eAtuais) throw new Error(eAtuais.message);

    for (const c of atuais ?? []) {
      const destino = data.subempreitada_id ?? (c as any).subempreitada_id;
      const { error } = await sb
        .from("consulta_ia_classificacoes")
        .update({
          subempreitada_id: destino,
          validado_manual: true,
          necessita_revisao: false,
          validado_por: context.userId,
          validado_em: new Date().toISOString(),
          confianca: destino ? 1 : 0,
        })
        .eq("orcamento_id", data.orcamento_id)
        .eq("artigo_id", (c as any).artigo_id);
      if (error) throw new Error(error.message);

      const art = Array.isArray((c as any).artigo) ? (c as any).artigo[0] : (c as any).artigo;
      const descricao: string = art?.descricao ?? "";
      if (destino && descricao.trim().length >= 25) {
        await sb.from("consulta_ia_exemplos").insert({
          descricao: descricao.slice(0, 1000),
          descricao_normalizada: normalizarTexto(descricao).slice(0, 1000),
          subempreitada_id: destino,
          trabalho_principal: (c as any).trabalho_principal ?? null,
          user_id: context.userId,
        });
      }
    }
    return { ok: true, atualizados: (atuais ?? []).length };
  });

/**
 * Aplica a separação validada ao Mapa de Quantidades, deixando-o organizado por
 * subempreitada e pronto para gerar os mapas individuais de consulta.
 */
export const aplicarSeparacaoConsultaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orcamento_id: string }) => z.object({ orcamento_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: cls, error } = await sb
      .from("consulta_ia_classificacoes")
      .select("artigo_id, subempreitada_id, confianca, justificacao, validado_manual")
      .eq("orcamento_id", data.orcamento_id);
    if (error) throw new Error(error.message);

    let aplicados = 0;
    for (const c of cls ?? []) {
      const { error: eUp } = await sb
        .from("orcamento_artigos")
        .update({
          subempreitada_id: (c as any).subempreitada_id,
          subempreitada_sugerida_id: (c as any).subempreitada_id,
          subempreitada_confianca: (c as any).confianca,
          subempreitada_origem: (c as any).validado_manual ? "manual" : "ia_consultas",
          subempreitada_razao: (c as any).justificacao,
          subempreitada_validada_manual: Boolean((c as any).validado_manual),
        })
        .eq("id", (c as any).artigo_id);
      if (eUp) throw new Error(eUp.message);
      aplicados++;
    }
    return { ok: true, aplicados };
  });
