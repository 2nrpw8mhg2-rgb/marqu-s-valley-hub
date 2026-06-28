## Motor de Classificação — Arquitetura Base

Novo módulo no menu principal (abaixo de Biblioteca Mestra) que recebe os artigos importados de Mapas de Quantidades e permite atribuir/validar manualmente a sua classificação contra a Biblioteca Mestra. Sem IA nesta fase — apenas a arquitetura, fluxo e UI.

---

### 1. Base de dados (migration)

Nova tabela `classificacao_artigos`:

- `artigo_origem_id` → FK `orcamento_artigos.id` (on delete cascade)
- `orcamento_id` → FK `orcamentos.id` (para filtros rápidos por MQ)
- `descricao_original`, `unidade_original`, `quantidade_original` (snapshot)
- `especialidade_id`, `subespecialidade_id`, `categoria_id`, `artigo_mestre_id` (FKs nullable para `biblioteca_*`)
- `confianca` int (0 / 50 / 100)
- `estado` enum: `classificado_auto | necessita_revisao | sem_classificacao | validado`
- `validado_por` uuid, `validado_em` timestamptz
- `created_at`, `updated_at`
- Constraint única `(artigo_origem_id)` — 1 classificação por artigo do MQ
- Índices em `orcamento_id`, `estado`, `artigo_mestre_id`
- RLS: `authenticated` full CRUD; `service_role` ALL
- Trigger `set_updated_at`

Trigger no `INSERT` de `orcamento_artigos` (ou função invocada após importação MQ) que cria automaticamente uma linha em `classificacao_artigos` com `estado = sem_classificacao` e `confianca = 0`. Lookup direto (descrição exata case-insensitive contra `biblioteca_artigos.descricao`) preenche automaticamente como `classificado_auto / 100`. Sem match → fica `sem_classificacao / 0`. (Lógica de "parcial / 50" fica preparada mas não é usada nesta fase.)

### 2. Server functions (`src/lib/classificacao/classificacao.functions.ts`)

- `listClassificacoes({ orcamento_id?, estado?, search? })` → join com biblioteca para devolver labels
- `searchBibliotecaMestra({ search?, especialidade_id?, subespecialidade_id?, categoria_id? })` → para o diálogo de pesquisa manual
- `atribuirArtigoMestre({ classificacao_id, artigo_mestre_id })` → preenche esp/subesp/cat a partir do artigo mestre, marca `classificado_auto / 100`
- `validarClassificacao({ classificacao_id })` → `estado = validado`, guarda `validado_por/em`
- `removerClassificacao({ classificacao_id })` → limpa FKs, volta a `sem_classificacao / 0`
- `reclassificarOrcamento({ orcamento_id })` → re-corre o auto-match para artigos ainda sem classificação

Todas com `requireSupabaseAuth`.

### 3. UI — Rota `/_app/motor-classificacao`

Nova entrada na `AppSidebar` logo abaixo de "Biblioteca Mestra".

Página principal:

- **Header** com filtros: seletor de Orçamento/MQ, filtro por Estado, pesquisa por texto, contadores (total / validados / por rever / sem classificação)
- **Tabela** com colunas:
  `Artigo Original | Especialidade | Subespecialidade | Categoria | Artigo Mestre | Un. | Tipo | Confiança | Estado | Ações`
  - Badge de estado colorido (verde validado, azul auto, amarelo revisão, cinza sem)
  - Badge de confiança (100/50/0)
  - Ações por linha: **Pesquisar** (abre diálogo), **Validar**, **Editar** (reabre diálogo), **Remover classificação**
- **Diálogo "Pesquisar na Biblioteca Mestra"** (`SearchBibliotecaDialog`):
  - Filtros em cascata: Especialidade → Subespecialidade → Categoria
  - Pesquisa por texto sobre Artigo Mestre
  - Lista resultados com descrição, unidade, tipo
  - Ao selecionar → chama `atribuirArtigoMestre` e fecha
- Ações em lote no toolbar: "Validar todos os 100%", "Re-correr classificação automática"

### 4. Integração com importação de MQ

No fluxo existente `ImportMQDialog` / handler de importação em `orcamentos.$id.*`: após inserir artigos, invocar `reclassificarOrcamento` e, em vez de mostrar apenas "X artigos importados", mostrar CTA "Abrir Motor de Classificação" que navega para `/motor-classificacao?orcamento=<id>`.

### 5. Fora de scope (fases futuras)

- IA / embeddings / fuzzy matching avançado (campo `confianca` já existe e aceitará novos valores)
- Aprendizagem a partir de validações (a tabela `classificacao_aprendizagem` já existe e será alimentada mais tarde)
- Bloqueio do Procurement/Financeiro até validação total — esta fase apenas regista; não bloqueia

---

### Detalhes técnicos

- Tabela `classificacao_artigos` segue o padrão das outras tabelas da Biblioteca (RLS + GRANT a `authenticated` e `service_role`, trigger `set_updated_at`).
- Auto-match inicial: `lower(unaccent(descricao_original)) = lower(unaccent(biblioteca_artigos.descricao))`. Se >1 match, fica `necessita_revisao / 50`.
- Rota nova: `src/routes/_app/motor-classificacao.tsx` (+ `index.tsx` se houver sub-páginas futuras). `AppSidebar.tsx` recebe a nova entrada.
- Tipos TS são regenerados após a migration; só depois escrevo as functions e a UI.
