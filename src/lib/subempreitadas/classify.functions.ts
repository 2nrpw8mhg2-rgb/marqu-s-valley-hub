import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classificarArtigo, normalizar, type Subempreitada, type AprendizagemHit } from "./engine";

async function reclassificarLote(
  sb: any,
  orcamento_id: string | null,
): Promise<{ total: number; atribuidos: number; sem_atribuir: number; baixa_confianca: number; conflito: number }> {
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

  let query = sb
    .from("orcamento_artigos")
    .select(
      "id, codigo, descricao, unidade, capitulo_id, orcamento_id, subempreitada_validada_manual, capitulo:orcamento_capitulos(descricao)",
    )
    .eq("subempreitada_validada_manual", false);
  if (orcamento_id) query = query.eq("orcamento_id", orcamento_id);

  const { data: artigos, error: eArt } = await query;
  if (eArt) throw new Error(eArt.message);
  if (!artigos || artigos.length === 0)
    return { total: 0, atribuidos: 0, sem_atribuir: 0, baixa_confianca: 0, conflito: 0 };

  let atribuidos = 0;
  let semAtribuir = 0;
  let baixa = 0;
  let confl = 0;

  for (const a of artigos) {
    // Guarda dura: nunca sobrepor validações manuais
    if (a.subempreitada_validada_manual === true) continue;

    const capDesc = Array.isArray(a.capitulo) ? a.capitulo[0]?.descricao : (a.capitulo as any)?.descricao;
    const r = classificarArtigo(
      { codigo: a.codigo, descricao: a.descricao, unidade: a.unidade ?? null, capitulo_descricao: capDesc ?? null },
      subs,
      null,
      aprendizagem,
    );

    await sb
      .from("orcamento_artigos")
      .update({
        subempreitada_id: r.subempreitada_id,
        subempreitada_sugerida_id: r.subempreitada_sugerida_id,
        subempreitada_confianca: r.confianca,
        subempreitada_origem: r.origem,
        subempreitada_razao: r.razao,
        subempreitada_termos_match: r.termos_match,
      })
      .eq("id", a.id);

    if (r.subempreitada_id) atribuidos++;
    else semAtribuir++;
    if (r.origem === "baixa_confianca") baixa++;
    if (r.origem === "conflito") confl++;
  }

  return { total: artigos.length, atribuidos, sem_atribuir: semAtribuir, baixa_confianca: baixa, conflito: confl };
}

/**
 * Reclassifica todos os artigos de um orçamento (ou todos se orcamento_id for null).
 * Preserva os que estão validados manualmente.
 */
export const classificarOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orcamento_id: string | null }) =>
    z.object({ orcamento_id: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => reclassificarLote(context.supabase, data.orcamento_id));

/**
 * Reclassifica todos os orçamentos (admin).
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
    return reclassificarLote(context.supabase, null);
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
        subempreitada_sugerida_id: data.subempreitada_id,
        subempreitada_confianca: 1,
        subempreitada_origem: "manual",
        subempreitada_validada_manual: true,
        subempreitada_razao: "validação manual",
        subempreitada_termos_match: [],
      })
      .eq("id", data.artigo_id);
    if (e2) throw new Error(e2.message);

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
