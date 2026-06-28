export type TipoRelacao =
  | "complementa" | "depende_de" | "antecede" | "substitui" | "incompativel" | "opcional"
  | "requerido_por" | "precede" | "substituido_por" | "opcional_em";

export type Obrigatoriedade = "obrigatorio" | "muito_frequente" | "frequente" | "opcional" | "raro";

export type PapelSistema =
  | "principal" | "fixacao" | "isolamento" | "impermeabilizacao" | "acabamento"
  | "acessorio" | "remate" | "drenagem" | "ventilacao" | "ensaio" | "outro";

export type CategoriaSistema =
  | "cobertura" | "fachada" | "pavimento" | "estrutura"
  | "impermeabilizacao" | "redes" | "acabamentos" | "outros";

export type OrigemRelacao = "manual" | "sistema" | "auto_inverso" | "ia" | "aprendizagem";

export type SeveridadeAlerta = "critico" | "aviso" | "info";

export type EstadoAlerta = "aberto" | "aceite_omissao" | "justificado" | "ignorado" | "resolvido";

export type SistemaConstrutivo = {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  categoria_sistema: CategoriaSistema;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type SistemaArtigo = {
  id: string;
  sistema_id: string;
  artigo_id: string;
  papel: PapelSistema;
  obrigatoriedade: Obrigatoriedade;
  ordem_execucao: number;
  observacoes: string | null;
};

export type ArtigoRelacao = {
  id: string;
  artigo_origem_id: string;
  artigo_destino_id: string;
  tipo_relacao: TipoRelacao;
  obrigatoriedade: Obrigatoriedade;
  confianca: number;
  sistema_id: string | null;
  origem: OrigemRelacao;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type AlertaTecnico = {
  id: string;
  orcamento_id: string;
  artigo_mq_id: string | null;
  artigo_mestre_origem_id: string | null;
  artigo_mestre_esperado_id: string;
  sistema_id: string | null;
  tipo_relacao: TipoRelacao;
  obrigatoriedade: Obrigatoriedade;
  severidade: SeveridadeAlerta;
  estado: EstadoAlerta;
  justificacao: string | null;
  resolvido_por: string | null;
  resolvido_em: string | null;
  created_at: string;
  updated_at: string;
};
