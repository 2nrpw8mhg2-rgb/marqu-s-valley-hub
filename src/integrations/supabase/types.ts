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
      biblioteca_artigos: {
        Row: {
          ativo: boolean
          categoria_id: string
          codigo: string | null
          created_at: string
          descricao: string
          estado_ia: Database["public"]["Enums"]["biblioteca_artigo_estado_ia"]
          id: string
          observacoes: string | null
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
          created_at?: string
          descricao: string
          estado_ia?: Database["public"]["Enums"]["biblioteca_artigo_estado_ia"]
          id?: string
          observacoes?: string | null
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
          created_at?: string
          descricao?: string
          estado_ia?: Database["public"]["Enums"]["biblioteca_artigo_estado_ia"]
          id?: string
          observacoes?: string | null
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
          unidade: string | null
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
          unidade?: string | null
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
          unidade?: string | null
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
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          descricao: string
          id?: string
          orcamento_id: string
          ordem?: number
        }
        Update: {
          codigo?: string | null
          created_at?: string
          descricao?: string
          id?: string
          orcamento_id?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_capitulos_orcamento_id_fkey"
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
          id: string
          margem_global_pct: number
          nome: string
          obra_id: string
          observacoes: string | null
          updated_at: string
          versao: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_decisao?: string | null
          data_envio?: string | null
          estado?: Database["public"]["Enums"]["orcamento_estado"]
          id?: string
          margem_global_pct?: number
          nome: string
          obra_id: string
          observacoes?: string | null
          updated_at?: string
          versao?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_decisao?: string | null
          data_envio?: string | null
          estado?: Database["public"]["Enums"]["orcamento_estado"]
          id?: string
          margem_global_pct?: number
          nome?: string
          obra_id?: string
          observacoes?: string | null
          updated_at?: string
          versao?: number
        }
        Relationships: [
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
      biblioteca_keyword_origem: "manual" | "ia"
      biblioteca_keyword_tipo: "positiva" | "negativa"
      documento_tipo:
        | "projeto"
        | "mq"
        | "caderno_encargos"
        | "proposta"
        | "outro"
      obra_estado: "oportunidade" | "em_curso" | "concluida" | "cancelada"
      orcamento_estado:
        | "rascunho"
        | "enviado"
        | "adjudicado"
        | "perdido"
        | "cancelado"
      procurement_pacote_estado:
        | "por_preparar"
        | "preparado"
        | "enviado"
        | "em_analise"
        | "adjudicado"
        | "cancelado"
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
      biblioteca_keyword_origem: ["manual", "ia"],
      biblioteca_keyword_tipo: ["positiva", "negativa"],
      documento_tipo: [
        "projeto",
        "mq",
        "caderno_encargos",
        "proposta",
        "outro",
      ],
      obra_estado: ["oportunidade", "em_curso", "concluida", "cancelada"],
      orcamento_estado: [
        "rascunho",
        "enviado",
        "adjudicado",
        "perdido",
        "cancelado",
      ],
      procurement_pacote_estado: [
        "por_preparar",
        "preparado",
        "enviado",
        "em_analise",
        "adjudicado",
        "cancelado",
      ],
    },
  },
} as const
