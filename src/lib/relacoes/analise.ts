import { supabase } from "@/integrations/supabase/client";
import { RELACOES_CONFIG, severidadeDeObrigatoriedade } from "./config";
import type { Obrigatoriedade, TipoRelacao, EstadoAlerta } from "./types";

const ORD: Record<Obrigatoriedade, number> = {
  obrigatorio: 5, muito_frequente: 4, frequente: 3, opcional: 2, raro: 1,
};

/**
 * Analisa um orçamento contra o Motor de Relações Construtivas
 * e produz/atualiza alertas técnicos de potenciais omissões.
 *
 * - Apenas considera artigos do MQ classificados (auto ou validados).
 * - Para cada artigo origem, expande artigos esperados via:
 *     • membros obrigatórios/muito_frequentes dos sistemas em que o artigo é principal;
 *     • relações 'complementa' / 'depende_de' com obrigatoriedade >= limiar.
 * - Preserva o estado de alertas já fechados pelo utilizador
 *   (aceite_omissao | justificado | ignorado).
 * - Marca como 'resolvido' alertas cujo artigo esperado passou a constar no MQ.
 */
export async function analisarOmissoes(orcamentoId: string) {
  // 1) Artigos do MQ classificados
  const { data: classRows, error: e1 } = await supabase
    .from("classificacao_artigos")
    .select("artigo_origem_id, artigo_mestre_id, estado")
    .eq("orcamento_id", orcamentoId)
    .in("estado", ["classificado_auto", "validado"]);
  if (e1) throw e1;

  const presentes = new Map<string, string>(); // artigo_mestre_id -> artigo_mq_id (primeiro)
  for (const r of classRows ?? []) {
    if (r.artigo_mestre_id && !presentes.has(r.artigo_mestre_id)) {
      presentes.set(r.artigo_mestre_id, r.artigo_origem_id);
    }
  }
  const presentesIds = Array.from(presentes.keys());

  // 2) Carregar relações que partem dos artigos presentes (apenas tipos canónicos
  //    analisados; ignora linhas auto_inverso para não duplicar).
  const tiposAnalisados = RELACOES_CONFIG.TIPOS_ANALISADOS as TipoRelacao[];
  const limiarMin = Math.min(...RELACOES_CONFIG.LIMIAR_ALERTA.map((o) => ORD[o]));

  let relacoes: Array<{
    artigo_origem_id: string;
    artigo_destino_id: string;
    tipo_relacao: TipoRelacao;
    obrigatoriedade: Obrigatoriedade;
    sistema_id: string | null;
  }> = [];

  if (presentesIds.length > 0) {
    const { data, error } = await supabase
      .from("biblioteca_artigo_relacoes")
      .select("artigo_origem_id, artigo_destino_id, tipo_relacao, obrigatoriedade, sistema_id, origem")
      .in("artigo_origem_id", presentesIds)
      .in("tipo_relacao", tiposAnalisados)
      .neq("origem", "auto_inverso");
    if (error) throw error;
    relacoes = (data ?? [])
      .filter((r) => ORD[r.obrigatoriedade as Obrigatoriedade] >= limiarMin)
      .map((r) => ({
        artigo_origem_id: r.artigo_origem_id,
        artigo_destino_id: r.artigo_destino_id,
        tipo_relacao: r.tipo_relacao as TipoRelacao,
        obrigatoriedade: r.obrigatoriedade as Obrigatoriedade,
        sistema_id: r.sistema_id as string | null,
      }));
  }

  // 3) Esperados = relações cujo destino NÃO está presente
  type Esperado = {
    artigo_mestre_origem_id: string;
    artigo_mq_id: string | null;
    artigo_mestre_esperado_id: string;
    sistema_id: string | null;
    tipo_relacao: TipoRelacao;
    obrigatoriedade: Obrigatoriedade;
  };
  const esperadosMap = new Map<string, Esperado>(); // chave única
  for (const r of relacoes) {
    if (presentes.has(r.artigo_destino_id)) continue;
    const mqId = presentes.get(r.artigo_origem_id) ?? null;
    const key = `${mqId ?? ""}::${r.artigo_destino_id}::${r.tipo_relacao}`;
    const prev = esperadosMap.get(key);
    if (!prev || ORD[r.obrigatoriedade] > ORD[prev.obrigatoriedade]) {
      esperadosMap.set(key, {
        artigo_mestre_origem_id: r.artigo_origem_id,
        artigo_mq_id: mqId,
        artigo_mestre_esperado_id: r.artigo_destino_id,
        sistema_id: r.sistema_id,
        tipo_relacao: r.tipo_relacao,
        obrigatoriedade: r.obrigatoriedade,
      });
    }
  }
  const esperados = Array.from(esperadosMap.values());

  // 4) Alertas existentes deste orçamento
  const { data: existentesRaw } = await supabase
    .from("orcamento_alertas_tecnicos")
    .select("id, artigo_mq_id, artigo_mestre_esperado_id, tipo_relacao, estado")
    .eq("orcamento_id", orcamentoId);
  const existentes = new Map<string, { id: string; estado: EstadoAlerta }>();
  for (const e of existentesRaw ?? []) {
    const key = `${e.artigo_mq_id ?? ""}::${e.artigo_mestre_esperado_id}::${e.tipo_relacao}`;
    existentes.set(key, { id: e.id, estado: e.estado as EstadoAlerta });
  }

  // 5) Upsert dos alertas + auto-resolver os que já não se aplicam
  const toUpsert: any[] = [];
  const seen = new Set<string>();
  for (const exp of esperados) {
    const key = `${exp.artigo_mq_id ?? ""}::${exp.artigo_mestre_esperado_id}::${exp.tipo_relacao}`;
    seen.add(key);
    const prev = existentes.get(key);
    // Se o utilizador já fechou (aceite/justificado/ignorado), preserva estado
    const estado: EstadoAlerta = prev && ["aceite_omissao", "justificado", "ignorado"].includes(prev.estado)
      ? prev.estado
      : "aberto";
    toUpsert.push({
      orcamento_id: orcamentoId,
      artigo_mq_id: exp.artigo_mq_id,
      artigo_mestre_origem_id: exp.artigo_mestre_origem_id,
      artigo_mestre_esperado_id: exp.artigo_mestre_esperado_id,
      sistema_id: exp.sistema_id,
      tipo_relacao: exp.tipo_relacao,
      obrigatoriedade: exp.obrigatoriedade,
      severidade: severidadeDeObrigatoriedade(exp.obrigatoriedade),
      estado,
    });
  }
  if (toUpsert.length) {
    const { error } = await supabase
      .from("orcamento_alertas_tecnicos")
      .upsert(toUpsert, { onConflict: "orcamento_id,artigo_mq_id,artigo_mestre_esperado_id,tipo_relacao" });
    if (error) throw error;
  }

  // 6) Resolver alertas que já não constam dos esperados (artigo passou a existir)
  const aResolverIds: string[] = [];
  for (const [key, e] of existentes) {
    if (seen.has(key)) continue;
    if (e.estado === "aberto" || e.estado === "resolvido") aResolverIds.push(e.id);
  }
  if (aResolverIds.length) {
    await supabase
      .from("orcamento_alertas_tecnicos")
      .update({ estado: "resolvido", resolvido_em: new Date().toISOString() })
      .in("id", aResolverIds);
  }

  return {
    total: esperados.length,
    criticos: esperados.filter((e) => severidadeDeObrigatoriedade(e.obrigatoriedade) === "critico").length,
    avisos: esperados.filter((e) => severidadeDeObrigatoriedade(e.obrigatoriedade) === "aviso").length,
  };
}

export type AcaoAlerta = "aceitar_omissao" | "justificar" | "ignorar" | "reabrir";

export async function marcarAlerta(id: string, acao: AcaoAlerta, justificacao?: string) {
  const { data: u } = await supabase.auth.getUser();
  const patch: {
    estado?: EstadoAlerta;
    justificacao?: string | null;
    resolvido_por?: string | null;
    resolvido_em?: string | null;
  } = {};
  if (acao === "aceitar_omissao") patch.estado = "aceite_omissao";
  if (acao === "ignorar") patch.estado = "ignorado";
  if (acao === "reabrir") { patch.estado = "aberto"; patch.justificacao = null; patch.resolvido_em = null; patch.resolvido_por = null; }
  if (acao === "justificar") { patch.estado = "justificado"; patch.justificacao = justificacao ?? null; }
  if (acao !== "reabrir") {
    patch.resolvido_por = u.user?.id ?? null;
    patch.resolvido_em = new Date().toISOString();
  }
  const { error } = await supabase.from("orcamento_alertas_tecnicos").update(patch).eq("id", id);
  if (error) throw error;
}
