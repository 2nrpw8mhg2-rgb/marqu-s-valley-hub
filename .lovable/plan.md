
# Separação automática de artigos por subempreitada

Cria o conceito de **subempreitada** (categoria de trabalho executado por um subempreiteiro em obra — ex.: Pinturas, Coberturas, AVAC) distinto do que já existe:

- `subempreiteiros` = fornecedores (empresas).
- `procurement_pacotes` = pacotes de consulta a subempreiteiros (a jusante).
- `biblioteca_subespecialidades` = organização técnica da biblioteca (não é o mesmo mapa).

A subempreitada é a "peça" contratual que se atribui a cada artigo do orçamento, com atribuição automática, dashboard e vista dedicada.

## 1. Base de dados (migração única)

**Tabela `subempreitadas`**
`id, codigo (unique), nome, descricao, palavras_chave text[], termos_exclusao text[], ordem, ativo, created_at, updated_at`.
RLS: leitura para `authenticated`; escrita só admin (`private.has_role`). Seed com as 22 subempreitadas indicadas.

**`biblioteca_artigos` — novas colunas**
`subempreitada_principal_id (fk)`, `subempreitada_secundaria_id (fk)`, `confianca_subempreitada numeric`, `origem_classificacao_subempreitada text` (`manual | regras | ia | herdada`).

**`orcamento_artigos` — novas colunas**
`subempreitada_id (fk)`, `subempreitada_confianca numeric`, `subempreitada_origem text` (`artigo_mestre | regras | manual | ia`), `subempreitada_validada_manual boolean default false`.

**`subempreitada_aprendizagem`** (para o ponto 8)
`id, artigo_descricao_normalizada, artigo_mestre_id nullable, subempreitada_id, user_id, created_at`. Alimentada quando o utilizador corrige manualmente.

Índices: em `orcamento_artigos.subempreitada_id`, em `biblioteca_artigos.subempreitada_principal_id`, e trigrama em `subempreitadas.palavras_chave` para pesquisa.

## 2. Motor de atribuição (`src/lib/subempreitadas/`)

Função pura `classificarArtigo(artigo, ctx) → { subempreitada_id, confianca, origem, alternativas[] }` com esta cascata:

1. **Aprendizagem manual** (match exato por descrição normalizada) → confiança 1.0, origem `manual`.
2. **Artigo Mestre associado** → herda `subempreitada_principal_id` → confiança 0.95, origem `artigo_mestre`.
3. **Regras por palavras-chave** sobre `descricao + codigo`, normalizando pt-PT (remover acentos, minúsculas). Score por subempreitada = (nº matches positivos × peso) − (matches em `termos_exclusao` × peso alto). Empate → escolhe maior score; se diferença < 15% marca `alternativas`.
4. **Sinal auxiliar** do capítulo original: soma pequena (máx 10%), nunca decisor sozinho.
5. Se `confianca < 0.70` → `subempreitada_validada_manual = false` + estado "necessita validação". Nunca deixa `subempreitada_id` NULL a não ser que o score global seja 0.

Executor server-fn `classificarOrcamento(orcamento_id)` que corre em lote e faz upsert.
Hook de importação MQ (`ImportMQDialog` / `mq-parser`) chama o classificador logo após inserir artigos.
Hook de associação a Artigo Mestre → reclassifica esse artigo.

## 3. UI

**Nova vista** `src/routes/_app/orcamentos.$id.subempreitadas.tsx` com dois separadores:

- **Dashboard**: cards com nº artigos, valor total e nº por validar por subempreitada; contadores globais (sem subempreitada, baixa confiança); botão "Classificar novamente"; botão "Exportar pedido de proposta".
- **Separação por Subempreitada** (tabela): Código original · Capítulo original · Descrição · Un. · Qtd · Preço · Total · Artigo Mestre · Subempreitada sugerida (select editável) · Confiança (barra) · Estado (validado/necessita validação/sem subempreitada) · Ações (validar, alterar, ver alternativas). Filtros por subempreitada, estado e confiança.

Alterar manualmente → grava em `orcamento_artigos` (`origem = manual`, `validada_manual = true`) e insere linha em `subempreitada_aprendizagem`.

**Página de gestão** `src/routes/_app/biblioteca-mestra.subempreitadas.tsx` para admin editar lista, palavras-chave, termos de exclusão.

**Integração `orcamentos.$id.index`**: barra de resumo por subempreitada + link para a nova vista.

## 4. Exportação (`src/lib/subempreitadas/export.ts`)

Selecionar 1 ou N subempreitadas → gerar:

- **Excel** (xlsx): folha por subempreitada com colunas do orçamento + totais.
- **PDF**: mapa de quantidades filtrado, cabeçalho com obra/orçamento/subempreitada.
- **Pedido de proposta**: PDF/Excel formatado para envio a subempreiteiro (sem preços unitários internos, só quantidades e descrição). Reutiliza `orcamento-export.ts`.

Opcional (fora deste plano): botão "Criar pacote de procurement" que cria diretamente um `procurement_pacote` já preenchido a partir de uma subempreitada.

## 5. Terminologia

Toda a UI, mensagens e nomes em português de Portugal — segue o memory `mem://constraints/idioma-ptpt` (betão, cofragem, caixilharia, guardar/eliminar, etc.). Nada de "concreto", "salvar", "excluir".

## Ordem de implementação

1. Migração (tabelas + colunas + seed + RLS + GRANTs).
2. Motor de classificação + server-fns.
3. Página de gestão de subempreitadas (admin).
4. Hook na importação MQ + reclassificação em massa.
5. Vista "Separação por Subempreitada" + Dashboard.
6. Aprendizagem manual.
7. Exportações (Excel, PDF, pedido de proposta).

## Confirmações antes de avançar

1. **Escopo do seed**: uso exatamente a lista das 22 subempreitadas que indicaste, com palavras-chave iniciais escolhidas por mim (podes afinar depois na página de gestão)?
2. **Reclassificação retroativa**: aplico o motor a todos os orçamentos existentes na migração, ou só aos novos daqui para a frente?
3. **Pedido de proposta**: gero um documento standalone, ou queres que crie diretamente um `procurement_pacote` (já existente na app) com os artigos da subempreitada?
