import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  classificarLoteComIA,
  MODELO_IA,
  type ArtigoParaIA,
  type ClassificacaoIA,
  type SubempreitadaRef,
} from "./ia.server";
import {
  MAX_LOTES_CONCORRENTES,
  MAX_TENTATIVAS_LOTE,
  TAMANHO_LOTE_PADRAO,
  dividirEmLotes,
  esperaBackoff,
  idsPendentes,
  reconciliar,
  resumoCobertura,
  tamanhoRetentativa,
} from "./reconciliacao";

function normalizarTexto(t: string) {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

async function carregarClassificados(sb: any, orcamento_id: string): Promise<string[]> {
  const out: string[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from("consulta_ia_classificacoes")
      .select("artigo_id")
      .eq("orcamento_id", orcamento_id)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []).map((c: any) => c.artigo_id as string));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

/**
 * Regenera, de forma determinística, os lotes pendentes de uma execução:
 * lotes pendentes/falhados anteriores são substituídos pela diferença exata
 * entre os IDs do Mapa de Quantidades e os IDs já classificados. Os lotes
 * concluídos e as classificações existentes nunca são apagados.
 */
async function regenerarLotes(sb: any, run_id: string, orcamento_id: string, idsMQ: string[]) {
  const classificados = await carregarClassificados(sb, orcamento_id);
  const pendentes = idsPendentes(idsMQ, classificados);

  const { error: eDel } = await sb
    .from("consulta_ia_lotes")
    .delete()
    .eq("run_id", run_id)
    .in("estado", ["pendente", "falhado"]);
  if (eDel) throw new Error(eDel.message);

  const { data: existentes, error: eEx } = await sb
    .from("consulta_ia_lotes")
    .select("indice")
    .eq("run_id", run_id);
  if (eEx) throw new Error(eEx.message);
  let indice = (existentes ?? []).reduce((m: number, l: any) => Math.max(m, l.indice), -1) + 1;

  const lotes = dividirEmLotes(pendentes, TAMANHO_LOTE_PADRAO);
  if (lotes.length > 0) {
    const linhas = lotes.map((artigo_ids) => ({
      run_id,
      orcamento_id,
      indice: indice++,
      artigo_ids,
      estado: "pendente",
    }));
    for (let i = 0; i < linhas.length; i += 200) {
      const { error } = await sb.from("consulta_ia_lotes").insert(linhas.slice(i, i + 200));
      if (error) throw new Error(error.message);
    }
  }

  return { pendentes, classificados: classificados.length, lotes_pendentes: lotes.length };
}

/**
 * Passo 1 — prepara (ou retoma) a separação por IA.
 *
 * Reutiliza a execução em curso do mesmo Mapa de Quantidades em vez de criar
 * uma nova, nunca apaga classificações já persistidas e limita-se a recriar os
 * lotes pendentes a partir dos artigos ainda sem classificação.
 */
export const prepararSeparacaoConsultaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orcamento_id: string; obra_id: string | null }) =>
    z.object({ orcamento_id: z.string().uuid(), obra_id: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const artigos = await carregarArtigos(sb, data.orcamento_id);
    if (artigos.length === 0) throw new Error("Este Mapa de Quantidades não tem artigos lidos.");
    const idsMQ = artigos.map((a: any) => a.id as string);

    const { data: runs, error: eRuns } = await sb
      .from("consulta_ia_runs")
      .select("id, estado")
      .eq("orcamento_id", data.orcamento_id)
      .in("estado", ["em_curso", "incompleta"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (eRuns) throw new Error(eRuns.message);

    let run_id = runs?.[0]?.id as string | undefined;
    if (!run_id) {
      const { data: nova, error } = await sb
        .from("consulta_ia_runs")
        .insert({
          obra_id: data.obra_id,
          orcamento_id: data.orcamento_id,
          estado: "em_curso",
          modelo: MODELO_IA,
          total_artigos: idsMQ.length,
          user_id: context.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      run_id = nova.id as string;
    }

    const r = await regenerarLotes(sb, run_id!, data.orcamento_id, idsMQ);

    await sb
      .from("consulta_ia_runs")
      .update({
        estado: r.pendentes.length === 0 ? "concluido" : "em_curso",
        total_artigos: idsMQ.length,
        processados: r.classificados,
        concluido_em: r.pendentes.length === 0 ? new Date().toISOString() : null,
      })
      .eq("id", run_id!);

    return {
      run_id: run_id!,
      total_artigos: idsMQ.length,
      classificados: r.classificados,
      pendentes: r.pendentes.length,
      lotes_pendentes: r.lotes_pendentes,
      tamanho_lote: TAMANHO_LOTE_PADRAO,
    };
  });

type ContextoIA = {
  subs: SubempreitadaRef[];
  porCodigo: Map<string, SubempreitadaRef>;
  exemplosValidados: Array<{ descricao: string; codigo: string }>;
  biblioteca: Array<{ descricao: string; codigo: string }>;
};

async function carregarContexto(sb: any): Promise<ContextoIA> {
  const { data: subsRaw, error: eSubs } = await sb
    .from("subempreitadas")
    .select("id, codigo, nome, descricao")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  if (eSubs) throw new Error(eSubs.message);
  const subs = (subsRaw ?? []) as SubempreitadaRef[];

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

  return { subs, porCodigo: new Map(subs.map((s) => [s.codigo.toUpperCase(), s])), exemplosValidados, biblioteca };
}

function construirArtigoParaIA(todos: any[], indicePorId: Map<string, number>, id: string): ArtigoParaIA | null {
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
  };
}

/**
 * Persiste imediatamente as classificações válidas de uma resposta da IA.
 * Uma subempreitada proposta que não exista fica registada como sugestão para
 * revisão humana — o artigo nunca é descartado.
 */
async function persistirClassificacoes(
  sb: any,
  run_id: string,
  orcamento_id: string,
  ctx: ContextoIA,
  resultados: ClassificacaoIA[],
) {
  if (resultados.length === 0) return 0;
  const linhas = resultados.map((r) => {
    const sub = r.subempreitada_codigo ? ctx.porCodigo.get(r.subempreitada_codigo.toUpperCase()) : undefined;
    const codigoInvalido = Boolean(r.subempreitada_codigo && !sub);
    return {
      run_id,
      orcamento_id,
      artigo_id: r.artigo_id,
      subempreitada_id: sub?.id ?? null,
      trabalho_principal: r.trabalho_principal || null,
      confianca: r.confianca,
      justificacao:
        r.justificacao +
        (codigoInvalido ? ` (a IA indicou um código inexistente: ${r.subempreitada_codigo})` : ""),
      necessita_revisao: r.necessita_revisao || !sub || r.confianca < 0.7,
      sugestao_nova_subempreitada:
        r.sugestao_nova_subempreitada ?? (codigoInvalido ? r.subempreitada_codigo : null),
      validado_manual: false,
    };
  });
  const { error } = await sb
    .from("consulta_ia_classificacoes")
    .upsert(linhas, { onConflict: "orcamento_id,artigo_id", ignoreDuplicates: false });
  if (error) throw new Error(error.message);
  return linhas.length;
}

/**
 * Processa um conjunto de artigos com reconciliação exata por ID:
 * grava o que a IA devolveu e reencaminha apenas os IDs ausentes, primeiro em
 * lotes menores e por fim individualmente (até 3 tentativas com recuo).
 */
async function processarConjunto(
  sb: any,
  run_id: string,
  orcamento_id: string,
  ctx: ContextoIA,
  todos: any[],
  indicePorId: Map<string, number>,
  ids: string[],
): Promise<{ guardados: number; ausentes: string[]; erros: string[] }> {
  let pendentes = ids.filter((id) => indicePorId.has(id));
  const erros: string[] = [];
  let guardados = 0;
  let tamanho = pendentes.length;

  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_LOTE && pendentes.length > 0; tentativa++) {
    if (tentativa > 0) {
      tamanho = tamanhoRetentativa(tentativa - 1, tamanho);
      await dormir(esperaBackoff(tentativa - 1));
    }
    const proximos: string[] = [];
    for (const grupo of dividirEmLotes(pendentes, tamanho)) {
      const artigos = grupo
        .map((id) => construirArtigoParaIA(todos, indicePorId, id))
        .filter(Boolean) as ArtigoParaIA[];
      if (artigos.length === 0) continue;
      try {
        const resultados = await classificarLoteComIA({
          artigos,
          subempreitadas: ctx.subs,
          exemplosValidados: ctx.exemplosValidados,
          biblioteca: ctx.biblioteca,
        });
        const r = reconciliar(grupo, resultados);
        guardados += await persistirClassificacoes(sb, run_id, orcamento_id, ctx, r.validos);
        proximos.push(...r.ausentes);
      } catch (e: any) {
        erros.push(e?.message ?? "Falha desconhecida da IA.");
        proximos.push(...grupo);
      }
    }
    pendentes = proximos;
  }

  return { guardados, ausentes: pendentes, erros };
}

/**
 * Passo 2 — execução incremental e idempotente.
 *
 * Cada chamada reclama até dois lotes pendentes, processa-os e persiste tudo
 * de imediato. Fechar ou recarregar a página não perde trabalho: a chamada
 * seguinte continua a partir do estado guardado no servidor.
 */
export const processarLotesConsultaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { run_id: string; orcamento_id: string; max_lotes?: number }) =>
    z
      .object({
        run_id: z.string().uuid(),
        orcamento_id: z.string().uuid(),
        max_lotes: z.number().int().min(1).max(MAX_LOTES_CONCORRENTES).optional().default(MAX_LOTES_CONCORRENTES),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    // Recupera lotes que tenham ficado presos em execução (ex.: página fechada).
    const limite = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await sb
      .from("consulta_ia_lotes")
      .update({ estado: "pendente" })
      .eq("run_id", data.run_id)
      .eq("estado", "em_execucao")
      .lt("iniciado_em", limite);

    const { data: candidatos, error: eCand } = await sb
      .from("consulta_ia_lotes")
      .select("id, indice, artigo_ids, tentativas")
      .eq("run_id", data.run_id)
      .eq("estado", "pendente")
      .order("indice", { ascending: true })
      .limit(data.max_lotes);
    if (eCand) throw new Error(eCand.message);

    // Reclama cada lote de forma atómica — só avança quem mudar o estado.
    const reclamados: any[] = [];
    for (const c of candidatos ?? []) {
      const { data: upd, error } = await sb
        .from("consulta_ia_lotes")
        .update({ estado: "em_execucao", iniciado_em: new Date().toISOString(), tentativas: (c.tentativas ?? 0) + 1 })
        .eq("id", c.id)
        .eq("estado", "pendente")
        .select("id, artigo_ids, tentativas");
      if (error) throw new Error(error.message);
      if (upd && upd.length > 0) reclamados.push(upd[0]);
    }

    if (reclamados.length === 0) {
      const est = await calcularEstado(sb, data.orcamento_id);
      return { run_id: data.run_id, lotes_processados: 0, guardados: 0, ausentes: 0, estado: est };
    }

    const todos = await carregarArtigos(sb, data.orcamento_id);
    const indicePorId = new Map<string, number>(todos.map((a: any, i: number) => [a.id, i]));
    const ctx = await carregarContexto(sb);

    let guardadosTotal = 0;
    let ausentesTotal = 0;

    const resultados = await Promise.all(
      reclamados.map((lote) =>
        processarConjunto(sb, data.run_id, data.orcamento_id, ctx, todos, indicePorId, lote.artigo_ids as string[])
          .then((r) => ({ lote, r, erro: null as string | null }))
          .catch((e: any) => ({
            lote,
            r: { guardados: 0, ausentes: lote.artigo_ids as string[], erros: [] },
            erro: e?.message ?? "Falha ao processar o lote.",
          })),
      ),
    );

    for (const { lote, r, erro } of resultados) {
      guardadosTotal += r.guardados;
      ausentesTotal += r.ausentes.length;
      const concluido = r.ausentes.length === 0;
      await sb
        .from("consulta_ia_lotes")
        .update({
          estado: concluido ? "concluido" : "falhado",
          classificados: r.guardados,
          ausentes: r.ausentes.length,
          erro: concluido ? null : (erro ?? r.erros[0] ?? `${r.ausentes.length} artigos não foram devolvidos pela IA.`),
          concluido_em: new Date().toISOString(),
        })
        .eq("id", lote.id);
    }

    const est = await calcularEstado(sb, data.orcamento_id);
    await sb
      .from("consulta_ia_runs")
      .update({
        processados: est.classificados,
        atribuidos: est.com_subempreitada,
        revisao: est.necessitam_revisao,
        estado: est.completo ? "concluido" : "em_curso",
        concluido_em: est.completo ? new Date().toISOString() : null,
      })
      .eq("id", data.run_id);

    return {
      run_id: data.run_id,
      lotes_processados: reclamados.length,
      guardados: guardadosTotal,
      ausentes: ausentesTotal,
      estado: est,
    };
  });

async function calcularEstado(sb: any, orcamento_id: string) {
  const artigos = await carregarArtigos(sb, orcamento_id);
  const idsMQ = artigos.map((a: any) => a.id as string);

  const { data: cls, error } = await sb
    .from("consulta_ia_classificacoes")
    .select("artigo_id, subempreitada_id, necessita_revisao, validado_manual, sugestao_nova_subempreitada")
    .eq("orcamento_id", orcamento_id);
  if (error) throw new Error(error.message);

  const classificadosIds = new Set((cls ?? []).map((c: any) => c.artigo_id as string));
  const emFalta = idsMQ.filter((id) => !classificadosIds.has(id));

  const { data: lotes } = await sb
    .from("consulta_ia_lotes")
    .select("estado, artigo_ids, erro")
    .eq("orcamento_id", orcamento_id);

  const idsFalhados = new Set<string>();
  const idsPendentesLote = new Set<string>();
  let lotes_pendentes = 0;
  let lotes_concluidos = 0;
  let lotes_falhados = 0;
  const errosLotes: string[] = [];
  for (const l of lotes ?? []) {
    if (l.estado === "concluido") lotes_concluidos++;
    else if (l.estado === "falhado") {
      lotes_falhados++;
      if (l.erro) errosLotes.push(l.erro as string);
      for (const id of (l.artigo_ids ?? []) as string[]) if (!classificadosIds.has(id)) idsFalhados.add(id);
    } else {
      lotes_pendentes++;
      for (const id of (l.artigo_ids ?? []) as string[]) if (!classificadosIds.has(id)) idsPendentesLote.add(id);
    }
  }
  for (const id of idsFalhados) idsPendentesLote.delete(id);
  // Artigos sem qualquer lote associado contam como pendentes por planear.
  const semLote = emFalta.filter((id) => !idsFalhados.has(id) && !idsPendentesLote.has(id));
  for (const id of semLote) idsPendentesLote.add(id);

  const resumo = resumoCobertura({
    total: idsMQ.length,
    classificados: classificadosIds.size,
    pendentes: idsPendentesLote.size,
    falhados: idsFalhados.size,
  });

  return {
    orcamento_id,
    ...resumo,
    artigos_em_falta: emFalta,
    artigos_falhados: [...idsFalhados],
    com_subempreitada: (cls ?? []).filter((c: any) => c.subempreitada_id).length,
    sem_subempreitada: (cls ?? []).filter((c: any) => !c.subempreitada_id).length,
    necessitam_revisao: (cls ?? []).filter((c: any) => c.necessita_revisao && !c.validado_manual).length,
    validados: (cls ?? []).filter((c: any) => c.validado_manual).length,
    duplicados: (cls ?? []).length - classificadosIds.size,
    lotes_pendentes,
    lotes_concluidos,
    lotes_falhados,
    erros_lotes: [...new Set(errosLotes)].slice(0, 5),
    sugestoes_novas: [...new Set((cls ?? []).map((c: any) => c.sugestao_nova_subempreitada).filter(Boolean) as string[])],
  };
}

/** Passo 3 — controlo de qualidade e retoma. Nunca marca concluída com artigos em falta. */
export const estadoSeparacaoConsultaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orcamento_id: string }) => z.object({ orcamento_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const est = await calcularEstado(sb, data.orcamento_id);
    const { data: runs } = await sb
      .from("consulta_ia_runs")
      .select("id, estado, created_at")
      .eq("orcamento_id", data.orcamento_id)
      .order("created_at", { ascending: false })
      .limit(1);
    const run = runs?.[0];
    return {
      ...est,
      run_id: (run?.id as string) ?? null,
      run_estado: est.completo ? "concluida" : est.classificados > 0 ? "incompleta" : (run?.estado ?? null),
      retomavel: !est.completo && est.total > 0,
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
      // Cardinalidade: um artigo validado fica com exatamente uma subempreitada.
      if (!destino) throw new Error("Escolha uma subempreitada antes de confirmar os artigos selecionados.");
      const { error } = await sb
        .from("consulta_ia_classificacoes")
        .update({
          subempreitada_id: destino,
          validado_manual: true,
          necessita_revisao: false,
          validado_por: context.userId,
          validado_em: new Date().toISOString(),
          confianca: 1,
        })
        .eq("orcamento_id", data.orcamento_id)
        .eq("artigo_id", (c as any).artigo_id);
      if (error) throw new Error(error.message);

      const art = Array.isArray((c as any).artigo) ? (c as any).artigo[0] : (c as any).artigo;
      const descricao: string = art?.descricao ?? "";
      if (descricao.trim().length >= 25) {
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
 * subempreitada. Bloqueado enquanto existirem artigos por classificar.
 */
export const aplicarSeparacaoConsultaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orcamento_id: string }) => z.object({ orcamento_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const est = await calcularEstado(sb, data.orcamento_id);
    if (!est.completo) {
      throw new Error(
        `Ainda faltam ${est.pendentes + est.falhados} artigos por classificar. Continue a separação antes de organizar o Mapa de Quantidades.`,
      );
    }

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
