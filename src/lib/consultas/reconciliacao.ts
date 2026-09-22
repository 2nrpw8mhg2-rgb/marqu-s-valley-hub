/**
 * Funções puras de reconciliação determinística do módulo «Preparação de Consultas».
 *
 * Não dependem da base de dados nem da IA, para poderem ser verificadas por testes.
 */

export const TAMANHO_LOTE_PADRAO = 10;
export const MAX_LOTES_CONCORRENTES = 2;
export const MAX_TENTATIVAS_LOTE = 3;

/** Divide uma lista de IDs em lotes de tamanho fixo, preservando a ordem original. */
export function dividirEmLotes<T>(ids: T[], tamanho: number = TAMANHO_LOTE_PADRAO): T[][] {
  const t = Math.max(1, Math.floor(tamanho));
  const lotes: T[][] = [];
  for (let i = 0; i < ids.length; i += t) lotes.push(ids.slice(i, i + t));
  return lotes;
}

/**
 * Diferença determinística entre os artigos do Mapa de Quantidades e os que já
 * têm classificação persistida. A ordem do MQ é preservada.
 */
export function idsPendentes(idsMQ: string[], idsClassificados: Iterable<string>): string[] {
  const feitos = new Set(idsClassificados);
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const id of idsMQ) {
    if (feitos.has(id) || vistos.has(id)) continue;
    vistos.add(id);
    out.push(id);
  }
  return out;
}

export type Reconciliacao<T extends { artigo_id: string }> = {
  /** Uma entrada por artigo enviado que a IA devolveu corretamente. */
  validos: T[];
  /** IDs enviados que a IA não devolveu — têm de ser reencaminhados. */
  ausentes: string[];
  /** IDs devolvidos que não constavam do envio — descartados. */
  desconhecidos: string[];
  /** IDs devolvidos mais do que uma vez — só a primeira resposta conta. */
  duplicados: string[];
};

/**
 * Compara exatamente os IDs enviados com os IDs recebidos da IA.
 * Garante a cardinalidade «zero ou uma classificação por artigo»; não impõe
 * qualquer limite ao número de artigos atribuídos à mesma subempreitada.
 */
export function reconciliar<T extends { artigo_id: string }>(
  enviados: string[],
  recebidos: T[],
): Reconciliacao<T> {
  const esperados = new Set(enviados);
  const usados = new Set<string>();
  const validos: T[] = [];
  const desconhecidos: string[] = [];
  const duplicados: string[] = [];

  for (const r of recebidos) {
    const id = r?.artigo_id;
    if (!id || !esperados.has(id)) {
      if (id) desconhecidos.push(id);
      continue;
    }
    if (usados.has(id)) {
      duplicados.push(id);
      continue;
    }
    usados.add(id);
    validos.push(r);
  }

  const ausentes = enviados.filter((id) => !usados.has(id));
  return { validos, ausentes, desconhecidos, duplicados };
}

/** Tamanho do lote a usar na tentativa seguinte: reduz até chegar ao artigo individual. */
export function tamanhoRetentativa(tentativa: number, tamanhoAtual: number): number {
  if (tentativa >= 2) return 1;
  return Math.max(1, Math.ceil(tamanhoAtual / 2));
}

/** Espera com recuo progressivo entre tentativas (ms). */
export function esperaBackoff(tentativa: number): number {
  return Math.min(8000, 800 * 2 ** Math.max(0, tentativa));
}

export type ResumoCobertura = {
  total: number;
  classificados: number;
  pendentes: number;
  falhados: number;
  percentagem: number;
  completo: boolean;
  invariante_ok: boolean;
};

/**
 * Invariante obrigatória: IDs do MQ = classificados + pendentes + falhados.
 * Enquanto houver pendentes ou falhados o estado nunca pode ser «completo».
 */
export function resumoCobertura(input: {
  total: number;
  classificados: number;
  pendentes: number;
  falhados: number;
}): ResumoCobertura {
  const { total, classificados, pendentes, falhados } = input;
  return {
    total,
    classificados,
    pendentes,
    falhados,
    percentagem: total === 0 ? 0 : Math.round((classificados / total) * 1000) / 10,
    completo: total > 0 && classificados === total && pendentes === 0 && falhados === 0,
    invariante_ok: classificados + pendentes + falhados === total,
  };
}
