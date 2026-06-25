## Especialidade 010 — Preparação da Obra

Popular a Especialidade 010 com a nova estrutura completa (10 Subespecialidades, 20 Categorias, ~160 Artigos Mestre) e introduzir a infraestrutura de **palavras-chave hierárquicas** da Biblioteca Mestra.

### 1. Nova tabela `biblioteca_especialidade_keywords`

Coexiste com `biblioteca_artigo_keywords` e abre caminho para tabelas equivalentes em Subespecialidades, Categorias e Artigos.

Colunas:
- `id uuid PK`
- `especialidade_id uuid NOT NULL` → FK `biblioteca_especialidades(id) ON DELETE CASCADE`
- `termo text NOT NULL`
- `tipo` — enum partilhado `biblioteca_keyword_tipo` (`'positiva' | 'negativa'`), com migração do `tipo` da tabela existente caso necessário (valores atuais já são `positiva`/`negativa`).
- `peso numeric(5,2) NOT NULL DEFAULT 1.00` — futura ponderação na classificação por IA
- `origem` — novo enum `biblioteca_keyword_origem` (`'manual' | 'ia'`), default `'manual'`
- `ativo boolean NOT NULL DEFAULT true`
- `created_at`, `updated_at` (trigger `set_updated_at`)
- Índices: `(especialidade_id)`, `lower(termo)`
- Único: `(especialidade_id, lower(termo), tipo)`

GRANT + RLS (mesmo padrão das outras tabelas da biblioteca: `authenticated` com USING/CHECK true; `service_role` ALL).

> Nota: as tabelas equivalentes para Subespecialidades, Categorias e Artigos (este último já existe) **não** são criadas agora — entram em planos futuros, seguindo este mesmo esquema. O `peso` e `origem` também serão acrescentados a `biblioteca_artigo_keywords` numa fase posterior, para manter este plano focado.

### 2. Estrutura da Especialidade 010

**Mantém** as 4 Subespecialidades antigas (vazias). **Acrescenta** 10 novas:

| Código | Subespecialidade |
|---|---|
| 010.01 | Planeamento e Organização Inicial |
| 010.02 | Levantamentos e Vistorias |
| 010.03 | Implantação e Marcação |
| 010.04 | Licenças, Autorizações e Comunicação Prévia |
| 010.05 | Segurança e Saúde Inicial |
| 010.06 | Proteções e Salvaguarda |
| 010.07 | Acessos e Logística Inicial |
| 010.08 | Limpeza e Preparação Inicial |
| 010.09 | Ensaios e Diagnósticos Iniciais |
| 010.10-NOVA | Preparação para Procurement *(ver nota)* |

> **Conflito de código 010.10**: já existe `010.10 — Implantação Topográfica`. Para evitar colisão visual, a nova subespecialidade "Preparação para Procurement" será criada com o código **`010.99`** (e a respetiva categoria como `010.99.01`). Assim mantemos a numeração `010.01–010.09` exatamente como o utilizador definiu e isolamos a antiga `010.10`. Pode ser renumerada quando as 4 antigas forem removidas.

Cada nova Subespecialidade recebe automaticamente a Categoria **"Por Classificar"** (`.00`) via trigger. Adicionalmente, cada uma recebe as 2 Categorias do brief (códigos `010.XX.01` e `010.XX.02`, ordem 10 e 20).

Cada Categoria recebe os Artigos Mestre listados (ordem incremental de 10 em 10), com:
- `codigo` = `<codigo_categoria>.<NN>` (ex.: `010.01.01.01`)
- `unidade` = `vg` (valor global) por defeito — apropriado para a maioria destes artigos de planeamento/preparação; pode ser ajustado depois na UI
- `ativo = true`

### 3. Palavras-chave da Especialidade 010

Inserir na nova tabela todas as palavras-chave positivas (23) e negativas (17) listadas pelo utilizador, com `peso = 1.00`, `origem = 'manual'`, `ativo = true`.

### 4. UI

Nenhuma alteração nesta fase. As páginas existentes (`biblioteca-mestra.subespecialidades`, `.categorias`, `.artigos`, `.index`) já refletem o novo conteúdo via leitura da BD. A gestão visual das palavras-chave de Especialidade fica para um plano dedicado.

### Fora de âmbito

- Páginas de gestão de palavras-chave (Especialidade/Subespecialidade/Categoria).
- Tabelas equivalentes para Subespecialidades e Categorias.
- Acrescentar `peso`/`origem` a `biblioteca_artigo_keywords`.
- Eliminação ou renumeração das 4 Subespecialidades antigas (010.10, 010.20, 010.30, 010.40).
- Motor de classificação automática por IA.

### Ficheiros afetados

- 1 migration SQL: cria `biblioteca_especialidade_keywords` (+ enum `biblioteca_keyword_origem`, GRANTs, RLS, trigger `set_updated_at`).
- 1 insert SQL (via tool de dados): cria as 10 Subespecialidades, 20 Categorias manuais, ~160 Artigos Mestre e ~40 palavras-chave da Especialidade 010.
