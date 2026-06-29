# Fase 2 — Knowledge Builder (Motor de Enriquecimento da Biblioteca)

## Objetivo

Criar um novo módulo na Biblioteca Mestra que usa IA para gerar automaticamente a Base de Conhecimento (palavras-chave, sinónimos, expressões, materiais, termos negativos) de cada Artigo Mestre, aprendendo principalmente a partir dos Mapas de Quantidades reais já classificados.

Nesta fase **não altero** o motor de classificação atual — apenas gero e gravo conhecimento na tabela `biblioteca_artigo_conhecimento` (já criada na Fase 1).

## Âmbito desta fase

- Permitir gerar para: **uma Especialidade** (com sub-seletor opcional de subespecialidade ou artigo único).
- "Toda a Biblioteca" fica visível mas **desativada** com tooltip "Disponível após validação".
- Validação inicial sobre `010 — Preparação da Obra`.

## Alterações

### 1. Novo item no menu (`src/components/AppSidebar.tsx`)
Adicionar na secção "Biblioteca Mestra":
- `/biblioteca-mestra/knowledge-builder` — ícone `Brain` (Sparkles) — label **"Knowledge Builder"**.

### 2. Nova rota: `src/routes/_app/biblioteca-mestra.knowledge-builder.tsx`
Página com:
- **Seletor de âmbito** (RadioGroup): Toda a Biblioteca (disabled) · Especialidade · Subespecialidade · Artigo único.
- **Selects dependentes** (especialidade → subespecialidade → artigo).
- **Modo de execução** (RadioGroup): Manter existente · Adicionar apenas novos · Regenerar tudo.
- **Pré-visualização** (botão "Analisar fontes"): mostra nº de artigos no âmbito, nº de classificações reais encontradas (de `classificacao_artigos` com `estado='validado'` ou `auto_exato`), nº de artigos sem dados (que serão tratados só com nome+descrição).
- **Botão principal**: "Enriquecer Biblioteca com IA".
- **Painel de progresso em tempo real**: especialidade, X / Y artigos, contagens por tipo (palavras-chave, sinónimos, expressões, materiais, negativos), tempo decorrido, estado, último artigo processado, log scrollável.
- **Resumo final** com botão "Ver artigos enriquecidos" (link para Pesquisa de Artigos filtrado).

### 3. Server functions: `src/lib/biblioteca-mestra/knowledge-builder.functions.ts`

`previewScope({ tipo, especialidadeId?, subespecialidadeId?, artigoId? })` →
retorna `{ artigos: n, classificacoesReais: n, artigosSemDados: n }`.

`startKnowledgeRun({ scope, modo })` →
- Cria registo em **nova tabela** `biblioteca_knowledge_run` (estado `em_curso`).
- Retorna `runId`. Devolve imediato; processamento em background via fila simples (loop dentro da própria function chamada por SSE/polling).

`getKnowledgeRunStatus(runId)` →
retorna progresso atual (artigos processados, contagens por tipo, estado, log das últimas 20 linhas).

`cancelKnowledgeRun(runId)` →
marca como `cancelado`; o processamento verifica esta flag entre artigos.

### 4. Motor de geração (`src/lib/biblioteca-mestra/knowledge-builder.server.ts`)

Para cada Artigo Mestre no âmbito:

1. **Recolha de fontes** (com pesos):
   - **Fonte A — MQ reais**: `select descricao_original, count(*) from classificacao_artigos where artigo_mestre_id = X and estado in ('validado','auto_exato','auto_aprendido') group by descricao_original`. Fonte primária, peso máximo.
   - **Fonte B — Nome do artigo** (`biblioteca_artigos.codigo` + descrição da categoria/subespecialidade).
   - **Fonte C — Descrição do artigo** (`biblioteca_artigos.descricao`).
   - **Fonte D — Contexto estrutural**: nomes da especialidade/subespecialidade/categoria + lista de artigos irmãos (apenas códigos+nomes, para a IA evitar "roubar" termos).

2. **Chamada à IA via Lovable AI Gateway** (`google/gemini-3-flash-preview`):
   - Prompt sistema em PT-PT, role "engenheiro de conhecimento técnico de construção".
   - Input: fontes A-D + (no modo "Adicionar apenas novos") lista de termos já existentes para evitar duplicados.
   - **Output estruturado** (`Output.object` com Zod): `{ palavras_chave[], sinonimos[], expressoes[], materiais[], termos_negativos[] }`, cada item `{ termo, peso, confianca, justificacao }`.
   - Pesos default por tipo seguem `CONHECIMENTO_TIPOS` em `src/lib/biblioteca-mestra/types.ts`; IA pode ajustar dentro de bounds.
   - Confiança: combinada de (a) frequência nas MQ reais, (b) consistência sugerida pela IA. Fórmula: `min(99, round(0.6 * freq_norm * 100 + 0.4 * ia_conf))`.

3. **Persistência** em `biblioteca_artigo_conhecimento`:
   - Modo **Manter**: skip se já existem termos para o artigo.
   - Modo **Adicionar novos**: upsert por `(artigo_mestre_id, tipo, lower(termo))` — só insere termos novos.
   - Modo **Regenerar**: apaga onde `origem='ia'` (mantém `utilizador`/`importacao`) e insere o novo lote.
   - `origem = 'ia'` em todos os registos gerados.

4. **Tratamento de falhas**:
   - 429 / 402 / erro IA → grava no `log_jsonb` do run e continua para o próximo artigo (não aborta corrida inteira).
   - Resumo final mostra `falhados[]`.

### 5. Migração SQL — nova tabela `biblioteca_knowledge_run`

```text
biblioteca_knowledge_run
- id, scope_tipo (especialidade|subespecialidade|artigo)
- scope_ids (jsonb)
- modo (manter|novos|regenerar)
- estado (pendente|em_curso|concluido|cancelado|erro)
- total_artigos, processados
- counts_jsonb { palavras_chave, sinonimos, expressoes, materiais, negativos }
- log_jsonb (array de eventos recentes)
- iniciado_em, concluido_em, iniciado_por, erro_msg
- created_at, updated_at
```

Com GRANTs (`authenticated` SELECT/INSERT/UPDATE; `service_role` ALL), RLS habilitado, política por `iniciado_por = auth.uid()` (ou `has_role(admin)`).

## Detalhes técnicos

- **Stack**: TanStack server fns (`createServerFn`) em `*.functions.ts`, helpers IA em `*.server.ts` (carregar `supabaseAdmin`/Lovable AI dentro do handler).
- **AI Gateway**: `createLovableAiGatewayProvider` (Fase 1 deste app já tem helper; se não existir, criar em `src/lib/ai-gateway.server.ts`).
- **Polling**: cliente faz `useQuery({ refetchInterval: 1500 })` sobre `getKnowledgeRunStatus` enquanto estado for `em_curso`. Sem SSE para manter simples.
- **Background work**: o handler `startKnowledgeRun` cria o run e arranca processamento síncrono numa Promise não aguardada (`void processRun(runId)`). Cada artigo: faz query MQ, chama IA, persiste, atualiza row do run.
- **Concorrência**: 1 artigo de cada vez (sequencial) — evita rate-limits e simplifica progresso.
- **Limites**: máximo 5 termos por tipo por artigo (para qualidade), top 40 descrições reais por artigo enviadas à IA.

## Não alterado

- Motor de classificação atual (`src/lib/classificacao/engine.ts`, `src/lib/procurement/classifier*.ts`) — **nada muda**.
- Tabela `biblioteca_artigo_conhecimento` (já criada na Fase 1) — apenas passamos a inserir registos com `origem='ia'`.
- Aba "Conhecimento IA" na ficha do artigo continua a funcionar (vê os termos gerados).
- Restantes páginas da Biblioteca Mestra — **nada muda**.

## Validação

1. Menu mostra "Knowledge Builder" na secção Biblioteca Mestra.
2. Selecionar Especialidade `010 — Preparação da Obra` + modo "Adicionar novos" → "Analisar fontes" mostra contagens reais.
3. Clicar "Enriquecer" → painel atualiza a cada 1.5s, log mostra cada artigo.
4. Ao concluir, abrir um artigo no separador "Conhecimento IA" → ver termos com badge "IA" e peso/confiança.
5. Repetir em modo "Manter" → run termina rápido e indica artigos saltados.
6. Repetir em modo "Regenerar" → termos `origem='ia'` substituídos; termos `origem='utilizador'` preservados.
7. Cancelar a meio → estado fica `cancelado`, registos já gravados persistem.
