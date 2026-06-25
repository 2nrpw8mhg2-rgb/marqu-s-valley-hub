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

export type ArtigoMestre = {
  id: string;
  subespecialidade_id: string;
  categoria_id: string;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  observacoes: string | null;
  ativo: boolean;
};

export type ArtigoKeyword = {
  id: string;
  artigo_id: string;
  termo: string;
  tipo: "positiva" | "negativa";
};

export type TemplateObra = {
  id: string;
  nome: string;
  descricao: string | null;
  ativa: boolean;
};
