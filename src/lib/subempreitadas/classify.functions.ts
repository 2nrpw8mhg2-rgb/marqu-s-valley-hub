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
      "id, codigo, descricao, unidade, capitulo_id, orcamento_id, subempreitada_id, subempreitada_validada_manual, capitulo:orcamento_capitulos(codigo, descricao, subempreitada_id, subempreitada_validada_manual)",
    )
    // Uma escolha manual com subempreitada é definitiva; artigos deixados
    // manualmente como "sem" devem poder beneficiar de regras novas.
    .or("subempreitada_validada_manual.eq.false,subempreitada_id.is.null");
  if (orcamento_id) query = query.eq("orcamento_id", orcamento_id);

  const { data: artigos, error: eArt } = await query;
  if (eArt) throw new Error(eArt.message);
  if (!artigos || artigos.length === 0)
    return { total: 0, atribuidos: 0, sem_atribuir: 0, baixa_confianca: 0, conflito: 0 };

  // Aproveita a classificação existente do Motor de Classificação. Quando um
  // artigo do orçamento já está ligado a um Artigo Mestre, a subempreitada
  // principal desse mestre é a fonte mais fiável depois da validação manual.
  const artigoIds = artigos.map((a: any) => a.id);
  const { data: classificacoes, error: eClass } = await sb
    .from("classificacao_artigos")
    .select("artigo_origem_id, artigo_mestre_id, estado, candidatos")
    .in("artigo_origem_id", artigoIds);
  if (eClass) throw new Error(eClass.message);

  const mestreIdPorArtigo = new Map<string, string>();
  const candidatoMestrePorArtigo = new Map<string, { mestreId: string; score: number; margem: number }>();
  for (const c of classificacoes ?? []) {
    if (c.artigo_mestre_id && (c.estado === "classificado_auto" || c.estado === "validado")) {
      mestreIdPorArtigo.set(c.artigo_origem_id, c.artigo_mestre_id);
    }
    const candidatos = Array.isArray(c.candidatos) ? c.candidatos : [];
    const primeiro = candidatos[0] as any;
    const segundo = candidatos[1] as any;
    if (primeiro?.artigo_mestre_id && Number(primeiro.score) >= 50) {
      candidatoMestrePorArtigo.set(c.artigo_origem_id, {
        mestreId: primeiro.artigo_mestre_id,
        score: Number(primeiro.score),
        margem: segundo ? Number(primeiro.score) - Number(segundo.score) : 100,
      });
    }
  }
  const mestreIds = [...new Set([
    ...mestreIdPorArtigo.values(),
    ...[...candidatoMestrePorArtigo.values()].map((c) => c.mestreId),
  ])];
  const subPorMestre = new Map<string, string>();
  if (mestreIds.length > 0) {
    const { data: mestres, error: eMestres } = await sb
      .from("biblioteca_artigos")
      .select("id, subempreitada_principal_id")
      .in("id", mestreIds)
      .eq("ativo", true);
    if (eMestres) throw new Error(eMestres.message);
    for (const m of mestres ?? []) {
      if (m.subempreitada_principal_id) subPorMestre.set(m.id, m.subempreitada_principal_id);
    }
  }

  const orcamentoIds = [...new Set(artigos.map((a: any) => a.orcamento_id).filter(Boolean))];
  const { data: capitulosRaiz, error: eCaps } = await sb
    .from("orcamento_capitulos")
    .select("orcamento_id, codigo, descricao")
    .in("orcamento_id", orcamentoIds);
  if (eCaps) throw new Error(eCaps.message);
  const raizPorOrcamentoCodigo = new Map<string, string>();
  for (const cap of capitulosRaiz ?? []) {
    const codigo = (cap.codigo ?? "").trim().replace(/\.+$/, "");
    if (/^\d+$/.test(codigo)) {
      raizPorOrcamentoCodigo.set(`${cap.orcamento_id}:${codigo}`, cap.descricao);
    }
  }

  let atribuidos = 0;
  let semAtribuir = 0;
  let baixa = 0;
  let confl = 0;

  for (const a of artigos) {
    // Guarda dura: nunca sobrepor uma subempreitada efetivamente validada.
    if (a.subempreitada_validada_manual === true && a.subempreitada_id) continue;

    const cap = Array.isArray(a.capitulo) ? a.capitulo[0] : (a.capitulo as any);
    const capCodigo = (cap?.codigo ?? "").trim().replace(/\.+$/, "");
    const codigoRaiz = capCodigo.split(".")[0];
    const artigoCodigo = (a.codigo ?? "").trim().replace(/\.+$/, "");
    const artigoCodigoPartes = artigoCodigo.split(".").filter(Boolean);
    const raizDesc = raizPorOrcamentoCodigo.get(`${a.orcamento_id}:${codigoRaiz}`);
    const descricaoCurta =
      a.descricao.length <= 48 || a.descricao.trim().split(/\s+/).length <= 6;
    const artigo = {
      codigo: a.codigo,
      descricao: a.descricao,
      unidade: a.unidade ?? null,
      capitulo_descricao: cap?.descricao || null,
    };
    const mestreId = mestreIdPorArtigo.get(a.id);
    const subMestreId = mestreId ? subPorMestre.get(mestreId) : undefined;
    const artigoMestre = subMestreId ? { subempreitada_principal_id: subMestreId } : null;
    const subCapituloId = cap?.subempreitada_validada_manual ? cap?.subempreitada_id : null;
    const regraCapitulo = subCapituloId ? { subempreitada_principal_id: subCapituloId } : null;
    const classificacaoPai = cap?.descricao && descricaoCurta
      ? classificarArtigo(
          {
            codigo: cap.codigo,
            // O início do descritivo identifica o trabalho; o restante costuma
            // enumerar acessórios de várias artes e criava falsos conflitos.
            descricao: cap.descricao.slice(0, 220),
            unidade: null,
            capitulo_descricao: null,
          },
          subs,
          null,
          aprendizagem,
        )
      : null;
    const classificacaoRaiz = raizDesc
      ? classificarArtigo(
          { codigo: codigoRaiz, descricao: raizDesc, unidade: null, capitulo_descricao: null },
          subs,
          null,
          aprendizagem,
        )
      : null;
    const herdada = classificacaoPai?.subempreitada_id
      ? classificacaoPai
      : descricaoCurta && classificacaoRaiz?.subempreitada_id
        ? classificacaoRaiz
        : null;
    let r = artigoMestre
      ? classificarArtigo(artigo, subs, artigoMestre, aprendizagem)
      : regraCapitulo
        ? {
            ...classificarArtigo(artigo, subs, regraCapitulo, aprendizagem),
            origem: "regras" as const,
            razao: `regra validada do capítulo "${cap?.descricao ?? cap?.codigo}"`,
          }
      : herdada
      ? {
          ...herdada,
          confianca: Math.max(herdada.confianca, 0.9),
          origem: "regras" as const,
          razao: `herdada do artigo-pai: ${herdada.razao}`,
        }
      : classificarArtigo(artigo, subs, null, aprendizagem);

    // Artigos diretamente sob um capítulo principal nem sempre repetem o nome
    // da arte (ex.: PSS, telas finais e apoio geral dentro de Estaleiro). Se o
    // próprio artigo não for conclusivo, herda a classificação inequívoca da
    // raiz. Uma classificação específica encontrada no artigo tem prioridade.
    if (
      !r.subempreitada_id &&
      artigoCodigoPartes.length > 0 &&
      artigoCodigoPartes.length <= 2 &&
      artigoCodigoPartes[0] === codigoRaiz &&
      classificacaoRaiz?.subempreitada_id
    ) {
      r = {
        ...classificacaoRaiz,
        confianca: Math.max(classificacaoRaiz.confianca, 0.9),
        origem: "regras",
        razao: `herdada do capítulo principal: ${classificacaoRaiz.razao}`,
      };
    }

    // O capítulo imediato é mais específico (por exemplo, caixilharias dentro de
    // serralharias). O capítulo-raiz só entra como contexto de recurso quando a
    // descrição imediata não permite uma atribuição segura.
    if (!r.subempreitada_id && raizDesc && raizDesc !== cap?.descricao) {
      r = classificarArtigo(
        { ...artigo, capitulo_descricao: `${cap?.descricao ?? ""} — ${raizDesc}` },
        subs,
        null,
        aprendizagem,
      );
    }

    // Consenso entre dois motores independentes: o candidato a Artigo Mestre
    // e as regras da subempreitada têm de apontar para a mesma arte. Um
    // candidato isolado nunca é suficiente, e exige-se ainda margem mínima
    // sobre o segundo candidato para evitar aceitar sinónimos ambíguos.
    if (!r.subempreitada_id && r.subempreitada_sugerida_id) {
      const candidato = candidatoMestrePorArtigo.get(a.id);
      const subCandidato = candidato ? subPorMestre.get(candidato.mestreId) : undefined;
      if (
        candidato &&
        candidato.margem >= 8 &&
        subCandidato &&
        subCandidato === r.subempreitada_sugerida_id
      ) {
        r = {
          ...r,
          subempreitada_id: subCandidato,
          subempreitada_sugerida_id: subCandidato,
          confianca: Math.max(0.8, r.confianca),
          origem: "artigo_mestre",
          razao: `consenso entre regras e candidato a Artigo Mestre (${candidato.score}%, margem ${candidato.margem} pontos)`,
          conflitos: [],
        };
      }
    }

    const { error: eUpdate } = await sb
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
    if (eUpdate) {
      throw new Error(`Não foi possível guardar a classificação do artigo ${a.codigo ?? a.id}: ${eUpdate.message}`);
    }

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
        subempreitada_confianca: data.subempreitada_id ? 1 : 0,
        subempreitada_origem: data.subempreitada_id ? "manual" : "sem_regra",
        subempreitada_validada_manual: Boolean(data.subempreitada_id),
        subempreitada_razao: data.subempreitada_id
          ? "validação manual"
          : "sem atribuição; disponível para reclassificação",
        subempreitada_termos_match: [],
      })
      .eq("id", data.artigo_id);
    if (e2) throw new Error(e2.message);

    if (data.subempreitada_id) {
      const descN = normalizar(art.descricao);
      // Evita aprender descrições genéricas que se repetem em artes diferentes.
      if (descN.length >= 30 && descN.split(" ").length >= 5) {
        await sb.from("subempreitada_aprendizagem").insert({
          descricao_normalizada: descN,
          subempreitada_id: data.subempreitada_id,
          user_id: context.userId,
          peso: 1,
        });
      }
    }
    return { ok: true };
  });
