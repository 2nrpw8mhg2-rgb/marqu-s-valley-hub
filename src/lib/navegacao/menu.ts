/**
 * Lógica pura da navegação principal e do percurso administrativo.
 * Sem dependências de React — testável isoladamente.
 */

export const ROTA_BIBLIOTECA = "/administracao/configuracao-ia/biblioteca-subempreitadas" as const;
export const ROTA_CONFIGURACAO_IA = "/administracao/configuracao-ia" as const;
export const ROTA_ADMINISTRACAO = "/administracao" as const;

/** Prefixo antigo mantido apenas para compatibilidade de favoritos/links. */
export const ROTA_BIBLIOTECA_LEGADA = "/biblioteca-mestra" as const;

export type ItemMenu = {
  to: string;
  label: string;
  /** Apenas informativo na UI. */
  descricao?: string;
  phase?: string;
  disabled?: boolean;
};

export type SeccaoMenu = { title: string; items: ItemMenu[]; adminOnly?: boolean };

/** Devolve a rota nova correspondente a uma rota antiga da Biblioteca Mestra. */
export function redirecionamentoBiblioteca(caminho: string): string {
  const resto = caminho.replace(/^\/biblioteca-mestra/, "").replace(/^\/+/, "");
  return resto ? `${ROTA_BIBLIOTECA}/${resto}` : ROTA_BIBLIOTECA;
}

/** Filtra as secções do menu de acordo com as permissões do utilizador. */
export function seccoesVisiveis<T extends { adminOnly?: boolean }>(
  seccoes: readonly T[],
  podeAdministrar: boolean,
): T[] {
  return seccoes.filter((s) => !s.adminOnly || podeAdministrar);
}

/** Verdadeiro quando a rota pertence à área de administração. */
export function eRotaAdministracao(caminho: string): boolean {
  return caminho === ROTA_ADMINISTRACAO || caminho.startsWith(`${ROTA_ADMINISTRACAO}/`);
}

export const BREADCRUMBS_BIBLIOTECA = [
  { label: "Administração", to: ROTA_ADMINISTRACAO },
  { label: "Configuração da IA", to: ROTA_CONFIGURACAO_IA },
  { label: "Biblioteca de Subempreitadas" },
] as const;

export const DESCRICAO_CONFIGURACAO_IA =
  "Gestão das regras, referências e aprendizagem assistida.";

export const DESCRICAO_BIBLIOTECA =
  "Configuração avançada usada para normalização e apoio à IA. Não é uma etapa obrigatória do fluxo diário.";
