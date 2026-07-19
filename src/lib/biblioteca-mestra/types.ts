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
  subempreitada_principal_id: string | null;
  subempreitada_secundaria_id: string | null;
  confianca_subempreitada: number | null;
  origem_classificacao_subempreitada: "manual" | "regras" | "ia" | "herdada" | null;
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
  | "termo_negativo"
  | "negativo_concorrente"
  | "negativo_incompativel"
  | "unidade_compativel"
  | "capitulo_tipico"
  | "exemplo_real";

export type ConhecimentoOrigem =
  | "ia"
  | "utilizador"
  | "sistema"
  | "importacao"
  | "mapas_quantidades"
  | "biblioteca_mestra"
  | "orcamentos_brutos"
  | "artigos_vizinhos";

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

export type KnowledgeRunReportTermo = {
  id: string;
  tipo: ConhecimentoTipo;
  termo: string;
  peso: number;
  confianca: number;
  origem: ConhecimentoOrigem;
  ocorrencias: number;
  exemplos: string[];
  justificacao: string | null;
  novo: boolean;
  artigoMestreId?: string;
  artigoCodigo?: string;
  artigoDescricao?: string;
};

export type KnowledgeRunReportArtigo = {
  id: string;
  codigo: string;
  descricao: string;
  especialidade?: string;
  subespecialidade?: string;
  categoria?: string;
  totalTermos: number;
  novos: number;
  falhou?: boolean;
  erro?: string | null;
};

export type KnowledgeRunReportEscopo = {
  tipo: "especialidade" | "subespecialidade" | "artigo";
  especialidade?: string;
  subespecialidade?: string;
  artigo?: { id: string; codigo: string; descricao: string };
};

export type KnowledgeRunReport = {
  escopo?: KnowledgeRunReportEscopo;
  execucao?: {
    totalArtigos: number;
    processados: number;
    saltados: number;
    falhados: number;
    modo: string;
  };
  artigo?: {
    id: string;
    codigo: string;
    descricao: string;
    especialidade: string;
    subespecialidade: string;
    categoria: string;
  };
  confiancaGlobal: { antes: number; depois: number };
  perTipo: Record<ConhecimentoTipo, { antes: number; depois: number; delta: number }>;
  perOrigem: Record<string, number>;
  total: number;
  totalNovos: number;
  fontes: {
    historico: { total: number; validados: number; auto: number; descricoesUnicas: number };
    candidatos: { total: number };
    vizinhos: { artigos: number; exemplos: number };
    correcoes: { total: number };
    reutilizados: { total: number };
  };
  termos: KnowledgeRunReportTermo[];
  artigos?: KnowledgeRunReportArtigo[];
  counts: Record<string, number>;
  semHistorico: boolean;
  erro?: string | null;
  log?: { ts: string; msg: string }[];
};



export const CONHECIMENTO_TIPOS: {
  value: ConhecimentoTipo;
  label: string;
  labelShort: string;
  pesoDefault: number;
  className: string;
}[] = [
  { value: "palavra_chave", label: "Palavra-chave positiva", labelShort: "Palavras-chave", pesoDefault: 30, className: "border-blue-500/40 text-blue-700 dark:text-blue-400" },
  { value: "sinonimo", label: "Sinónimo", labelShort: "Sinónimos", pesoDefault: 10, className: "border-violet-500/40 text-violet-700 dark:text-violet-400" },
  { value: "expressao", label: "Expressão", labelShort: "Expressões", pesoDefault: 40, className: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" },
  { value: "material", label: "Material", labelShort: "Materiais", pesoDefault: 8, className: "border-amber-500/40 text-amber-700 dark:text-amber-400" },
  { value: "unidade_compativel", label: "Unidade compatível", labelShort: "📏 Unidades", pesoDefault: 0, className: "border-cyan-500/40 text-cyan-700 dark:text-cyan-400" },
  { value: "capitulo_tipico", label: "Capítulo típico", labelShort: "📂 Capítulos", pesoDefault: 5, className: "border-fuchsia-500/40 text-fuchsia-700 dark:text-fuchsia-400" },
  { value: "exemplo_real", label: "Exemplo real", labelShort: "📝 Exemplos", pesoDefault: 0, className: "border-teal-500/40 text-teal-700 dark:text-teal-400" },
  { value: "negativo_concorrente", label: "Negativo concorrente", labelShort: "⚠️ Concorrentes", pesoDefault: -15, className: "border-amber-500/40 text-amber-700 dark:text-amber-400" },
  { value: "negativo_incompativel", label: "Especialidades excluídas", labelShort: "🚫 Especialidades excluídas", pesoDefault: -60, className: "border-destructive/40 text-destructive" },
];

export const CONHECIMENTO_ORIGENS: {
  value: ConhecimentoOrigem;
  label: string;
  icon: string;
  className: string;
}[] = [
  { value: "utilizador", label: "Utilizador", icon: "👤", className: "border-slate-500/40 text-slate-700 dark:text-slate-300" },
  { value: "ia", label: "IA", icon: "🤖", className: "border-blue-500/40 text-blue-700 dark:text-blue-400" },
  { value: "mapas_quantidades", label: "Histórico validado", icon: "📄", className: "border-amber-500/40 text-amber-700 dark:text-amber-400" },
  { value: "orcamentos_brutos", label: "Orçamentos brutos", icon: "📥", className: "border-cyan-500/40 text-cyan-700 dark:text-cyan-400" },
  { value: "artigos_vizinhos", label: "Artigos vizinhos", icon: "🧭", className: "border-fuchsia-500/40 text-fuchsia-700 dark:text-fuchsia-400" },
  { value: "biblioteca_mestra", label: "Biblioteca Mestra", icon: "📚", className: "border-violet-500/40 text-violet-700 dark:text-violet-400" },
  { value: "sistema", label: "Sistema", icon: "⚙️", className: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" },
  { value: "importacao", label: "Importação", icon: "📥", className: "border-cyan-500/40 text-cyan-700 dark:text-cyan-400" },
];
