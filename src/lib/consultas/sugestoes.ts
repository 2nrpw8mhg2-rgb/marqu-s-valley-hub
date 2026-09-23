/**
 * Lógica pura das sugestões de subempreitada na área «A Rever».
 *
 * Trata de normalização de nomes, deteção de equivalentes já existentes,
 * classificação da sugestão de cada artigo, agrupamento em massa e rejeição.
 * Sem base de dados e sem IA, para poder ser verificada por testes.
 */
import type { LinhaRevisao } from "./revisao";

export type SubOpcaoBase = { id: string; codigo: string; nome: string };

/** Mesma normalização usada na base de dados: sem acentos, sem maiúsculas, espaços colapsados. */
export function normalizarNomeSubempreitada(t: string): string {
  return (t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Subempreitada já existente equivalente ao nome indicado (ignora maiúsculas, acentos e espaços). */
export function encontrarEquivalente<T extends SubOpcaoBase>(subs: T[], nome: string): T | null {
  const alvo = normalizarNomeSubempreitada(nome);
  if (!alvo) return null;
  return subs.find((s) => normalizarNomeSubempreitada(s.nome) === alvo) ?? null;
}

/** Código sugerido para uma subempreitada nova (apenas pré-visualização na interface). */
export function codigoSugerido(nome: string): string {
  const base = normalizarNomeSubempreitada(nome)
    .replace(/[^a-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);
  return base || "SUB";
}

export type SugestaoLinha =
  | { tipo: "nenhuma" }
  | { tipo: "existente"; subempreitada_id: string }
  | { tipo: "nova"; nome: string; equivalente_id: string | null };

/** Que tipo de sugestão tem o artigo e, se for nova, se já existe equivalente. */
export function classificarSugestao(l: LinhaRevisao, subs: SubOpcaoBase[]): SugestaoLinha {
  const nova = (l.sugestao_nova_subempreitada ?? "").trim();
  if (nova) {
    const eq = encontrarEquivalente(subs, nova);
    return { tipo: "nova", nome: nova, equivalente_id: eq?.id ?? null };
  }
  if (l.subempreitada_ia_id) return { tipo: "existente", subempreitada_id: l.subempreitada_ia_id };
  return { tipo: "nenhuma" };
}

/**
 * Nome da sugestão nova partilhada por todos os artigos selecionados
 * (permite «Aceitar sugestão para N artigos» com uma única subempreitada).
 */
export function sugestaoNovaComum(linhas: LinhaRevisao[], artigo_ids: string[]): string | null {
  const alvo = new Set(artigo_ids);
  const nomes = linhas.filter((l) => alvo.has(l.artigo_id)).map((l) => (l.sugestao_nova_subempreitada ?? "").trim());
  if (nomes.length === 0 || nomes.length !== alvo.size) return null;
  if (nomes.some((n) => !n)) return null;
  const chaves = new Set(nomes.map(normalizarNomeSubempreitada));
  return chaves.size === 1 ? nomes[0] : null;
}

/**
 * Rejeitar a sugestão nunca valida o artigo: retira a sugestão e mantém-no
 * explicitamente em «A Rever» até receber uma subempreitada.
 */
export function rejeitarSugestaoOtimista(linhas: LinhaRevisao[], artigo_id: string): LinhaRevisao[] {
  return linhas.map((l) =>
    l.artigo_id === artigo_id
      ? { ...l, sugestao_nova_subempreitada: null, necessita_revisao: true, validado_manual: false }
      : l,
  );
}
