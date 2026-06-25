## Fase 3 — Categorias (nível intermédio Subespecialidade → Categoria → Artigo)

Esta é a primeira das quatro camadas pedidas. Relações, Sequências Construtivas e Regras de Classificação ficam para fases seguintes, cada uma com plano próprio.

### Consolidação prévia das tabelas de artigos

Existem duas tabelas:

- `biblioteca_artigos` — nova, ligada a `subespecialidade_id`, usada pela Biblioteca Mestra (`biblioteca-mestra.artigos`, `keywords`, `index`). Vazia.
- `artigos_biblioteca` — legado, com campo `especialidade` em texto, usada por `biblioteca.tsx` (rota antiga) e por `orcamentos.$id.index.tsx`. Vazia.

Decisão: `biblioteca_artigos` é a oficial. Nesta fase:

- Marco a rota antiga `/biblioteca` (`src/routes/_app/biblioteca.tsx`) como obsoleta, redirecionando para `/biblioteca-mestra`.
- Atualizo `orcamentos.$id.index.tsx` para gravar o histórico de utilização em `biblioteca_artigos` (mesmos campos: `codigo`, `descricao`, `unidade`, `preco_referencia`, `utilizacoes`, `ultima_obra_id`). Como o esquema novo exige `subespecialidade_id`, o upsert por descrição usa a subespecialidade "Por Classificar" (ver abaixo) quando o artigo é novo.
- `artigos_biblioteca` fica intocada na BD (ambas vazias) e será removida numa fase posterior depois de validado que nada lê dela.

### Modelo de dados — Categorias

Nova tabela `public.biblioteca_categorias`:

- `id` uuid PK
- `subespecialidade_id` uuid NOT NULL → `biblioteca_subespecialidades(id)` ON DELETE RESTRICT
- `nome` text NOT NULL
- `codigo` text — sugestão automática `<codigo_subesp>.<ordem/10>` (ex.: `100.40.10`)
- `descricao` text
- `ordem` int NOT NULL default 10
- `ativa` boolean NOT NULL default true
- `created_at`, `updated_at` timestamptz com trigger `set_updated_at`
- UNIQUE `(subespecialidade_id, nome)`
- Índices em `subespecialidade_id` e `ordem`

A "Especialidade associada" pedida nos campos é derivada via `subespecialidade_id → especialidade_id` (não duplico).

RLS + GRANTs (authenticated full CRUD, service_role ALL) seguindo o padrão das outras tabelas da Biblioteca Mestra.

### Categoria "Por Classificar"

- Inserção: criar 1 categoria `Por Classificar` em CADA subespecialidade existente, com `codigo = '<codsubesp>.00'`, `ordem = 0`, `ativa = true`.
- Trigger `AFTER INSERT` em `biblioteca_subespecialidades` que cria automaticamente a categoria "Por Classificar" para qualquer nova subespecialidade futura.
- Esta categoria é protegida: uma constraint/trigger impede eliminação enquanto for a única da subespecialidade, e impede mudar o nome para outro valor. UI mostra-a com badge especial e sem botões de editar/eliminar.

### Ligação Artigo → Categoria

Em `biblioteca_artigos`:

- Adicionar `categoria_id uuid` referenciando `biblioteca_categorias(id) ON DELETE RESTRICT`.
- Backfill (tabela vazia, mas mantém-se o passo): para cada artigo existente, copiar para a categoria "Por Classificar" da respetiva subespecialidade.
- Tornar `categoria_id` NOT NULL após backfill.
- A coluna `subespecialidade_id` é mantida (redundante, mas evita JOIN em listagens e mantém integridade) e validada via trigger: `categoria.subespecialidade_id` deve coincidir com `artigo.subespecialidade_id`. Mover um artigo de categoria entre subespecialidades atualiza ambas as colunas em conjunto.

### UI — Gestão de Categorias

Nova rota `src/routes/_app/biblioteca-mestra.categorias.tsx` (entrada no menu lateral da Biblioteca Mestra, entre Subespecialidades e Artigos):

Layout master/detail em 3 colunas:

```text
┌──────────────┬───────────────────┬────────────────────────────────┐
│ Especialidade│ Subespecialidade  │ Categorias da subespecialidade │
│ (14)         │ (filtradas)       │ + nº de artigos por categoria   │
└──────────────┴───────────────────┴────────────────────────────────┘
```

- Pesquisa global (nome/código) que cruza as 3 colunas.
- CRUD via Dialog (nome, código auto-sugerido, descrição, ordem).
- Reordenar com ↑/↓ (swap de `ordem`).
- Switch ativa/inativa inline.
- Botão "Mover" para transferir categoria para outra subespecialidade (move também todos os artigos contidos, atualizando `subespecialidade_id` e `categoria_id`).
- Eliminar bloqueado se existirem artigos (AlertDialog com contagem e ação rápida "Mover artigos para Por Classificar e eliminar").
- A categoria "Por Classificar" aparece sempre no topo, sem ações destrutivas.

### UI — Atualização da página Artigos Mestre

`src/routes/_app/biblioteca-mestra.artigos.tsx`:

- Adicionar filtros em cascata: Especialidade → Subespecialidade → Categoria.
- Coluna "Categoria" na tabela.
- Form de criar/editar artigo: Select obrigatório de Categoria (filtrado pela Subespecialidade escolhida).
- Ferramentas de organização em massa:
  - Checkbox por linha + checkbox no cabeçalho ("selecionar tudo na vista filtrada").
  - Barra de ação para a seleção: "Mover para categoria…" (dialog com Especialidade → Subespecialidade → Categoria), "Ativar/Desativar", "Eliminar".
  - Atalho explícito "Filtrar: Por Classificar" para limpar a fila de artigos não organizados.
- Botão "Sugerir categoria com IA" (por linha e para a seleção): chama uma server function que envia descrição + lista de categorias candidatas da mesma subespecialidade para o Lovable AI Gateway e devolve a categoria sugerida + confiança. O utilizador confirma antes de aplicar. Não persiste regras nem aprendizagem nesta fase (isso fica para Regras de Classificação).

### Atualizações em rotas existentes

- `biblioteca-mestra.tsx` (layout): novo item de menu "Categorias".
- `biblioteca-mestra.index.tsx` (dashboard): card com nº de categorias e nº de artigos em "Por Classificar".
- `biblioteca.tsx`: redirecionar para `/biblioteca-mestra/artigos`.
- `orcamentos.$id.index.tsx`: passar a escrever em `biblioteca_artigos` com `subespecialidade_id` e `categoria_id` da subespecialidade/categoria "Por Classificar" (resolvidos por uma helper). Sem mudança de UX para o utilizador.

### Detalhes técnicos

- Server function `suggestCategoria` em `src/lib/biblioteca.functions.ts` com `requireSupabaseAuth`, usando `LOVABLE_API_KEY` via Lovable AI Gateway (`google/gemini-2.5-flash`). Input: `{ descricao, subespecialidadeId }`. Output: `{ categoriaId, confianca }`.
- Mutações em lote (mover seleção) usam um único `update ... in (ids)` por chunk de 200.
- Trigger de coerência `subespecialidade_id`/`categoria.subespecialidade_id` em `biblioteca_artigos` (BEFORE INSERT/UPDATE).
- Trigger `AFTER INSERT` em `biblioteca_subespecialidades` para criar "Por Classificar".
- Trigger BEFORE UPDATE/DELETE em `biblioteca_categorias` a proteger a categoria "Por Classificar" (identificada por `ordem = 0` + nome).

### Fora de âmbito desta fase

- Relações entre Artigos.
- Sequências Construtivas.
- Regras de Classificação (persistência de aprendizagem da IA).
- Remoção definitiva da tabela `artigos_biblioteca`.
- Drag-and-drop para reordenar.

### Ficheiros afetados

- Migração SQL: nova tabela `biblioteca_categorias`, alteração `biblioteca_artigos`, triggers, seed "Por Classificar".
- Novo: `src/routes/_app/biblioteca-mestra.categorias.tsx`, `src/lib/biblioteca.functions.ts`.
- Editados: `biblioteca-mestra.tsx`, `biblioteca-mestra.artigos.tsx`, `biblioteca-mestra.index.tsx`, `biblioteca.tsx`, `orcamentos.$id.index.tsx`.
