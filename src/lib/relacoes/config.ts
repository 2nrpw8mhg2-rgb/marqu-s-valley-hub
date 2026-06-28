// Configuração do Motor de Relações Construtivas (Fase 3)
import type { Obrigatoriedade, TipoRelacao, SeveridadeAlerta } from "./types";

export const RELACOES_CONFIG = {
  // Obrigatoriedades que geram alerta por defeito
  LIMIAR_ALERTA: ["obrigatorio", "muito_frequente"] as Obrigatoriedade[],
  // Tipos de relação consumidos pela análise de omissões
  TIPOS_ANALISADOS: ["complementa", "depende_de"] as TipoRelacao[],
} as const;

export function severidadeDeObrigatoriedade(o: Obrigatoriedade): SeveridadeAlerta {
  if (o === "obrigatorio") return "critico";
  if (o === "muito_frequente") return "aviso";
  return "info";
}

export const TIPO_RELACAO_META: Record<TipoRelacao, { label: string; inverso: TipoRelacao; canonico: boolean; cls: string }> = {
  complementa: { label: "Complementa", inverso: "complementa", canonico: true, cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40" },
  depende_de: { label: "Depende de", inverso: "requerido_por", canonico: true, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40" },
  antecede: { label: "Antecede", inverso: "precede", canonico: true, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40" },
  substitui: { label: "Substitui", inverso: "substituido_por", canonico: true, cls: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/40" },
  incompativel: { label: "Incompatível com", inverso: "incompativel", canonico: true, cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40" },
  opcional: { label: "Opcional em", inverso: "opcional_em", canonico: true, cls: "bg-muted text-muted-foreground border-border" },
  requerido_por: { label: "Requerido por", inverso: "depende_de", canonico: false, cls: "bg-amber-500/10 text-amber-600 border-amber-400/40" },
  precede: { label: "Precede", inverso: "antecede", canonico: false, cls: "bg-emerald-500/10 text-emerald-600 border-emerald-400/40" },
  substituido_por: { label: "Substituído por", inverso: "substitui", canonico: false, cls: "bg-purple-500/10 text-purple-600 border-purple-400/40" },
  opcional_em: { label: "Opcional em", inverso: "opcional", canonico: false, cls: "bg-muted text-muted-foreground border-border" },
};

export const TIPOS_CANONICOS: TipoRelacao[] = ["complementa", "depende_de", "antecede", "substitui", "incompativel", "opcional"];

export const OBRIGATORIEDADE_META: Record<Obrigatoriedade, { label: string; cls: string }> = {
  obrigatorio: { label: "Obrigatório", cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40" },
  muito_frequente: { label: "Muito frequente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40" },
  frequente: { label: "Frequente", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40" },
  opcional: { label: "Opcional", cls: "bg-muted text-muted-foreground border-border" },
  raro: { label: "Raro", cls: "bg-muted/50 text-muted-foreground border-border" },
};

export const OBRIGATORIEDADES: Obrigatoriedade[] = ["obrigatorio", "muito_frequente", "frequente", "opcional", "raro"];

export const PAPEIS_SISTEMA = [
  "principal", "fixacao", "isolamento", "impermeabilizacao", "acabamento",
  "acessorio", "remate", "drenagem", "ventilacao", "ensaio", "outro",
] as const;

export const PAPEL_META: Record<string, { label: string }> = {
  principal: { label: "Principal" },
  fixacao: { label: "Fixação" },
  isolamento: { label: "Isolamento" },
  impermeabilizacao: { label: "Impermeabilização" },
  acabamento: { label: "Acabamento" },
  acessorio: { label: "Acessório" },
  remate: { label: "Remate" },
  drenagem: { label: "Drenagem" },
  ventilacao: { label: "Ventilação" },
  ensaio: { label: "Ensaio" },
  outro: { label: "Outro" },
};

export const CATEGORIAS_SISTEMA = [
  "cobertura", "fachada", "pavimento", "estrutura",
  "impermeabilizacao", "redes", "acabamentos", "outros",
] as const;

export const CATEGORIA_SISTEMA_META: Record<string, { label: string }> = {
  cobertura: { label: "Cobertura" },
  fachada: { label: "Fachada" },
  pavimento: { label: "Pavimento" },
  estrutura: { label: "Estrutura" },
  impermeabilizacao: { label: "Impermeabilização" },
  redes: { label: "Redes" },
  acabamentos: { label: "Acabamentos" },
  outros: { label: "Outros" },
};
