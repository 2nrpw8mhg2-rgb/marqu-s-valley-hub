/**
 * Leitura em tempo real do módulo operacional «Procurement» de uma obra.
 *
 * Os pacotes referenciam dinamicamente os Mapas por Subempreitada: enquanto não
 * existir uma versão enviada (congelada), tudo é derivado das classificações
 * atuais. Nenhuma consulta é enviada por estas funções.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMapasObra } from "@/lib/mapas/dados";
import { pacotesEsperados, type LinhaPacote, type Ambito, AMBITO_VAZIO, alertasPacote, ambitoPreenchido } from "./fase1";
import type { ArtigoMapa } from "@/lib/mapas/pastas";

export type PacoteProcurement = LinhaPacote & {
  orcamento_id: string;
  artigos_elegiveis: ArtigoMapa[];
  documentos_obrigatorios: number;
  ambito: Ambito | null;
  versoes: number;
};

export function chaveProcurement(obraId: string) {
  return ["procurement-obra", obraId] as const;
}

async function carregarApoio(pacoteIds: string[]) {
  if (!pacoteIds.length) return { empresas: [], documentos: [], ambitos: [], versoes: [] };
  const [emp, doc, amb, ver] = await Promise.all([
    supabase.from("procurement_pacote_empresas").select("pacote_id, subempreiteiro_id").in("pacote_id", pacoteIds),
    supabase.from("procurement_pacote_documentos").select("pacote_id, documento_id, obrigatorio").in("pacote_id", pacoteIds),
    supabase.from("procurement_pacote_ambito").select("*").in("pacote_id", pacoteIds),
    supabase.from("procurement_pacote_versoes").select("pacote_id, numero, enviado_em").in("pacote_id", pacoteIds),
  ]);
  for (const r of [emp, doc, amb, ver]) if (r.error) throw r.error;
  return {
    empresas: emp.data ?? [],
    documentos: doc.data ?? [],
    ambitos: amb.data ?? [],
    versoes: ver.data ?? [],
  };
}

export function useProcurementObra(obraId: string) {
  const mapas = useMapasObra(obraId);
  const orcamentoId = mapas.data?.orcamento?.id ?? null;

  const pacotes = useQuery({
    queryKey: chaveProcurement(obraId),
    enabled: Boolean(orcamentoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procurement_pacotes")
        .select("id, nome, estado, origem, subempreitada_id, responsavel_id, updated_at, orcamento_id")
        .eq("orcamento_id", orcamentoId!)
        .order("nome");
      if (error) throw error;
      const ids = (data ?? []).map((p) => p.id);
      const apoio = await carregarApoio(ids);
      return { pacotes: data ?? [], ...apoio };
    },
  });

  const artigos = mapas.data?.artigos ?? [];
  const esperados = pacotesEsperados(artigos, mapas.data?.subempreitadas ?? []);
  const porSub = new Map(esperados.map((p) => [p.subempreitada_id, p]));

  const linhas: PacoteProcurement[] = (pacotes.data?.pacotes ?? []).map((p: any) => {
    const esperado = p.subempreitada_id ? porSub.get(p.subempreitada_id) : undefined;
    const empresas = (pacotes.data?.empresas ?? []).filter((e: any) => e.pacote_id === p.id);
    const docs = (pacotes.data?.documentos ?? []).filter((d: any) => d.pacote_id === p.id);
    const amb = (pacotes.data?.ambitos ?? []).find((a: any) => a.pacote_id === p.id) ?? null;
    const ambito: Ambito | null = amb
      ? {
          ambito_geral: amb.ambito_geral ?? "",
          responsabilidades_mv: amb.responsabilidades_mv ?? "",
          responsabilidades_subempreiteiro: amb.responsabilidades_subempreiteiro ?? "",
          inclusoes: amb.inclusoes ?? "",
          exclusoes: amb.exclusoes ?? "",
          alternativas: amb.alternativas ?? "",
          observacoes: amb.observacoes ?? "",
        }
      : null;
    const artigosElegiveis = esperado?.artigos ?? [];
    return {
      id: p.id,
      orcamento_id: p.orcamento_id,
      nome: p.nome,
      subempreitada_id: p.subempreitada_id,
      estado: p.estado,
      origem: p.origem,
      responsavel_id: p.responsavel_id ?? null,
      artigos: artigosElegiveis.length,
      artigos_elegiveis: artigosElegiveis,
      mq_revisao: "Rev. 01",
      empresas: empresas.length,
      documentos_obrigatorios: docs.filter((d: any) => d.obrigatorio).length,
      consultas_enviadas: 0,
      respostas: 0,
      atualizado_em: p.updated_at ?? null,
      ambito,
      versoes: (pacotes.data?.versoes ?? []).filter((v: any) => v.pacote_id === p.id).length,
      alertas: alertasPacote({
        artigos: artigosElegiveis.length,
        empresas: empresas.length,
        documentos: docs.length,
        ambito_preenchido: ambitoPreenchido(ambito),
      }),
    };
  });

  return {
    obra: mapas.data?.obra ?? null,
    orcamento: mapas.data?.orcamento ?? null,
    artigos,
    subempreitadas: mapas.data?.subempreitadas ?? [],
    esperados,
    linhas,
    // Pacotes em falta face às subempreitadas validadas com artigos elegíveis.
    emFalta: esperados.filter((e) => !linhas.some((l) => l.subempreitada_id === e.subempreitada_id)).length,
    isLoading: mapas.isLoading || pacotes.isLoading,
    isError: mapas.isError || pacotes.isError,
    refetch: async () => {
      await mapas.refetch();
      await pacotes.refetch();
    },
  };
}

/**
 * Reconciliação idempotente: garante um pacote por subempreitada com artigos,
 * sem duplicados e sem apagar o que já avançou no processo.
 */
export async function reconciliarPacotes(orcamentoId: string) {
  const { data, error } = await (supabase as any).rpc("procurement_reconciliar_pacotes", {
    p_orcamento_id: orcamentoId,
  });
  if (error) throw new Error(error.message);
  return (data?.[0] ?? { pacotes_criados: 0, pacotes_existentes: 0, artigos_incluidos: 0 }) as {
    pacotes_criados: number;
    pacotes_existentes: number;
    artigos_incluidos: number;
  };
}

export async function guardarAmbito(pacoteId: string, ambito: Ambito, userId: string | null) {
  const { error } = await supabase
    .from("procurement_pacote_ambito")
    .upsert({ pacote_id: pacoteId, ...ambito, updated_by: userId }, { onConflict: "pacote_id" });
  if (error) throw new Error(error.message);
}

export function usePacoteApoio(pacoteId: string) {
  return useQuery({
    queryKey: ["procurement-pacote", pacoteId],
    queryFn: async () => {
      const [docs, emps] = await Promise.all([
        supabase
          .from("procurement_pacote_documentos")
          .select("id, documento_id, obrigatorio")
          .eq("pacote_id", pacoteId),
        supabase
          .from("procurement_pacote_empresas")
          .select("id, subempreiteiro_id")
          .eq("pacote_id", pacoteId),
      ]);
      if (docs.error) throw docs.error;
      if (emps.error) throw emps.error;
      return { documentos: docs.data ?? [], empresas: emps.data ?? [] };
    },
  });
}

/** Associa/desassocia um documento existente. Nunca apaga o ficheiro. */
export async function alternarDocumento(pacoteId: string, documentoId: string, ativo: boolean, userId: string | null) {
  if (ativo) {
    const { error } = await supabase
      .from("procurement_pacote_documentos")
      .upsert({ pacote_id: pacoteId, documento_id: documentoId, created_by: userId }, { onConflict: "pacote_id,documento_id" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("procurement_pacote_documentos")
      .delete()
      .eq("pacote_id", pacoteId)
      .eq("documento_id", documentoId);
    if (error) throw new Error(error.message);
  }
}

export async function marcarDocumentoObrigatorio(pacoteId: string, documentoId: string, obrigatorio: boolean) {
  const { error } = await supabase
    .from("procurement_pacote_documentos")
    .update({ obrigatorio })
    .eq("pacote_id", pacoteId)
    .eq("documento_id", documentoId);
  if (error) throw new Error(error.message);
}

/** Associa/desassocia uma empresa da base global de subempreiteiros. */
export async function alternarEmpresa(pacoteId: string, subempreiteiroId: string, ativo: boolean, userId: string | null) {
  if (ativo) {
    const { error } = await supabase
      .from("procurement_pacote_empresas")
      .upsert({ pacote_id: pacoteId, subempreiteiro_id: subempreiteiroId, created_by: userId }, { onConflict: "pacote_id,subempreiteiro_id" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("procurement_pacote_empresas")
      .delete()
      .eq("pacote_id", pacoteId)
      .eq("subempreiteiro_id", subempreiteiroId);
    if (error) throw new Error(error.message);
  }
}

export async function atualizarEstadoPacote(pacoteId: string, estado: string) {
  const { error } = await supabase.from("procurement_pacotes").update({ estado: estado as any }).eq("id", pacoteId);
  if (error) throw new Error(error.message);
}

export function useInvalidarProcurement(obraId: string) {
  const qc = useQueryClient();
  return async (pacoteId?: string) => {
    await qc.invalidateQueries({ queryKey: chaveProcurement(obraId) });
    if (pacoteId) await qc.invalidateQueries({ queryKey: ["procurement-pacote", pacoteId] });
  };
}

export { AMBITO_VAZIO };
