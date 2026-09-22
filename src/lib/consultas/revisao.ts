/**
 * Lógica pura da área «A Rever» do módulo «Preparação de Consultas».
 *
 * Não depende da base de dados nem da IA: define o critério exato de revisão,
 * a ordenação, a atribuição otimista e a reversão (desfazer). Assim pode ser
 * verificada por testes determinísticos.
 */

/** Abaixo deste valor a classificação da IA exige sempre decisão humana. */
export const LIMIAR_CONFIANCA = 0.7;

export type LinhaRevisao = {
  artigo_id: string;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  capitulo_codigo: string | null;
  capitulo_descricao: string | null;
  /** true quando já existe uma classificação persistida para o artigo. */
  classificado: boolean;
  subempreitada_id: string | null;
  subempreitada_ia_id: string | null;
  confianca: number;
  confianca_ia: number;
  necessita_revisao: boolean;
  validado_manual: boolean;
  sugestao_nova_subempreitada: string | null;
  trabalho_principal?: string | null;
  justificacao?: string | null;
};

/** Valores repostos por «Desfazer». */
export type SnapshotRevisao = {
  artigo_id: string;
  subempreitada_id: string | null;
  confianca: number;
  necessita_revisao: boolean;
  validado_manual: boolean;
  sugestao_nova_subempreitada: string | null;
};

/**
 * Critério exato de «A Rever». Artigos ainda não processados pela IA
 * (sem classificação) nunca entram nesta lista: continuam como Pendentes.
 */
export function exigeRevisao(l: LinhaRevisao, limiar: number = LIMIAR_CONFIANCA): boolean {
  if (!l.classificado) return false;
  if (l.validado_manual) return false;
  return (
    l.necessita_revisao ||
    !l.subempreitada_id ||
    Boolean(l.sugestao_nova_subempreitada) ||
    l.confianca < limiar
  );
}

function normalizar(t: string) {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type FiltrosRevisao = {
  limiar?: number;
  pesquisa?: string;
  capitulo?: string | null;
  /** «com» = apenas com sugestão da IA; «sem» = apenas sem sugestão. */
  sugestao?: "todas" | "com" | "sem";
};

/** Lista «A Rever» filtrada e ordenada por menor confiança primeiro. */
export function listarARever(linhas: LinhaRevisao[], filtros: FiltrosRevisao = {}): LinhaRevisao[] {
  const limiar = filtros.limiar ?? LIMIAR_CONFIANCA;
  const termo = normalizar(filtros.pesquisa ?? "");
  const sugestao = filtros.sugestao ?? "todas";

  return linhas
    .filter((l) => exigeRevisao(l, limiar))
    .filter((l) => (filtros.capitulo ? (l.capitulo_codigo ?? "") === filtros.capitulo : true))
    .filter((l) => {
      if (sugestao === "com") return Boolean(l.subempreitada_ia_id || l.sugestao_nova_subempreitada);
      if (sugestao === "sem") return !l.subempreitada_ia_id && !l.sugestao_nova_subempreitada;
      return true;
    })
    .filter((l) =>
      termo ? normalizar(`${l.codigo ?? ""} ${l.descricao}`).includes(termo) : true,
    )
    .sort((a, b) => a.confianca - b.confianca || (a.codigo ?? "").localeCompare(b.codigo ?? ""));
}

/** «Validar Separação» só fica disponível sem pendentes, falhados nem artigos a rever. */
export function podeValidarSeparacao(input: {
  total: number;
  pendentes: number;
  falhados: number;
  a_rever: number;
}): boolean {
  return input.total > 0 && input.pendentes === 0 && input.falhados === 0 && input.a_rever === 0;
}

/** Guarda os valores atuais dos artigos indicados, para poderem ser repostos. */
export function snapshotDe(linhas: LinhaRevisao[], artigo_ids: string[]): SnapshotRevisao[] {
  const alvo = new Set(artigo_ids);
  return linhas
    .filter((l) => alvo.has(l.artigo_id))
    .map((l) => ({
      artigo_id: l.artigo_id,
      subempreitada_id: l.subempreitada_id,
      confianca: l.confianca,
      necessita_revisao: l.necessita_revisao,
      validado_manual: l.validado_manual,
      sugestao_nova_subempreitada: l.sugestao_nova_subempreitada,
    }));
}

/**
 * Atualização otimista: o artigo passa a ter exatamente uma subempreitada e sai
 * de «A Rever». A sugestão e a confiança originais da IA são preservadas.
 */
export function aplicarAtribuicaoOtimista(
  linhas: LinhaRevisao[],
  artigo_ids: string[],
  subempreitada_id: string,
): LinhaRevisao[] {
  const alvo = new Set(artigo_ids);
  return linhas.map((l) =>
    alvo.has(l.artigo_id)
      ? {
          ...l,
          subempreitada_id,
          subempreitada_ia_id: l.subempreitada_ia_id,
          confianca_ia: l.confianca_ia,
          confianca: 1,
          necessita_revisao: false,
          validado_manual: true,
        }
      : l,
  );
}

/** Reposição atómica dos valores anteriores (desfazer / rollback de erro). */
export function reverterAtribuicao(linhas: LinhaRevisao[], snapshots: SnapshotRevisao[]): LinhaRevisao[] {
  const porId = new Map(snapshots.map((s) => [s.artigo_id, s]));
  return linhas.map((l) => {
    const s = porId.get(l.artigo_id);
    return s ? { ...l, ...s } : l;
  });
}

export type RegistoAuditoria = {
  operacao_id: string;
  artigo_id: string;
  codigo_original: string | null;
  descricao_original: string;
  subempreitada_ia_id: string | null;
  sugestao_nova_subempreitada: string | null;
  confianca_ia: number;
  subempreitada_atribuida_id: string;
  estado_anterior: SnapshotRevisao;
};

/** Registo de aprendizagem validada: preserva sempre a sugestão e a confiança da IA. */
export function construirAuditoria(
  linha: LinhaRevisao,
  subempreitada_atribuida_id: string,
  operacao_id: string,
): RegistoAuditoria {
  return {
    operacao_id,
    artigo_id: linha.artigo_id,
    codigo_original: linha.codigo,
    descricao_original: linha.descricao,
    subempreitada_ia_id: linha.subempreitada_ia_id ?? linha.subempreitada_id,
    sugestao_nova_subempreitada: linha.sugestao_nova_subempreitada,
    confianca_ia: linha.confianca_ia,
    subempreitada_atribuida_id,
    estado_anterior: snapshotDe([linha], [linha.artigo_id])[0],
  };
}
