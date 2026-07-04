import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classificarArtigo, normalizar, type Subempreitada, type AprendizagemHit } from "./engine";

/**
 * Reclassifica todos os artigos de um orçamento (ou todos os orçamentos se orcamento_id for null).
 * Preserva os que estão validados manualmente.
 */
export const classificarOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orcamento_id: string | null }) =>
    z.object({ orcamento_id: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const { data: subsRaw, error: eSubs } = await sb
      .from("subempreitadas")
      .select("id, codigo, nome, palavras_chave, termos_exclusao, ativo")
      .eq("ativo", true);
    if (eSubs) throw new Error(eSubs.message);
    const subs = (subsRaw ?? []) as Subempreitada[];

    const { data: apr, error: eApr } = await sb
      .from("subempreitada_aprendizagem")
      .select("descricao_normalizada, subempreitada_id, peso");
    if (eApr) throw new Error(eApr.message);
    const aprendizagem = (apr ?? []) as AprendizagemHit[];

    // Buscar artigos (não validados manualmente) com capítulo em join
    let query = sb
      .from("orcamento_artigos")
      .select("id, codigo, descricao, capitulo_id, orcamento_id, subempreitada_validada_manual, capitulo:orcamento_capitulos(descricao)")
      .eq("subempreitada_validada_manual", false);
    if (data.orcamento_id) query = query.eq("orcamento_id", data.orcamento_id);

    const { data: artigos, error: eArt } = await query;
    if (eArt) throw new Error(eArt.message);

    if (!artigos || artigos.length === 0) return { total: 0, atribuidos: 0, sem_atribuir: 0 };

    // Buscar artigos mestre associados (se existir tabela de ligação) — no schema atual
    // não há ligação direta orcamento_artigo -> biblioteca_artigo, portanto fica null.
    // (Fica preparado para quando essa ligação existir.)

    let atribuidos = 0;
    let semAtribuir = 0;
    const updates: Array<{
      id: string;
      subempreitada_id: string | null;
      subempreitada_confianca: number;
      subempreitada_origem: string;
    }> = [];

    for (const a of artigos) {
      const capDesc = Array.isArray(a.capitulo) ? a.capitulo[0]?.descricao : (a.capitulo as any)?.descricao;
      const r = classificarArtigo(
        { codigo: a.codigo, descricao: a.descricao, capitulo_descricao: capDesc ?? null },
        subs,
        null,
        aprendizagem,
      );
      updates.push({
        id: a.id,
        subempreitada_id: r.subempreitada_id,
        subempreitada_confianca: r.confianca,
        subempreitada_origem: r.origem,
      });
      if (r.subempreitada_id) atribuidos++;
      else semAtribuir++;
    }

    // Atualizar em lote (loop por artigo — supabase-js não tem bulk update)
    for (const u of updates) {
      await sb
        .from("orcamento_artigos")
        .update({
          subempreitada_id: u.subempreitada_id,
          subempreitada_confianca: u.subempreitada_confianca,
          subempreitada_origem: u.subempreitada_origem,
        })
        .eq("id", u.id);
    }

    return { total: artigos.length, atribuidos, sem_atribuir: semAtribuir };
  });

/**
 * Reclassifica todos os orçamentos existentes (função admin, chamada uma vez).
 */
export const classificarTudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Só administradores podem correr esta operação.");
    // Delega ao classificador com orcamento_id = null
    const sb = context.supabase;
    const { data: subsRaw } = await sb.from("subempreitadas").select("id, codigo, nome, palavras_chave, termos_exclusao, ativo").eq("ativo", true);
    const { data: apr } = await sb.from("subempreitada_aprendizagem").select("descricao_normalizada, subempreitada_id, peso");
    const { data: artigos } = await sb
      .from("orcamento_artigos")
      .select("id, codigo, descricao, capitulo:orcamento_capitulos(descricao)")
      .eq("subempreitada_validada_manual", false);

    const subs = (subsRaw ?? []) as Subempreitada[];
    const aprendizagem = (apr ?? []) as AprendizagemHit[];
    let atribuidos = 0;
    for (const a of artigos ?? []) {
      const capDesc = Array.isArray(a.capitulo) ? a.capitulo[0]?.descricao : (a.capitulo as any)?.descricao;
      const r = classificarArtigo({ codigo: a.codigo, descricao: a.descricao, capitulo_descricao: capDesc ?? null }, subs, null, aprendizagem);
      await sb
        .from("orcamento_artigos")
        .update({
          subempreitada_id: r.subempreitada_id,
          subempreitada_confianca: r.confianca,
          subempreitada_origem: r.origem,
        })
        .eq("id", a.id);
      if (r.subempreitada_id) atribuidos++;
    }
    return { total: artigos?.length ?? 0, atribuidos };
  });

/**
 * Alterar manualmente a subempreitada de um artigo e gravar aprendizagem.
 */
export const alterarSubempreitadaArtigo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { artigo_id: string; subempreitada_id: string | null }) =>
    z.object({ artigo_id: z.string().uuid(), subempreitada_id: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: art, error: e1 } = await sb
      .from("orcamento_artigos")
      .select("id, descricao")
      .eq("id", data.artigo_id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!art) throw new Error("Artigo não encontrado");

    const { error: e2 } = await sb
      .from("orcamento_artigos")
      .update({
        subempreitada_id: data.subempreitada_id,
        subempreitada_confianca: 1,
        subempreitada_origem: "manual",
        subempreitada_validada_manual: true,
      })
      .eq("id", data.artigo_id);
    if (e2) throw new Error(e2.message);

    // Aprendizagem
    if (data.subempreitada_id) {
      const descN = normalizar(art.descricao);
      await sb.from("subempreitada_aprendizagem").insert({
        descricao_normalizada: descN,
        subempreitada_id: data.subempreitada_id,
        user_id: context.userId,
        peso: 1,
      });
    }
    return { ok: true };
  });
