/**
 * Navegação entre a vista completa («Todos») e a vista exclusiva «A Rever»
 * do módulo «Preparação de Consultas». Lógica pura, verificável por testes.
 */
import { listarARever, type FiltrosRevisao, type LinhaRevisao } from "./revisao";

export type VistaConsultas = "todos" | "arever";

/** Normaliza o valor vindo do URL; qualquer valor desconhecido volta a «todos». */
export function validarVista(valor: unknown): VistaConsultas {
  return valor === "arever" ? "arever" : "todos";
}

/** Query string correspondente à vista (a vista por omissão não suja o URL). */
export function paramsDaVista(vista: VistaConsultas): { vista?: "arever" } {
  return vista === "arever" ? { vista: "arever" } : {};
}

/** Conteúdo principal de cada vista: «A Rever» mostra exclusivamente casos de revisão. */
export function linhasDaVista(
  linhas: LinhaRevisao[],
  vista: VistaConsultas,
  filtros: FiltrosRevisao = {},
): LinhaRevisao[] {
  return vista === "arever" ? listarARever(linhas, filtros) : linhas;
}

/** Número apresentado no separador «A Rever (N)» e no cartão/contador. */
export function contarARever(linhas: LinhaRevisao[]): number {
  return listarARever(linhas).length;
}

/** Na vista «A Rever» nunca se mostram grupos de subempreitada nem artigos confirmados. */
export function mostraGruposSubempreitada(vista: VistaConsultas): boolean {
  return vista === "todos";
}
