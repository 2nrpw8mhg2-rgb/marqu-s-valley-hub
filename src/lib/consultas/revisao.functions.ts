import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SnapshotRevisao } from "./revisao";

function normalizarTexto(t: string) {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Atribuição manual de subempreitada (individual ou em massa).
 *
 * Idempotente: repetir a mesma `operacao_id` não cria registos duplicados de
 * auditoria nem de aprendizagem. Cada artigo fica com exatamente uma
 * subempreitada; uma subempreitada pode receber qualquer número de artigos.
 */
type EntradaAtribuicao = {
  orcamento_id: string;
  artigo_ids: string[];
  subempreitada_id: string;
  operacao_id: string;
};

/**
 * Núcleo da atribuição manual, partilhado pela atribuição direta e pela
 * aceitação de sugestões de nova subempreitada.
 */
async function executarAtribuicao(sb: any, userId: string, data: EntradaAtribuicao) {
  {
    const agora = new Date().toISOString();

    const { data: atuais, error: eAtuais } = await sb
      .from("consulta_ia_classificacoes")
      .select(
        "id, run_id, artigo_id, subempreitada_id, subempreitada_ia_id, confianca, confianca_ia, trabalho_principal, necessita_revisao, validado_manual, sugestao_nova_subempreitada, artigo:orcamento_artigos(codigo, descricao)",
      )
      .eq("orcamento_id", data.orcamento_id)
      .in("artigo_id", data.artigo_ids);
    if (eAtuais) throw new Error(eAtuais.message);
    if (!atuais || atuais.length === 0)
      throw new Error("Estes artigos ainda não têm classificação para corrigir.");

    const auditorias: any[] = [];
    const exemplos: any[] = [];

    for (const c of atuais as any[]) {
      const art = Array.isArray(c.artigo) ? c.artigo[0] : c.artigo;
      const subIA = c.subempreitada_ia_id ?? c.subempreitada_id ?? null;
      const confIA = c.confianca_ia ?? c.confianca ?? 0;

      const estado_anterior: SnapshotRevisao = {
        artigo_id: c.artigo_id,
        subempreitada_id: c.subempreitada_id ?? null,
        confianca: Number(c.confianca ?? 0),
        necessita_revisao: Boolean(c.necessita_revisao),
        validado_manual: Boolean(c.validado_manual),
        sugestao_nova_subempreitada: c.sugestao_nova_subempreitada ?? null,
      };

      const { error: eUp } = await sb
        .from("consulta_ia_classificacoes")
        .update({
          subempreitada_id: data.subempreitada_id,
          // A sugestão e a confiança originais da IA nunca se perdem.
          subempreitada_ia_id: subIA,
          confianca_ia: confIA,
          confianca: 1,
          necessita_revisao: false,
          validado_manual: true,
          validado_por: userId,
          validado_em: agora,
        })
        .eq("orcamento_id", data.orcamento_id)
        .eq("artigo_id", c.artigo_id);
      if (eUp) throw new Error(eUp.message);

      // Mantém código, descrição, unidade, quantidade e IDs originais do MQ.
      const { error: eArt } = await sb
        .from("orcamento_artigos")
        .update({
          subempreitada_id: data.subempreitada_id,
          subempreitada_confianca: 1,
          subempreitada_origem: "manual",
          subempreitada_validada_manual: true,
        })
        .eq("id", c.artigo_id);
      if (eArt) throw new Error(eArt.message);

      auditorias.push({
        operacao_id: data.operacao_id,
        orcamento_id: data.orcamento_id,
        run_id: c.run_id ?? null,
        artigo_id: c.artigo_id,
        codigo_original: art?.codigo ?? null,
        descricao_original: art?.descricao ?? "",
        subempreitada_ia_id: subIA,
        sugestao_nova_subempreitada: c.sugestao_nova_subempreitada ?? null,
        confianca_ia: confIA,
        subempreitada_atribuida_id: data.subempreitada_id,
        estado_anterior,
        user_id: userId,
      });

      const descricao: string = art?.descricao ?? "";
      if (descricao.trim().length >= 25) {
        exemplos.push({
          descricao: descricao.slice(0, 1000),
          descricao_normalizada: normalizarTexto(descricao).slice(0, 1000),
          subempreitada_id: data.subempreitada_id,
          trabalho_principal: c.trabalho_principal ?? null,
          user_id: userId,
        });
      }
    }

    if (auditorias.length > 0) {
      const { error } = await sb
        .from("consulta_ia_revisao_auditoria")
        .upsert(auditorias, { onConflict: "operacao_id,artigo_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }

    // Aprendizagem validada — exemplos para classificações futuras, sem promover
    // automaticamente nada para a Biblioteca Mestra.
    for (const ex of exemplos) {
      const { data: jaExiste } = await sb
        .from("consulta_ia_exemplos")
        .select("id")
        .eq("descricao_normalizada", ex.descricao_normalizada)
        .eq("subempreitada_id", ex.subempreitada_id)
        .limit(1);
      if (!jaExiste || jaExiste.length === 0) await sb.from("consulta_ia_exemplos").insert(ex);
    }

    return { ok: true, operacao_id: data.operacao_id, atribuidos: auditorias.length };
  }
}

/**
 * Atribuição manual de subempreitada (individual ou em massa).
 *
 * Idempotente: repetir a mesma `operacao_id` não cria registos duplicados.
 */
export const atribuirSubempreitadaManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { orcamento_id: string; artigo_ids: string[]; subempreitada_id: string; operacao_id: string }) =>
      z
        .object({
          orcamento_id: z.string().uuid(),
          artigo_ids: z.array(z.string().uuid()).min(1),
          subempreitada_id: z.string().uuid(),
          operacao_id: z.string().uuid(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => executarAtribuicao(context.supabase, context.userId, data));

/**
 * Aceita uma sugestão de nova subempreitada (ou cria uma manualmente a partir
 * do seletor): normaliza o nome, reutiliza a equivalente já existente e, na
 * mesma operação, atribui os artigos indicados.
 *
 * A criação é feita por uma operação transacional na base de dados, pelo que
 * cliques simultâneos nunca geram duplicados. Não promove nada para a
 * Biblioteca Mestra: fica registada com origem «sugestao_ia_validada».
 */
export const aceitarSugestaoSubempreitada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      orcamento_id: string;
      artigo_ids: string[];
      nome: string;
      codigo?: string | null;
      operacao_id: string;
      origem?: string;
    }) =>
      z
        .object({
          orcamento_id: z.string().uuid(),
          artigo_ids: z.array(z.string().uuid()).min(1),
          nome: z.string().trim().min(2).max(120),
          codigo: z.string().trim().max(20).nullish(),
          operacao_id: z.string().uuid(),
          origem: z.string().trim().max(40).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const { data: criada, error } = await sb.rpc("criar_ou_obter_subempreitada", {
      _nome: data.nome,
      _codigo: data.codigo ?? undefined,
      _origem: data.origem ?? "sugestao_ia_validada",
    });
    if (error) throw new Error(error.message);

    const sub = Array.isArray(criada) ? criada[0] : criada;
    if (!sub?.id) throw new Error("Não foi possível criar ou encontrar a subempreitada.");

    const resultado = await executarAtribuicao(sb, context.userId, {
      orcamento_id: data.orcamento_id,
      artigo_ids: data.artigo_ids,
      subempreitada_id: sub.id as string,
      operacao_id: data.operacao_id,
    });

    return {
      ...resultado,
      subempreitada: { id: sub.id as string, codigo: sub.codigo as string, nome: sub.nome as string },
      criada: Boolean(sub.criada),
    };
  });

/**
 * Rejeita a sugestão da IA sem validar o artigo: regista a rejeição para
 * auditoria e o artigo permanece em «A Rever» até receber uma subempreitada.
 */
export const rejeitarSugestaoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orcamento_id: string; artigo_id: string }) =>
    z.object({ orcamento_id: z.string().uuid(), artigo_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const { data: atual, error } = await sb
      .from("consulta_ia_classificacoes")
      .select("run_id, subempreitada_ia_id, subempreitada_id, confianca_ia, confianca, sugestao_nova_subempreitada")
      .eq("orcamento_id", data.orcamento_id)
      .eq("artigo_id", data.artigo_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!atual) throw new Error("Este artigo ainda não tem classificação da IA.");

    const c = atual as any;
    const { error: eIns } = await sb.from("consulta_ia_sugestoes_rejeitadas").insert({
      orcamento_id: data.orcamento_id,
      artigo_id: data.artigo_id,
      run_id: c.run_id ?? null,
      sugestao: c.sugestao_nova_subempreitada ?? null,
      subempreitada_ia_id: c.subempreitada_ia_id ?? c.subempreitada_id ?? null,
      confianca_ia: c.confianca_ia ?? c.confianca ?? 0,
      user_id: context.userId,
    });
    if (eIns) throw new Error(eIns.message);

    const { error: eUp } = await sb
      .from("consulta_ia_classificacoes")
      .update({
        sugestao_nova_subempreitada: null,
        necessita_revisao: true,
        validado_manual: false,
      })
      .eq("orcamento_id", data.orcamento_id)
      .eq("artigo_id", data.artigo_id);
    if (eUp) throw new Error(eUp.message);

    return { ok: true };
  });

/** Desfaz uma atribuição manual, repondo atomicamente os valores anteriores. */
export const desfazerAtribuicaoManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orcamento_id: string; operacao_id: string }) =>
    z.object({ orcamento_id: z.string().uuid(), operacao_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const { data: registos, error } = await sb
      .from("consulta_ia_revisao_auditoria")
      .select("artigo_id, estado_anterior, subempreitada_atribuida_id, descricao_original")
      .eq("orcamento_id", data.orcamento_id)
      .eq("operacao_id", data.operacao_id);
    if (error) throw new Error(error.message);
    if (!registos || registos.length === 0) return { ok: true, revertidos: 0 };

    for (const r of registos as any[]) {
      const ant = (r.estado_anterior ?? {}) as SnapshotRevisao;
      const { error: eUp } = await sb
        .from("consulta_ia_classificacoes")
        .update({
          subempreitada_id: ant.subempreitada_id ?? null,
          confianca: ant.confianca ?? 0,
          necessita_revisao: ant.necessita_revisao ?? true,
          validado_manual: ant.validado_manual ?? false,
          sugestao_nova_subempreitada: ant.sugestao_nova_subempreitada ?? null,
          validado_por: null,
          validado_em: null,
        })
        .eq("orcamento_id", data.orcamento_id)
        .eq("artigo_id", r.artigo_id);
      if (eUp) throw new Error(eUp.message);

      await sb
        .from("orcamento_artigos")
        .update({
          subempreitada_id: ant.subempreitada_id ?? null,
          subempreitada_confianca: ant.confianca ?? 0,
          subempreitada_origem: ant.subempreitada_id ? "ia_consultas" : null,
          subempreitada_validada_manual: false,
        })
        .eq("id", r.artigo_id);

      const norm = normalizarTexto(r.descricao_original ?? "").slice(0, 1000);
      if (norm)
        await sb
          .from("consulta_ia_exemplos")
          .delete()
          .eq("descricao_normalizada", norm)
          .eq("subempreitada_id", r.subempreitada_atribuida_id)
          .eq("user_id", context.userId);
    }

    const { error: eDel } = await sb
      .from("consulta_ia_revisao_auditoria")
      .delete()
      .eq("orcamento_id", data.orcamento_id)
      .eq("operacao_id", data.operacao_id);
    if (eDel) throw new Error(eDel.message);

    return { ok: true, revertidos: registos.length };
  });
