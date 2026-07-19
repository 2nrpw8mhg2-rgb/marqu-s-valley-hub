export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      artigos_biblioteca: {
        Row: {
          codigo: string | null
          created_at: string
          descricao: string
          especialidade: string | null
          id: string
          preco_referencia: number | null
          ultima_obra_id: string | null
          unidade: string | null
          updated_at: string
          utilizacoes: number
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          descricao: string
          especialidade?: string | null
          id?: string
          preco_referencia?: number | null
          ultima_obra_id?: string | null
          unidade?: string | null
          updated_at?: string
          utilizacoes?: number
        }
        Update: {
          codigo?: string | null
          created_at?: string
          descricao?: string
          especialidade?: string | null
          id?: string
          preco_referencia?: number | null
          ultima_obra_id?: string | null
          unidade?: string | null
          updated_at?: string
          utilizacoes?: number
        }
        Relationships: [
          {
            foreignKeyName: "artigos_biblioteca_ultima_obra_id_fkey"
            columns: ["ultima_obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_aprendizagem_evento: {
        Row: {
          artigo_id: string | null
          autor: string | null
          created_at: string
          id: string
          origem: string
          payload: Json
          tipo: string
        }
        Insert: {
          artigo_id?: string | null
          autor?: string | null
          created_at?: string
          id?: string
          origem?: string
          payload?: Json
          tipo: string
        }
        Update: {
          artigo_id?: string | null
          autor?: string | null
          created_at?: string
          id?: string
          origem?: string
          payload?: Json
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_aprendizagem_evento_artigo_id_fkey"
            columns: ["artigo_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_artigos"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_artigo_conhecimento: {
        Row: {
          artigo_mestre_id: string
          ativo: boolean
          confianca: number
          created_at: string
          exemplos: Json
          id: string
          justificacao: string | null
          ocorrencias: number
          origem: Database["public"]["Enums"]["biblioteca_conhecimento_origem"]
          peso: number
          termo: string
          tipo: Database["public"]["Enums"]["biblioteca_conhecimento_tipo"]
          updated_at: string
        }
        Insert: {
          artigo_mestre_id: string
          ativo?: boolean
          confianca?: number
          created_at?: string
          exemplos?: Json
          id?: string
          justificacao?: string | null
          ocorrencias?: number
          origem?: Database["public"]["Enums"]["biblioteca_conhecimento_origem"]
          peso?: number
          termo: string
          tipo: Database["public"]["Enums"]["biblioteca_conhecimento_tipo"]
          updated_at?: string
        }
        Update: {
          artigo_mestre_id?: string
          ativo?: boolean
          confianca?: number
          created_at?: string
          exemplos?: Json
          id?: string
          justificacao?: string | null
          ocorrencias?: number
          origem?: Database["public"]["Enums"]["biblioteca_conhecimento_origem"]
          peso?: number
          termo?: string
          tipo?: Database["public"]["Enums"]["biblioteca_conhecimento_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_artigo_conhecimento_artigo_mestre_id_fkey"
            columns: ["artigo_mestre_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_artigos"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_artigo_keywords: {
        Row: {
          artigo_id: string
          created_at: string
          id: string
          termo: string
          tipo: Database["public"]["Enums"]["biblioteca_keyword_tipo"]
        }
        Insert: {
          artigo_id: string
          created_at?: string
          id?: string
          termo: string
          tipo?: Database["public"]["Enums"]["biblioteca_keyword_tipo"]
        }
        Update: {
          artigo_id?: string
          created_at?: string
          id?: string
          termo?: string
          tipo?: Database["public"]["Enums"]["biblioteca_keyword_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_artigo_keywords_artigo_id_fkey"
            columns: ["artigo_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_artigos"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_artigo_qualidade: {
        Row: {
          artigo_id: string
          completude: number
          n_classif_auto: number
          n_exemplos: number
          n_expressoes: number
          n_materiais: number
          n_negativos: number
          n_palavras_chave: number
          n_relacoes: number
          n_sinonimos: number
          n_utilizacoes: number
          n_validacoes_humanas: number
          score_qualidade: number
          ultima_auditoria: string | null
          updated_at: string
        }
        Insert: {
          artigo_id: string
          completude?: number
          n_classif_auto?: number
          n_exemplos?: number
          n_expressoes?: number
          n_materiais?: number
          n_negativos?: number
          n_palavras_chave?: number
          n_relacoes?: number
          n_sinonimos?: number
          n_utilizacoes?: number
          n_validacoes_humanas?: number
          score_qualidade?: number
          ultima_auditoria?: string | null
          updated_at?: string
        }
        Update: {
          artigo_id?: string
          completude?: number
          n_classif_auto?: number
          n_exemplos?: number
          n_expressoes?: number
          n_materiais?: number
          n_negativos?: number
          n_palavras_chave?: number
          n_relacoes?: number
          n_sinonimos?: number
          n_utilizacoes?: number
          n_validacoes_humanas?: number
          score_qualidade?: number
          ultima_auditoria?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_artigo_qualidade_artigo_id_fkey"
            columns: ["artigo_id"]
            isOneToOne: true
            referencedRelation: "biblioteca_artigos"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_artigo_relacoes: {
        Row: {
          artigo_destino_id: string
          artigo_origem_id: string
          confianca: number
          created_at: string
          created_by: string | null
          id: string
          obrigatoriedade: Database["public"]["Enums"]["obrigatoriedade_relacao"]
          observacoes: string | null
          origem: Database["public"]["Enums"]["origem_relacao"]
          sistema_id: string | null
          tipo_relacao: Database["public"]["Enums"]["tipo_relacao"]
          updated_at: string
        }
        Insert: {
          artigo_destino_id: string
          artigo_origem_id: string
          confianca?: number
          created_at?: string
          created_by?: string | null
          id?: string
          obrigatoriedade?: Database["public"]["Enums"]["obrigatoriedade_relacao"]
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["origem_relacao"]
          sistema_id?: string | null
          tipo_relacao: Database["public"]["Enums"]["tipo_relacao"]
          updated_at?: string
        }
        Update: {
          artigo_destino_id?: string
          artigo_origem_id?: string
          confianca?: number
          created_at?: string
          created_by?: string | null
          id?: string
          obrigatoriedade?: Database["public"]["Enums"]["obrigatoriedade_relacao"]
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["origem_relacao"]
          sistema_id?: string | null
          tipo_relacao?: Database["public"]["Enums"]["tipo_relacao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_artigo_relacoes_artigo_destino_id_fkey"
            columns: ["artigo_destino_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_artigos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_artigo_relacoes_artigo_origem_id_fkey"
            columns: ["artigo_origem_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_artigos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_artigo_relacoes_sistema_id_fkey"
            columns: ["sistema_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_sistemas_construtivos"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_artigos: {
        Row: {
          ativo: boolean
          categoria_id: string
          codigo: string | null
          confianca_subempreitada: number | null
          created_at: string
          descricao: string
          estado_ia: Database["public"]["Enums"]["biblioteca_artigo_estado_ia"]
          id: string
          observacoes: string | null
          origem_classificacao_subempreitada: string | null
          subempreitada_principal_id: string | null
          subempreitada_secundaria_id: string | null
          subespecialidade_id: string
          tipo: Database["public"]["Enums"]["biblioteca_artigo_tipo"]
          unidade: string | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id: string
          codigo?: string | null
          confianca_subempreitada?: number | null
          created_at?: string
          descricao: string
          estado_ia?: Database["public"]["Enums"]["biblioteca_artigo_estado_ia"]
          id?: string
          observacoes?: string | null
          origem_classificacao_subempreitada?: string | null
          subempreitada_principal_id?: string | null
          subempreitada_secundaria_id?: string | null
          subespecialidade_id: string
          tipo?: Database["public"]["Enums"]["biblioteca_artigo_tipo"]
          unidade?: string | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string
          codigo?: string | null
          confianca_subempreitada?: number | null
          created_at?: string
          descricao?: string
          estado_ia?: Database["public"]["Enums"]["biblioteca_artigo_estado_ia"]
          id?: string
          observacoes?: string | null
          origem_classificacao_subempreitada?: string | null
          subempreitada_principal_id?: string | null
          subempreitada_secundaria_id?: string | null
          subespecialidade_id?: string
          tipo?: Database["public"]["Enums"]["biblioteca_artigo_tipo"]
          unidade?: string | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_artigos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_artigos_subempreitada_principal_id_fkey"
            columns: ["subempreitada_principal_id"]
            isOneToOne: false
            referencedRelation: "subempreitadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_artigos_subempreitada_secundaria_id_fkey"
            columns: ["subempreitada_secundaria_id"]
            isOneToOne: false
            referencedRelation: "subempreitadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_artigos_subespecialidade_id_fkey"
            columns: ["subespecialidade_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_subespecialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_artigos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_auditoria_run: {
        Row: {
          ambito: Json
          concluido_em: string | null
          erro_msg: string | null
          estado: string
          id: string
          iniciado_em: string
          iniciado_por: string | null
          resumo: Json
        }
        Insert: {
          ambito?: Json
          concluido_em?: string | null
          erro_msg?: string | null
          estado?: string
          id?: string
          iniciado_em?: string
          iniciado_por?: string | null
          resumo?: Json
        }
        Update: {
          ambito?: Json
          concluido_em?: string | null
          erro_msg?: string | null
          estado?: string
          id?: string
          iniciado_em?: string
          iniciado_por?: string | null
          resumo?: Json
        }
        Relationships: []
      }
      biblioteca_categorias: {
        Row: {
          ativa: boolean
          codigo: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
          subespecialidade_id: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          subespecialidade_id: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          subespecialidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_categorias_subespecialidade_id_fkey"
            columns: ["subespecialidade_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_subespecialidades"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_especialidade_keywords: {
        Row: {
          ativo: boolean
          created_at: string
          especialidade_id: string
          id: string
          origem: Database["public"]["Enums"]["biblioteca_keyword_origem"]
          peso: number
          termo: string
          tipo: Database["public"]["Enums"]["biblioteca_keyword_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          especialidade_id: string
          id?: string
          origem?: Database["public"]["Enums"]["biblioteca_keyword_origem"]
          peso?: number
          termo: string
          tipo?: Database["public"]["Enums"]["biblioteca_keyword_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          especialidade_id?: string
          id?: string
          origem?: Database["public"]["Enums"]["biblioteca_keyword_origem"]
          peso?: number
          termo?: string
          tipo?: Database["public"]["Enums"]["biblioteca_keyword_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_especialidade_keywords_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_especialidades"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_especialidades: {
        Row: {
          ativa: boolean
          codigo: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      biblioteca_knowledge_run: {
        Row: {
          cancelar: boolean
          concluido_em: string | null
          counts: Json
          created_at: string
          erro_msg: string | null
          estado: string
          falhados: number
          id: string
          iniciado_em: string
          iniciado_por: string | null
          log: Json
          modo: string
          processados: number
          resumo: Json | null
          saltados: number
          scope_ids: Json
          scope_tipo: string
          total_artigos: number
          ultimo_artigo: string | null
          updated_at: string
        }
        Insert: {
          cancelar?: boolean
          concluido_em?: string | null
          counts?: Json
          created_at?: string
          erro_msg?: string | null
          estado?: string
          falhados?: number
          id?: string
          iniciado_em?: string
          iniciado_por?: string | null
          log?: Json
          modo: string
          processados?: number
          resumo?: Json | null
          saltados?: number
          scope_ids?: Json
          scope_tipo: string
          total_artigos?: number
          ultimo_artigo?: string | null
          updated_at?: string
        }
        Update: {
          cancelar?: boolean
          concluido_em?: string | null
          counts?: Json
          created_at?: string
          erro_msg?: string | null
          estado?: string
          falhados?: number
          id?: string
          iniciado_em?: string
          iniciado_por?: string | null
          log?: Json
          modo?: string
          processados?: number
          resumo?: Json | null
          saltados?: number
          scope_ids?: Json
          scope_tipo?: string
          total_artigos?: number
          ultimo_artigo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      biblioteca_sistema_artigos: {
        Row: {
          artigo_id: string
          created_at: string
          id: string
          obrigatoriedade: Database["public"]["Enums"]["obrigatoriedade_relacao"]
          observacoes: string | null
          ordem_execucao: number
          papel: Database["public"]["Enums"]["papel_sistema"]
          sistema_id: string
          updated_at: string
        }
        Insert: {
          artigo_id: string
          created_at?: string
          id?: string
          obrigatoriedade?: Database["public"]["Enums"]["obrigatoriedade_relacao"]
          observacoes?: string | null
          ordem_execucao?: number
          papel?: Database["public"]["Enums"]["papel_sistema"]
          sistema_id: string
          updated_at?: string
        }
        Update: {
          artigo_id?: string
          created_at?: string
          id?: string
          obrigatoriedade?: Database["public"]["Enums"]["obrigatoriedade_relacao"]
          observacoes?: string | null
          ordem_execucao?: number
          papel?: Database["public"]["Enums"]["papel_sistema"]
          sistema_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_sistema_artigos_artigo_id_fkey"
            columns: ["artigo_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_artigos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_sistema_artigos_sistema_id_fkey"
            columns: ["sistema_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_sistemas_construtivos"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_sistemas_construtivos: {
        Row: {
          ativo: boolean
          categoria_sistema: Database["public"]["Enums"]["categoria_sistema"]
          codigo: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_sistema?: Database["public"]["Enums"]["categoria_sistema"]
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_sistema?: Database["public"]["Enums"]["categoria_sistema"]
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      biblioteca_subespecialidade_keywords: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          origem: Database["public"]["Enums"]["biblioteca_keyword_origem"]
          peso: number
          subespecialidade_id: string
          termo: string
          tipo: Database["public"]["Enums"]["biblioteca_keyword_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          origem?: Database["public"]["Enums"]["biblioteca_keyword_origem"]
          peso?: number
          subespecialidade_id: string
          termo: string
          tipo?: Database["public"]["Enums"]["biblioteca_keyword_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          origem?: Database["public"]["Enums"]["biblioteca_keyword_origem"]
          peso?: number
          subespecialidade_id?: string
          termo?: string
          tipo?: Database["public"]["Enums"]["biblioteca_keyword_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_subespecialidade_keywords_subespecialidade_id_fkey"
            columns: ["subespecialidade_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_subespecialidades"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_subespecialidade_regras: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          created_at: string
          descricao: string | null
          id: string
          padrao: string
          prioridade: number
          subespecialidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          padrao: string
          prioridade?: number
          subespecialidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          padrao?: string
          prioridade?: number
          subespecialidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_subespecialidade_regras_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biblioteca_subespecialidade_regras_subespecialidade_id_fkey"
            columns: ["subespecialidade_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_subespecialidades"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_subespecialidades: {
        Row: {
          ativa: boolean
          codigo: string | null
          cor: string | null
          created_at: string
          descricao: string | null
          especialidade_id: string
          id: string
          nome: string
          ordem: number
          pastas_padrao: string[]
          sequencia_construtiva: Json | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          codigo?: string | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          especialidade_id: string
          id?: string
          nome: string
          ordem?: number
          pastas_padrao?: string[]
          sequencia_construtiva?: Json | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          codigo?: string | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          especialidade_id?: string
          id?: string
          nome?: string
          ordem?: number
          pastas_padrao?: string[]
          sequencia_construtiva?: Json | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_subespecialidades_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_especialidades"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_sugestao: {
        Row: {
          artigo_id: string | null
          confianca: number | null
          created_at: string
          criado_por: string | null
          estado: string
          id: string
          justificacao: string | null
          origem: string
          payload: Json
          revisto_em: string | null
          revisto_por: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          artigo_id?: string | null
          confianca?: number | null
          created_at?: string
          criado_por?: string | null
          estado?: string
          id?: string
          justificacao?: string | null
          origem?: string
          payload?: Json
          revisto_em?: string | null
          revisto_por?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          artigo_id?: string | null
          confianca?: number | null
          created_at?: string
          criado_por?: string | null
          estado?: string
          id?: string
          justificacao?: string | null
          origem?: string
          payload?: Json
          revisto_em?: string | null
          revisto_por?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_sugestao_artigo_id_fkey"
            columns: ["artigo_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_artigos"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_unidades: {
        Row: {
          ativa: boolean
          categoria: string | null
          codigo: string
          created_at: string
          id: string
          nome: string
          ordem: number
          simbolo: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          categoria?: string | null
          codigo: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          simbolo: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          categoria?: string | null
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          simbolo?: string
          updated_at?: string
        }
        Relationships: []
      }
      classificacao_aprendizagem: {
        Row: {
          acao: string
          capitulo: string | null
          codigo_artigo: string | null
          confianca_sugerida: number | null
          created_at: string
          descricao_normalizada: string
          descricao_original: string
          especialidade_final: string
          especialidade_sugerida: string | null
          id: string
          obra_id: string | null
          subcapitulo: string | null
          user_id: string
        }
        Insert: {
          acao: string
          capitulo?: string | null
          codigo_artigo?: string | null
          confianca_sugerida?: number | null
          created_at?: string
          descricao_normalizada: string
          descricao_original: string
          especialidade_final: string
          especialidade_sugerida?: string | null
          id?: string
          obra_id?: string | null
          subcapitulo?: string | null
          user_id: string
        }
        Update: {
          acao?: string
          capitulo?: string | null
          codigo_artigo?: string | null
          confianca_sugerida?: number | null
          created_at?: string
          descricao_normalizada?: string
          descricao_original?: string
          especialidade_final?: string
          especialidade_sugerida?: string | null
          id?: string
          obra_id?: string | null
          subcapitulo?: string | null
          user_id?: string
        }
        Relationships: []
      }
      classificacao_artigos: {
        Row: {
          artigo_mestre_id: string | null
          artigo_origem_id: string
          candidatos: Json
          categoria_id: string | null
          confianca: number
          created_at: string
          descricao_original: string
          especialidade_id: string | null
          estado: Database["public"]["Enums"]["classificacao_estado"]
          id: string
          metodo_match: Database["public"]["Enums"]["classificacao_metodo"]
          motivo: string | null
          orcamento_id: string
          quantidade_original: number | null
          subespecialidade_id: string | null
          unidade_original: string | null
          updated_at: string
          validado_em: string | null
          validado_por: string | null
        }
        Insert: {
          artigo_mestre_id?: string | null
          artigo_origem_id: string
          candidatos?: Json
          categoria_id?: string | null
          confianca?: number
          created_at?: string
          descricao_original: string
          especialidade_id?: string | null
          estado?: Database["public"]["Enums"]["classificacao_estado"]
          id?: string
          metodo_match?: Database["public"]["Enums"]["classificacao_metodo"]
          motivo?: string | null
          orcamento_id: string
          quantidade_original?: number | null
          subespecialidade_id?: string | null
          unidade_original?: string | null
          updated_at?: string
          validado_em?: string | null
          validado_por?: string | null
        }
        Update: {
          artigo_mestre_id?: string | null
          artigo_origem_id?: string
          candidatos?: Json
          categoria_id?: string | null
          confianca?: number
          created_at?: string
          descricao_original?: string
          especialidade_id?: string | null
          estado?: Database["public"]["Enums"]["classificacao_estado"]
          id?: string
          metodo_match?: Database["public"]["Enums"]["classificacao_metodo"]
          motivo?: string | null
          orcamento_id?: string
          quantidade_original?: number | null
          subespecialidade_id?: string | null
          unidade_original?: string | null
          updated_at?: string
          validado_em?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classificacao_artigos_artigo_mestre_id_fkey"
            columns: ["artigo_mestre_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_artigos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classificacao_artigos_artigo_origem_id_fkey"
            columns: ["artigo_origem_id"]
            isOneToOne: true
            referencedRelation: "orcamento_artigos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classificacao_artigos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classificacao_artigos_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classificacao_artigos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classificacao_artigos_subespecialidade_id_fkey"
            columns: ["subespecialidade_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_subespecialidades"
            referencedColumns: ["id"]
          },
        ]
      }
      classificacao_cache: {
        Row: {
          created_at: string
          hash: string
          modelo: string
          resultado: Json
        }
        Insert: {
          created_at?: string
          hash: string
          modelo?: string
          resultado: Json
        }
        Update: {
          created_at?: string
          hash?: string
          modelo?: string
          resultado?: Json
        }
        Relationships: []
      }
      classificacao_memoria: {
        Row: {
          artigo_mestre_id: string
          created_at: string
          descricao_normalizada: string
          id: string
          ocorrencias: number
          ultimo_user_id: string | null
          updated_at: string
        }
        Insert: {
          artigo_mestre_id: string
          created_at?: string
          descricao_normalizada: string
          id?: string
          ocorrencias?: number
          ultimo_user_id?: string | null
          updated_at?: string
        }
        Update: {
          artigo_mestre_id?: string
          created_at?: string
          descricao_normalizada?: string
          id?: string
          ocorrencias?: number
          ultimo_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classificacao_memoria_artigo_mestre_id_fkey"
            columns: ["artigo_mestre_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_artigos"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_pastas: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          is_root: boolean
          nome: string
          obra_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          is_root?: boolean
          nome: string
          obra_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          is_root?: boolean
          nome?: string
          obra_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_pastas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_pastas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "documento_pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          nome: string
          obra_id: string | null
          pasta_id: string | null
          storage_path: string
          tamanho: number | null
          tipo: Database["public"]["Enums"]["documento_tipo"]
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          nome: string
          obra_id?: string | null
          pasta_id?: string | null
          storage_path: string
          tamanho?: number | null
          tipo?: Database["public"]["Enums"]["documento_tipo"]
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          nome?: string
          obra_id?: string | null
          pasta_id?: string | null
          storage_path?: string
          tamanho?: number | null
          tipo?: Database["public"]["Enums"]["documento_tipo"]
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "documento_pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          cliente: string | null
          codigo: string | null
          created_at: string
          created_by: string | null
          data_fim_prevista: string | null
          data_inicio: string | null
          descricao: string | null
          estado: Database["public"]["Enums"]["obra_estado"]
          id: string
          localizacao: string | null
          nome: string
          responsavel_id: string | null
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          cliente?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_fim_prevista?: string | null
          data_inicio?: string | null
          descricao?: string | null
          estado?: Database["public"]["Enums"]["obra_estado"]
          id?: string
          localizacao?: string | null
          nome: string
          responsavel_id?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          cliente?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_fim_prevista?: string | null
          data_inicio?: string | null
          descricao?: string | null
          estado?: Database["public"]["Enums"]["obra_estado"]
          id?: string
          localizacao?: string | null
          nome?: string
          responsavel_id?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: []
      }
      orcamento_alertas_tecnicos: {
        Row: {
          artigo_mestre_esperado_id: string
          artigo_mestre_origem_id: string | null
          artigo_mq_id: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_alerta"]
          id: string
          justificacao: string | null
          obrigatoriedade: Database["public"]["Enums"]["obrigatoriedade_relacao"]
          orcamento_id: string
          resolvido_em: string | null
          resolvido_por: string | null
          severidade: Database["public"]["Enums"]["severidade_alerta"]
          sistema_id: string | null
          tipo_relacao: Database["public"]["Enums"]["tipo_relacao"]
          updated_at: string
        }
        Insert: {
          artigo_mestre_esperado_id: string
          artigo_mestre_origem_id?: string | null
          artigo_mq_id?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_alerta"]
          id?: string
          justificacao?: string | null
          obrigatoriedade: Database["public"]["Enums"]["obrigatoriedade_relacao"]
          orcamento_id: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: Database["public"]["Enums"]["severidade_alerta"]
          sistema_id?: string | null
          tipo_relacao: Database["public"]["Enums"]["tipo_relacao"]
          updated_at?: string
        }
        Update: {
          artigo_mestre_esperado_id?: string
          artigo_mestre_origem_id?: string | null
          artigo_mq_id?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_alerta"]
          id?: string
          justificacao?: string | null
          obrigatoriedade?: Database["public"]["Enums"]["obrigatoriedade_relacao"]
          orcamento_id?: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: Database["public"]["Enums"]["severidade_alerta"]
          sistema_id?: string | null
          tipo_relacao?: Database["public"]["Enums"]["tipo_relacao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_alertas_tecnicos_artigo_mestre_esperado_id_fkey"
            columns: ["artigo_mestre_esperado_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_artigos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_alertas_tecnicos_artigo_mestre_origem_id_fkey"
            columns: ["artigo_mestre_origem_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_artigos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_alertas_tecnicos_artigo_mq_id_fkey"
            columns: ["artigo_mq_id"]
            isOneToOne: false
            referencedRelation: "orcamento_artigos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_alertas_tecnicos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_alertas_tecnicos_sistema_id_fkey"
            columns: ["sistema_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_sistemas_construtivos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_artigo_fontes: {
        Row: {
          artigo_id: string
          categoria: string
          created_at: string
          descricao: string
          id: string
          notas: string | null
          selecionado: boolean
          subempreiteiro_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          artigo_id: string
          categoria: string
          created_at?: string
          descricao: string
          id?: string
          notas?: string | null
          selecionado?: boolean
          subempreiteiro_id?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          artigo_id?: string
          categoria?: string
          created_at?: string
          descricao?: string
          id?: string
          notas?: string | null
          selecionado?: boolean
          subempreiteiro_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_artigo_fontes_artigo_id_fkey"
            columns: ["artigo_id"]
            isOneToOne: false
            referencedRelation: "orcamento_artigos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_artigo_fontes_subempreiteiro_id_fkey"
            columns: ["subempreiteiro_id"]
            isOneToOne: false
            referencedRelation: "subempreiteiros"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_artigos: {
        Row: {
          capitulo_id: string | null
          codigo: string | null
          created_at: string
          custo_encargos_gerais: number
          custo_equipamentos: number
          custo_mao_obra: number
          custo_materiais: number
          custo_outros: number
          custo_subempreitadas: number
          custo_tarefeiros: number
          custo_transportes: number
          descricao: string
          id: string
          margem_pct: number
          notas: string | null
          orcamento_id: string
          ordem: number
          preco_seco: number
          preco_unitario: number
          quantidade: number
          subempreitada_confianca: number | null
          subempreitada_id: string | null
          subempreitada_origem: string | null
          subempreitada_razao: string | null
          subempreitada_sugerida_id: string | null
          subempreitada_termos_match: Json | null
          subempreitada_validada_manual: boolean
          unidade: string | null
          unidade_normalizada: string | null
          updated_at: string
        }
        Insert: {
          capitulo_id?: string | null
          codigo?: string | null
          created_at?: string
          custo_encargos_gerais?: number
          custo_equipamentos?: number
          custo_mao_obra?: number
          custo_materiais?: number
          custo_outros?: number
          custo_subempreitadas?: number
          custo_tarefeiros?: number
          custo_transportes?: number
          descricao: string
          id?: string
          margem_pct?: number
          notas?: string | null
          orcamento_id: string
          ordem?: number
          preco_seco?: number
          preco_unitario?: number
          quantidade?: number
          subempreitada_confianca?: number | null
          subempreitada_id?: string | null
          subempreitada_origem?: string | null
          subempreitada_razao?: string | null
          subempreitada_sugerida_id?: string | null
          subempreitada_termos_match?: Json | null
          subempreitada_validada_manual?: boolean
          unidade?: string | null
          unidade_normalizada?: string | null
          updated_at?: string
        }
        Update: {
          capitulo_id?: string | null
          codigo?: string | null
          created_at?: string
          custo_encargos_gerais?: number
          custo_equipamentos?: number
          custo_mao_obra?: number
          custo_materiais?: number
          custo_outros?: number
          custo_subempreitadas?: number
          custo_tarefeiros?: number
          custo_transportes?: number
          descricao?: string
          id?: string
          margem_pct?: number
          notas?: string | null
          orcamento_id?: string
          ordem?: number
          preco_seco?: number
          preco_unitario?: number
          quantidade?: number
          subempreitada_confianca?: number | null
          subempreitada_id?: string | null
          subempreitada_origem?: string | null
          subempreitada_razao?: string | null
          subempreitada_sugerida_id?: string | null
          subempreitada_termos_match?: Json | null
          subempreitada_validada_manual?: boolean
          unidade?: string | null
          unidade_normalizada?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_artigos_capitulo_id_fkey"
            columns: ["capitulo_id"]
            isOneToOne: false
            referencedRelation: "orcamento_capitulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_artigos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_artigos_subempreitada_id_fkey"
            columns: ["subempreitada_id"]
            isOneToOne: false
            referencedRelation: "subempreitadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_artigos_subempreitada_sugerida_id_fkey"
            columns: ["subempreitada_sugerida_id"]
            isOneToOne: false
            referencedRelation: "subempreitadas"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_capitulos: {
        Row: {
          codigo: string | null
          created_at: string
          descricao: string
          id: string
          orcamento_id: string
          ordem: number
          subempreitada_id: string | null
          subempreitada_validada_manual: boolean
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          descricao: string
          id?: string
          orcamento_id: string
          ordem?: number
          subempreitada_id?: string | null
          subempreitada_validada_manual?: boolean
        }
        Update: {
          codigo?: string | null
          created_at?: string
          descricao?: string
          id?: string
          orcamento_id?: string
          ordem?: number
          subempreitada_id?: string | null
          subempreitada_validada_manual?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_capitulos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_capitulos_subempreitada_id_fkey"
            columns: ["subempreitada_id"]
            isOneToOne: false
            referencedRelation: "subempreitadas"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_classificacao_run: {
        Row: {
          auto_aprendido: number
          auto_exato: number
          concluido_em: string | null
          created_at: string
          estado: Database["public"]["Enums"]["classificacao_run_estado"]
          id: string
          iniciado_em: string | null
          iniciado_por: string | null
          orcamento_id: string
          parcial: number
          sem_classificacao: number
          total_artigos: number
          updated_at: string
        }
        Insert: {
          auto_aprendido?: number
          auto_exato?: number
          concluido_em?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["classificacao_run_estado"]
          id?: string
          iniciado_em?: string | null
          iniciado_por?: string | null
          orcamento_id: string
          parcial?: number
          sem_classificacao?: number
          total_artigos?: number
          updated_at?: string
        }
        Update: {
          auto_aprendido?: number
          auto_exato?: number
          concluido_em?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["classificacao_run_estado"]
          id?: string
          iniciado_em?: string | null
          iniciado_por?: string | null
          orcamento_id?: string
          parcial?: number
          sem_classificacao?: number
          total_artigos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_classificacao_run_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          created_at: string
          created_by: string | null
          data_decisao: string | null
          data_envio: string | null
          estado: Database["public"]["Enums"]["orcamento_estado"]
          estado_mq: Database["public"]["Enums"]["estado_mq"]
          id: string
          margem_global_pct: number
          mq_documento_id: string | null
          mq_revisao: string | null
          nome: string
          obra_id: string
          observacoes: string | null
          tipo: string
          updated_at: string
          versao: number
          versao_label: string
          wizard_passo: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_decisao?: string | null
          data_envio?: string | null
          estado?: Database["public"]["Enums"]["orcamento_estado"]
          estado_mq?: Database["public"]["Enums"]["estado_mq"]
          id?: string
          margem_global_pct?: number
          mq_documento_id?: string | null
          mq_revisao?: string | null
          nome: string
          obra_id: string
          observacoes?: string | null
          tipo?: string
          updated_at?: string
          versao?: number
          versao_label?: string
          wizard_passo?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_decisao?: string | null
          data_envio?: string | null
          estado?: Database["public"]["Enums"]["orcamento_estado"]
          estado_mq?: Database["public"]["Enums"]["estado_mq"]
          id?: string
          margem_global_pct?: number
          mq_documento_id?: string | null
          mq_revisao?: string | null
          nome?: string
          obra_id?: string
          observacoes?: string | null
          tipo?: string
          updated_at?: string
          versao?: number
          versao_label?: string
          wizard_passo?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_mq_documento_id_fkey"
            columns: ["mq_documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_pacote_artigos: {
        Row: {
          artigo_id: string | null
          capitulo: string | null
          categoria_custo: string | null
          codigo: string | null
          confianca: number | null
          created_at: string
          descricao: string
          especialidade: string | null
          id: string
          motivo: string | null
          pacote_id: string
          preco_seco_estimado: number
          quantidade: number
          sinalizado_revisao: boolean
          subcapitulo: string | null
          unidade: string | null
        }
        Insert: {
          artigo_id?: string | null
          capitulo?: string | null
          categoria_custo?: string | null
          codigo?: string | null
          confianca?: number | null
          created_at?: string
          descricao: string
          especialidade?: string | null
          id?: string
          motivo?: string | null
          pacote_id: string
          preco_seco_estimado?: number
          quantidade?: number
          sinalizado_revisao?: boolean
          subcapitulo?: string | null
          unidade?: string | null
        }
        Update: {
          artigo_id?: string | null
          capitulo?: string | null
          categoria_custo?: string | null
          codigo?: string | null
          confianca?: number | null
          created_at?: string
          descricao?: string
          especialidade?: string | null
          id?: string
          motivo?: string | null
          pacote_id?: string
          preco_seco_estimado?: number
          quantidade?: number
          sinalizado_revisao?: boolean
          subcapitulo?: string | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procurement_pacote_artigos_artigo_id_fkey"
            columns: ["artigo_id"]
            isOneToOne: false
            referencedRelation: "orcamento_artigos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_pacote_artigos_pacote_id_fkey"
            columns: ["pacote_id"]
            isOneToOne: false
            referencedRelation: "procurement_pacotes"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_pacotes: {
        Row: {
          created_at: string
          created_by: string | null
          especialidade: string
          estado: Database["public"]["Enums"]["procurement_pacote_estado"]
          grupo_consulta: string | null
          id: string
          nome: string
          obra_id: string | null
          observacoes: string | null
          orcamento_id: string
          origem: string
          subempreitada_id: string | null
          subespecialidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          especialidade: string
          estado?: Database["public"]["Enums"]["procurement_pacote_estado"]
          grupo_consulta?: string | null
          id?: string
          nome: string
          obra_id?: string | null
          observacoes?: string | null
          orcamento_id: string
          origem?: string
          subempreitada_id?: string | null
          subespecialidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          especialidade?: string
          estado?: Database["public"]["Enums"]["procurement_pacote_estado"]
          grupo_consulta?: string | null
          id?: string
          nome?: string
          obra_id?: string | null
          observacoes?: string | null
          orcamento_id?: string
          origem?: string
          subempreitada_id?: string | null
          subespecialidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_pacotes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_pacotes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_pacotes_subempreitada_id_fkey"
            columns: ["subempreitada_id"]
            isOneToOne: false
            referencedRelation: "subempreitadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_pacotes_subespecialidade_id_fkey"
            columns: ["subespecialidade_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_subespecialidades"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subempreitada_aprendizagem: {
        Row: {
          artigo_mestre_id: string | null
          created_at: string
          descricao_normalizada: string
          id: string
          peso: number
          subempreitada_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          artigo_mestre_id?: string | null
          created_at?: string
          descricao_normalizada: string
          id?: string
          peso?: number
          subempreitada_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          artigo_mestre_id?: string | null
          created_at?: string
          descricao_normalizada?: string
          id?: string
          peso?: number
          subempreitada_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subempreitada_aprendizagem_artigo_mestre_id_fkey"
            columns: ["artigo_mestre_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_artigos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subempreitada_aprendizagem_subempreitada_id_fkey"
            columns: ["subempreitada_id"]
            isOneToOne: false
            referencedRelation: "subempreitadas"
            referencedColumns: ["id"]
          },
        ]
      }
      subempreitadas: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
          palavras_chave: string[]
          termos_exclusao: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          palavras_chave?: string[]
          termos_exclusao?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          palavras_chave?: string[]
          termos_exclusao?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      subempreiteiros: {
        Row: {
          alvara_valido_ate: string | null
          ativo: boolean
          avaliacao: number | null
          concelho: string | null
          contacto_nome: string | null
          created_at: string
          created_by: string | null
          distrito: string | null
          email: string | null
          emails: string[]
          especialidades: string[]
          id: string
          nif: string | null
          nome: string
          notas: string | null
          seguro_valido_ate: string | null
          subespecialidades: string[]
          telefone: string | null
          telefones: string[]
          tipo: string | null
          updated_at: string
          zonas: string[]
        }
        Insert: {
          alvara_valido_ate?: string | null
          ativo?: boolean
          avaliacao?: number | null
          concelho?: string | null
          contacto_nome?: string | null
          created_at?: string
          created_by?: string | null
          distrito?: string | null
          email?: string | null
          emails?: string[]
          especialidades?: string[]
          id?: string
          nif?: string | null
          nome: string
          notas?: string | null
          seguro_valido_ate?: string | null
          subespecialidades?: string[]
          telefone?: string | null
          telefones?: string[]
          tipo?: string | null
          updated_at?: string
          zonas?: string[]
        }
        Update: {
          alvara_valido_ate?: string | null
          ativo?: boolean
          avaliacao?: number | null
          concelho?: string | null
          contacto_nome?: string | null
          created_at?: string
          created_by?: string | null
          distrito?: string | null
          email?: string | null
          emails?: string[]
          especialidades?: string[]
          id?: string
          nif?: string | null
          nome?: string
          notas?: string | null
          seguro_valido_ate?: string | null
          subespecialidades?: string[]
          telefone?: string | null
          telefones?: string[]
          tipo?: string | null
          updated_at?: string
          zonas?: string[]
        }
        Relationships: []
      }
      template_obra_pacotes: {
        Row: {
          created_at: string
          id: string
          ordem: number
          pacote_id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordem?: number
          pacote_id: string
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ordem?: number
          pacote_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_obra_pacotes_pacote_id_fkey"
            columns: ["pacote_id"]
            isOneToOne: false
            referencedRelation: "procurement_pacotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_obra_pacotes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_obra"
            referencedColumns: ["id"]
          },
        ]
      }
      templates_obra: {
        Row: {
          ativa: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      criar_pastas_padrao_obra: {
        Args: { _obra_id: string }
        Returns: undefined
      }
      gerar_pacotes_por_subempreitada: {
        Args: { p_orcamento_id: string }
        Returns: {
          artigos_incluidos: number
          pacotes_atualizados: number
          pacotes_criados: number
        }[]
      }
      normalizar_descricao: { Args: { _t: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "orcamentista" | "diretor_obra" | "comprador"
      biblioteca_artigo_estado_ia: "validado" | "criado_auto" | "obsoleto"
      biblioteca_artigo_tipo:
        | "servico"
        | "material"
        | "equipamento"
        | "sistema"
        | "mao_obra"
        | "transporte"
        | "taxa_licenca"
        | "outros"
      biblioteca_conhecimento_origem:
        | "ia"
        | "utilizador"
        | "sistema"
        | "importacao"
        | "mapas_quantidades"
        | "biblioteca_mestra"
        | "orcamentos_brutos"
        | "artigos_vizinhos"
      biblioteca_conhecimento_tipo:
        | "palavra_chave"
        | "sinonimo"
        | "expressao"
        | "material"
        | "termo_negativo"
        | "negativo_concorrente"
        | "negativo_incompativel"
        | "unidade_compativel"
        | "capitulo_tipico"
        | "exemplo_real"
      biblioteca_keyword_origem: "manual" | "ia"
      biblioteca_keyword_tipo: "positiva" | "negativa"
      categoria_sistema:
        | "cobertura"
        | "fachada"
        | "pavimento"
        | "estrutura"
        | "impermeabilizacao"
        | "redes"
        | "acabamentos"
        | "outros"
      classificacao_estado:
        | "classificado_auto"
        | "necessita_revisao"
        | "sem_classificacao"
        | "validado"
      classificacao_metodo:
        | "exato"
        | "aprendido"
        | "keyword_artigo"
        | "keyword_subesp"
        | "keyword_esp"
        | "manual"
        | "nenhum"
      classificacao_run_estado: "pendente" | "em_curso" | "concluido"
      documento_tipo:
        | "projeto"
        | "mq"
        | "caderno_encargos"
        | "proposta"
        | "outro"
      estado_alerta:
        | "aberto"
        | "aceite_omissao"
        | "justificado"
        | "ignorado"
        | "resolvido"
      estado_mq:
        | "importado"
        | "em_classificacao"
        | "aguardando_validacao"
        | "validado"
        | "convertido_pacotes"
      obra_estado: "oportunidade" | "em_curso" | "concluida" | "cancelada"
      obrigatoriedade_relacao:
        | "obrigatorio"
        | "muito_frequente"
        | "frequente"
        | "opcional"
        | "raro"
      orcamento_estado:
        | "rascunho"
        | "enviado"
        | "adjudicado"
        | "perdido"
        | "cancelado"
      origem_relacao:
        | "manual"
        | "sistema"
        | "auto_inverso"
        | "ia"
        | "aprendizagem"
      papel_sistema:
        | "principal"
        | "fixacao"
        | "isolamento"
        | "impermeabilizacao"
        | "acabamento"
        | "acessorio"
        | "remate"
        | "drenagem"
        | "ventilacao"
        | "ensaio"
        | "outro"
      procurement_pacote_estado:
        | "por_preparar"
        | "preparado"
        | "enviado"
        | "em_analise"
        | "adjudicado"
        | "cancelado"
      severidade_alerta: "critico" | "aviso" | "info"
      tipo_relacao:
        | "complementa"
        | "depende_de"
        | "antecede"
        | "substitui"
        | "incompativel"
        | "opcional"
        | "requerido_por"
        | "precede"
        | "substituido_por"
        | "opcional_em"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "orcamentista", "diretor_obra", "comprador"],
      biblioteca_artigo_estado_ia: ["validado", "criado_auto", "obsoleto"],
      biblioteca_artigo_tipo: [
        "servico",
        "material",
        "equipamento",
        "sistema",
        "mao_obra",
        "transporte",
        "taxa_licenca",
        "outros",
      ],
      biblioteca_conhecimento_origem: [
        "ia",
        "utilizador",
        "sistema",
        "importacao",
        "mapas_quantidades",
        "biblioteca_mestra",
        "orcamentos_brutos",
        "artigos_vizinhos",
      ],
      biblioteca_conhecimento_tipo: [
        "palavra_chave",
        "sinonimo",
        "expressao",
        "material",
        "termo_negativo",
        "negativo_concorrente",
        "negativo_incompativel",
        "unidade_compativel",
        "capitulo_tipico",
        "exemplo_real",
      ],
      biblioteca_keyword_origem: ["manual", "ia"],
      biblioteca_keyword_tipo: ["positiva", "negativa"],
      categoria_sistema: [
        "cobertura",
        "fachada",
        "pavimento",
        "estrutura",
        "impermeabilizacao",
        "redes",
        "acabamentos",
        "outros",
      ],
      classificacao_estado: [
        "classificado_auto",
        "necessita_revisao",
        "sem_classificacao",
        "validado",
      ],
      classificacao_metodo: [
        "exato",
        "aprendido",
        "keyword_artigo",
        "keyword_subesp",
        "keyword_esp",
        "manual",
        "nenhum",
      ],
      classificacao_run_estado: ["pendente", "em_curso", "concluido"],
      documento_tipo: [
        "projeto",
        "mq",
        "caderno_encargos",
        "proposta",
        "outro",
      ],
      estado_alerta: [
        "aberto",
        "aceite_omissao",
        "justificado",
        "ignorado",
        "resolvido",
      ],
      estado_mq: [
        "importado",
        "em_classificacao",
        "aguardando_validacao",
        "validado",
        "convertido_pacotes",
      ],
      obra_estado: ["oportunidade", "em_curso", "concluida", "cancelada"],
      obrigatoriedade_relacao: [
        "obrigatorio",
        "muito_frequente",
        "frequente",
        "opcional",
        "raro",
      ],
      orcamento_estado: [
        "rascunho",
        "enviado",
        "adjudicado",
        "perdido",
        "cancelado",
      ],
      origem_relacao: [
        "manual",
        "sistema",
        "auto_inverso",
        "ia",
        "aprendizagem",
      ],
      papel_sistema: [
        "principal",
        "fixacao",
        "isolamento",
        "impermeabilizacao",
        "acabamento",
        "acessorio",
        "remate",
        "drenagem",
        "ventilacao",
        "ensaio",
        "outro",
      ],
      procurement_pacote_estado: [
        "por_preparar",
        "preparado",
        "enviado",
        "em_analise",
        "adjudicado",
        "cancelado",
      ],
      severidade_alerta: ["critico", "aviso", "info"],
      tipo_relacao: [
        "complementa",
        "depende_de",
        "antecede",
        "substitui",
        "incompativel",
        "opcional",
        "requerido_por",
        "precede",
        "substituido_por",
        "opcional_em",
      ],
    },
  },
} as const
