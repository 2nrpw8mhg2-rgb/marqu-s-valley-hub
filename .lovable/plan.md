## Centro de Classificação Inteligente — Evolução do Motor

Reformulação do módulo para que a classificação só corra quando o utilizador a iniciar, e para que cada resultado mostre a razão da classificação e alimente a aprendizagem do sistema.

---

### 1. Mudança de fluxo (deixar de classificar à importação)

- **Remover** o trigger atual `tg_orcamento_artigos_classificacao` que cria automaticamente uma linha em `classificacao_artigos` a cada `INSERT` em `orcamento_artigos`. A importação do MQ deixa de tocar no Motor.
- A tabela `classificacao_artigos` passa a ser populada apenas quando o utilizador carrega em **Iniciar Classificação** para um orçamento.
- Backfill: linhas em `sem_classificacao` que nunca foram tocadas pelo utilizador são apagadas (mantêm-se as que já têm artigo mestre atribuído ou estado `validado`).

### 2. Estado de classificação por orçamento

Nova tabela `orcamento_classificacao_run` (uma linha por execução):

- `orcamento_id`, `estado` (`pendente | em_curso | concluido`), `iniciado_em`, `concluido_em`, `iniciado_por`
- `total_artigos`, `auto_100`, `auto_aprendido`, `parcial_50`, `sem_classificacao`
- RLS standard `authenticated`/`service_role`

A página usa o run mais recente para saber em que fase está o orçamento.

### 3. Razão da classificação ("porquê?")

Adicionar à `classificacao_artigos`:

- `metodo_match` enum: `exato | aprendido | keyword_artigo | keyword_subesp | keyword_esp | manual | nenhum`
- `motivo` text — frase curta explicativa (ex.: "Descrição idêntica ao artigo mestre X", "Aprendido a partir de validação anterior em 03/2026", "Match por palavra-chave 'pavê' na subespecialidade 130.01").
- `candidatos` jsonb — top-3 alternativas `{ artigo_mestre_id, score, motivo }` usadas quando a confiança não é 100%, para o utilizador escolher rapidamente.

### 4. Motor de classificação (server function)

Nova `runClassificacao({ orcamento_id })` em `src/lib/classificacao/classificacao.functions.ts` (lado servidor, `requireSupabaseAuth`). Para cada artigo do orçamento, por ordem de prioridade:

1. **Aprendido** — `classificacao_aprendizagem` com a mesma descrição normalizada → confiança 100, método `aprendido`.
2. **Exato** — `lower(unaccent(descricao))` igual a um único `biblioteca_artigos.descricao` → confiança 100, método `exato`.
3. **Parcial por keywords** — cruza tokens da descrição com `biblioteca_artigo_keywords` / `biblioteca_subespecialidade_keywords` / `biblioteca_especialidade_keywords` (positivas somam, negativas excluem). Score 0-100; >=70 → `necessita_revisao` (50), <70 → guarda como candidato.
4. **Sem match** → `sem_classificacao`, motivo "Nenhuma correspondência encontrada".

A função grava `classificacao_artigos` (upsert por `artigo_origem_id`), atualiza o run, e devolve resumo.

### 5. Aprendizagem contínua

Ao **Validar** uma classificação:

- Insere/atualiza `classificacao_aprendizagem` com `descricao_normalizada → artigo_mestre_id` e contador de ocorrências.
- Se já existia o par com outro artigo mestre, regista correção (atualiza o mais recente).

Ao **Remover classificação validada**, decrementa/limpa a entrada de aprendizagem correspondente.

Isto faz com que a próxima execução do motor classifique automaticamente (método `aprendido`) artigos com a mesma descrição.

### 6. UI — Centro de Classificação Inteligente

Renomear título e estrutura da página `/motor-classificacao`:

**Estado inicial (orçamento sem run):**

- Card central grande com:
  - Resumo do orçamento (nº de artigos importados)
  - Botão primário **"Iniciar Classificação"**
  - Texto curto: "O sistema vai analisar os N artigos importados e propor classificações com base na Biblioteca Mestra e em validações anteriores."
- Nenhuma tabela de "sem classificação" antes do utilizador iniciar.

**Estado em curso:**

- Barra de progresso + contadores em tempo real (polling do run).

**Estado concluído (resultados):**

- Stats: total, auto 100% (exato + aprendido), parcial 50%, sem classificação.
- Tabela com as colunas atuais **+ coluna "Porquê?"** com badge do método e tooltip/popover mostrando `motivo` completo e os 3 candidatos alternativos clicáveis (atribuir num clique).
- Filtros mantidos (estado, pesquisa).
- Ações por linha: **Validar**, **Pesquisar/Editar**, **Remover**.
- Botão **"Re-correr classificação"** (limpa não validados e volta a passar tudo).
- CTA final quando 100% validado: "Avançar para Procurement".

**Selector de orçamento** continua em destaque no topo; mostra ao lado o estado do run (Pendente / Em curso / Concluído em DD/MM).

### 7. Integração com importação de MQ

No editor de orçamento, após importação, substituir o atual toast por banner "MQ importado com N artigos. [Abrir Centro de Classificação]" que navega para `/motor-classificacao?orcamento=<id>` no estado **pendente** (a aguardar clique em Iniciar).

---

### Detalhes técnicos

- **Migration #1**: drop trigger `tg_orcamento_artigos_classificacao` + função associada; apaga linhas órfãs (`estado='sem_classificacao' AND artigo_mestre_id IS NULL`); cria enum `match_method`; adiciona colunas `metodo_match`, `motivo`, `candidatos` à `classificacao_artigos`; cria tabela `orcamento_classificacao_run` com RLS+grants+trigger updated_at.
- **Migration #2 (mesma execução)**: garante que `classificacao_aprendizagem` (já existe) tem índice em `lower(unaccent(descricao))` e coluna `ocorrencias int default 1`.
- **Server function**: corre tudo do lado do servidor (uma única chamada `runClassificacao`); usa `requireSupabaseAuth`. Para volumes grandes, processa em lote de 500 com `upsert`.
- **Polling**: `useQuery` à `orcamento_classificacao_run` com `refetchInterval: 1500` enquanto `estado='em_curso'`.
- **Validar/remover**: atualizadas para escreverem em `classificacao_aprendizagem`.
- **Página**: continua em `src/routes/_app/motor-classificacao.tsx`; refactor de componentes em `src/components/classificacao/` (`StartCard`, `RunProgress`, `ResultsTable`, `WhyPopover`).
- Sidebar passa a mostrar "Centro de Classificação".
- Nesta fase **não há IA generativa**; o "inteligente" vem do score por keywords + memória de aprendizagem. A arquitetura fica pronta para enxertar embeddings/LLM como mais um método na cascata (passo 5 futuro).
