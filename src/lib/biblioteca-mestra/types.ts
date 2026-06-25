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

export type ArtigoEstadoIA = "validado" | "revisto" | "criado_auto" | "pendente";

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
  { value: "revisto", label: "Revisto", dot: "bg-yellow-500", className: "text-yellow-700 dark:text-yellow-400 border-yellow-500/40" },
  { value: "criado_auto", label: "Criado automaticamente", dot: "bg-blue-500", className: "text-blue-700 dark:text-blue-400 border-blue-500/40" },
  { value: "pendente", label: "Pendente de validação", dot: "bg-red-500", className: "text-red-700 dark:text-red-400 border-red-500/40" },
];
