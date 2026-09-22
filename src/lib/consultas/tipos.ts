/**
 * Tipos partilhados do módulo «Preparação de Consultas».
 *
 * Este módulo tem o seu próprio serviço de classificação semântica por IA e é
 * independente do motor antigo de regras (`src/lib/subempreitadas/engine.ts`),
 * que permanece isolado e intacto.
 */

export const TAMANHO_LOTE_IA = 20;

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
