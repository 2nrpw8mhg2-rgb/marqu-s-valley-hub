/**
 * Leitura em tempo real dos dados dos «Mapas por Subempreitada».
 *
 * Todas as consultas passam pelo cliente autenticado (as regras de acesso da
 * obra aplicam-se). Nada é copiado para estruturas paralelas: as pastas são
 * derivadas a cada leitura.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ArtigoMapa, SubempreitadaRef } from "./pastas";

export type DadosMapas = {
  obra: { id: string; nome: string; cliente: string | null } | null;
  orcamento: { id: string; nome: string; updated_at: string | null } | null;
  artigos: ArtigoMapa[];
  subempreitadas: SubempreitadaRef[];
};

export async function carregarMapas(obraId: string): Promise<DadosMapas> {
  const { data: obra, error: eo } = await supabase
    .from("obras")
    .select("id, nome, cliente")
    .eq("id", obraId)
    .single();
  if (eo) throw eo;

  const { data: orcs, error: e1 } = await supabase
    .from("orcamentos")
    .select("id, nome, updated_at")
    .eq("obra_id", obraId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (e1) throw e1;
  const orcamento = orcs?.[0] ?? null;

  const { data: subs, error: e2 } = await supabase
    .from("subempreitadas")
    .select("id, codigo, nome")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  if (e2) throw e2;

  if (!orcamento) {
    return { obra, orcamento: null, artigos: [], subempreitadas: subs ?? [] };
  }

  const { data: artigos, error: e3 } = await supabase
    .from("orcamento_artigos")
    .select(
      "id, codigo, descricao, unidade, quantidade, ordem, notas, updated_at, capitulo:orcamento_capitulos(codigo, descricao)",
    )
    .eq("orcamento_id", orcamento.id)
    .order("ordem", { ascending: true });
  if (e3) throw e3;

  const { data: cls, error: e4 } = await supabase
    .from("consulta_ia_classificacoes")
    .select(
      "artigo_id, subempreitada_id, confianca, necessita_revisao, validado_manual, sugestao_nova_subempreitada, updated_at",
    )
    .eq("orcamento_id", orcamento.id);
  if (e4) throw e4;
  const porArtigo = new Map((cls ?? []).map((c: any) => [c.artigo_id, c]));

  const linhas: ArtigoMapa[] = (artigos ?? []).map((a: any) => {
    const cap = Array.isArray(a.capitulo) ? a.capitulo[0] : a.capitulo;
    const c: any = porArtigo.get(a.id);
    return {
      artigo_id: a.id,
      codigo: a.codigo ?? null,
      descricao: a.descricao,
      unidade: a.unidade ?? null,
      quantidade: Number(a.quantidade ?? 0),
      ordem: Number(a.ordem ?? 0),
      capitulo_codigo: cap?.codigo ?? null,
      capitulo_descricao: cap?.descricao ?? null,
      observacoes: a.notas ?? null,
      referencia_documental: null,
      subempreitada_id: c?.subempreitada_id ?? null,
      classificado: Boolean(c),
      necessita_revisao: Boolean(c?.necessita_revisao),
      validado_manual: Boolean(c?.validado_manual),
      sugestao_nova_subempreitada: c?.sugestao_nova_subempreitada ?? null,
      confianca: Number(c?.confianca ?? 0),
      atualizado_em: c?.updated_at ?? a.updated_at ?? null,
    };
  });

  return { obra, orcamento, artigos: linhas, subempreitadas: subs ?? [] };
}

export function useMapasObra(obraId: string) {
  return useQuery({
    queryKey: ["mapas-subempreitada", obraId],
    queryFn: () => carregarMapas(obraId),
  });
}

/** Descarregamento explícito, sempre iniciado pelo utilizador. */
export function descarregar(bytes: Uint8Array, nome: string, mime: string) {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Liberta o recurso assim que o navegador inicia a transferência.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const MIME_PDF = "application/pdf";
export const MIME_ZIP = "application/zip";
