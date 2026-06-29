export type Especialidade = {
  id: string;
  nome: string;
  codigo: string | null;
  descricao: string | null;
  ordem: number;
  ativa: boolean;
};

export type Subespecialidade = {
  id: string;
  especialidade_id: string;
  nome: string;
  codigo: string | null;
  descricao: string | null;
  ordem: number;
  ativa: boolean;
};

export type Categoria = {
  id: string;
  subespecialidade_id: string;
  nome: string;
  codigo: string | null;
  descricao: string | null;
  ordem: number;
  ativa: boolean;
};

export type ArtigoTipo =
  | "servico"
  | "material"
  | "equipamento"
  | "sistema"
  | "mao_obra"
  | "transporte"
  | "taxa_licenca"
  | "outros";

export type ArtigoEstadoIA = "validado" | "criado_auto" | "obsoleto";

export type ArtigoMestre = {
  id: string;
  subespecialidade_id: string;
  categoria_id: string;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  unidade_id: string;
  tipo: ArtigoTipo;
  estado_ia: ArtigoEstadoIA;
  observacoes: string | null;
  ativo: boolean;
};

export type ArtigoKeyword = {
  id: string;
  artigo_id: string;
  termo: string;
  tipo: "positiva" | "negativa";
};

export type Unidade = {
  id: string;
  codigo: string;
  simbolo: string;
  nome: string;
  categoria: string | null;
  ordem: number;
  ativa: boolean;
};

export type TemplateObra = {
  id: string;
  nome: string;
  descricao: string | null;
  ativa: boolean;
};

export const ARTIGO_TIPOS: { value: ArtigoTipo; label: string }[] = [
  { value: "servico", label: "Serviço" },
  { value: "material", label: "Material" },
  { value: "equipamento", label: "Equipamento" },
  { value: "sistema", label: "Sistema" },
  { value: "mao_obra", label: "Mão de obra" },
  { value: "transporte", label: "Transporte" },
  { value: "taxa_licenca", label: "Taxa / Licença" },
  { value: "outros", label: "Outros" },
];

export const ARTIGO_ESTADOS_IA: { value: ArtigoEstadoIA; label: string; dot: string; className: string }[] = [
  { value: "validado", label: "Validado", dot: "bg-green-500", className: "text-green-700 dark:text-green-400 border-green-500/40" },
  { value: "criado_auto", label: "IA", dot: "bg-blue-500", className: "text-blue-700 dark:text-blue-400 border-blue-500/40" },
  { value: "obsoleto", label: "Obsoleto", dot: "bg-yellow-500", className: "text-yellow-700 dark:text-yellow-400 border-yellow-500/40" },
];

export type ConhecimentoTipo =
  | "palavra_chave"
  | "sinonimo"
  | "expressao"
  | "material"
  | "termo_negativo";

export type ConhecimentoOrigem =
  | "ia"
  | "utilizador"
  | "sistema"
  | "importacao"
  | "mapas_quantidades"
  | "biblioteca_mestra";

export type ArtigoConhecimento = {
  id: string;
  artigo_mestre_id: string;
  tipo: ConhecimentoTipo;
  termo: string;
  peso: number;
  origem: ConhecimentoOrigem;
  confianca: number;
  ativo: boolean;
  ocorrencias: number;
  justificacao: string | null;
  exemplos: string[];
  created_at: string;
  updated_at: string;
};

export const CONHECIMENTO_TIPOS: {
  value: ConhecimentoTipo;
  label: string;
  labelShort: string;
  pesoDefault: number;
  className: string;
}[] = [
  { value: "palavra_chave", label: "Palavra-chave", labelShort: "Palavras-chave", pesoDefault: 30, className: "border-blue-500/40 text-blue-700 dark:text-blue-400" },
  { value: "sinonimo", label: "Sinónimo", labelShort: "Sinónimos", pesoDefault: 10, className: "border-violet-500/40 text-violet-700 dark:text-violet-400" },
  { value: "expressao", label: "Expressão", labelShort: "Expressões", pesoDefault: 40, className: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" },
  { value: "material", label: "Material", labelShort: "Materiais", pesoDefault: 8, className: "border-amber-500/40 text-amber-700 dark:text-amber-400" },
  { value: "termo_negativo", label: "Termo negativo", labelShort: "Termos negativos", pesoDefault: -30, className: "border-destructive/40 text-destructive" },
];

export const CONHECIMENTO_ORIGENS: {
  value: ConhecimentoOrigem;
  label: string;
  icon: string;
  className: string;
}[] = [
  { value: "utilizador", label: "Utilizador", icon: "👤", className: "border-slate-500/40 text-slate-700 dark:text-slate-300" },
  { value: "ia", label: "IA", icon: "🤖", className: "border-blue-500/40 text-blue-700 dark:text-blue-400" },
  { value: "mapas_quantidades", label: "Mapas de Quantidades", icon: "📄", className: "border-amber-500/40 text-amber-700 dark:text-amber-400" },
  { value: "biblioteca_mestra", label: "Biblioteca Mestra", icon: "📚", className: "border-violet-500/40 text-violet-700 dark:text-violet-400" },
  { value: "sistema", label: "Sistema", icon: "⚙️", className: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" },
  { value: "importacao", label: "Importação", icon: "📥", className: "border-cyan-500/40 text-cyan-700 dark:text-cyan-400" },
];
