/**
 * Tipos partilhados do módulo «Preparação de Consultas».
 *
 * Este módulo tem o seu próprio serviço de classificação semântica por IA e é
 * independente do motor antigo de regras (`src/lib/subempreitadas/engine.ts`),
 * que permanece isolado e intacto.
 */

export { TAMANHO_LOTE_PADRAO, MAX_LOTES_CONCORRENTES, MAX_TENTATIVAS_LOTE } from "./reconciliacao";

/** Tamanho de lote em vigor (reduzido de 20 para 10 após o diagnóstico de cobertura). */
export const TAMANHO_LOTE_IA = 10;

export type EstadoLote = "pendente" | "em_execucao" | "concluido" | "falhado";

export type LoteConsulta = {
  id: string;
  run_id: string;
  orcamento_id: string;
  indice: number;
  artigo_ids: string[];
  estado: EstadoLote;
  tentativas: number;
  erro: string | null;
  classificados: number;
  ausentes: number;
};

export type ArtigoConsulta = {
  id: string;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  ordem: number;
  capitulo_id: string | null;
  capitulo_codigo: string | null;
  capitulo_descricao: string | null;
};

export type ClassificacaoConsulta = {
  id: string;
  artigo_id: string;
  subempreitada_id: string | null;
  trabalho_principal: string | null;
  confianca: number;
  justificacao: string | null;
  necessita_revisao: boolean;
  sugestao_nova_subempreitada: string | null;
  validado_manual: boolean;
};

export type EstadoSeparacao = {
  orcamento_id: string;
  total_artigos: number;
  classificados: number;
  em_falta: number;
  artigos_em_falta: string[];
  sem_subempreitada: number;
  necessitam_revisao: number;
  validados: number;
  duplicados: number;
  subempreitadas_invalidas: number;
  sugestoes_novas: string[];
  completo: boolean;
};

export type ResultadoLote = {
  run_id: string;
  processados: number;
  atribuidos: number;
  revisao: number;
  falhados: string[];
  erro: string | null;
};
