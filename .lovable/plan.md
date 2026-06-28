# Reestruturação: Obra como contexto central + MQ como módulo da obra

Esta fase 1 implementa a nova arquitetura de navegação centrada na obra, move a importação de MQ para dentro da obra, e torna a classificação automática (sem clique manual). Prepara a base para versionamento futuro sem o implementar agora.

## 1. Estrutura de navegação por obra

Criar layout `src/routes/_app/obras.$id.tsx` com tabs persistentes:

```text
/obras/$id                  → Resumo
/obras/$id/documentos       → Documentos
/obras/$id/mq               → Mapa de Quantidades
/obras/$id/orcamentacao     → Orçamentação
/obras/$id/procurement      → Procurement
/obras/$id/planeamento      → (placeholder "Em desenvolvimento")
/obras/$id/financeira       → (placeholder)
/obras/$id/medicoes         → (placeholder)
/obras/$id/relatorios       → (placeholder)
```

O layout mostra header da obra (nome, código, cliente, estado) + tabs e `<Outlet />`. CRM de Obras (`/obras`) continua a ser a listagem; clicar numa linha leva para `/obras/$id`.

## 2. Módulo "Mapa de Quantidades" da obra

Nova página `/obras/$id/mq` com:

**Estado "sem MQ":** card centrado com botão **Importar Mapa de Quantidades** (reusa `ImportMQDialog` atual).

**Estado "com MQ":** dashboard com:
- Última versão (placeholder "v1"), data de importação, total de artigos
- Barras/contadores: classificados / pendentes / sem classificação / % classificação
- Estado do MQ (badge): `importado` · `em_classificacao` · `aguardando_validacao` · `validado` · `convertido_pacotes`
- Ações: **Importar nova versão** (desativado, "em breve"), **Comparar versões** (desativado), **Rever classificação** (→ navega para vista de revisão embutida), **Gerar Pacotes de Consulta** (→ Procurement)
- Tabela resumo dos artigos classificados (vinda da classificação automática)

## 3. Auto-classificação após importação

Modificar `ImportMQDialog` (quando aberto a partir da obra): ao concluir a inserção em `orcamento_artigos`, disparar imediatamente `runClassificacao(orcamentoId)` e mostrar a barra de progresso no próprio diálogo (ou redirecionar para `/obras/$id/mq` com o progresso visível).

O utilizador nunca clica em "Iniciar Classificação". O estado do MQ transita: `importado` → `em_classificacao` → `aguardando_validacao` (se há pendentes) ou `validado` (se 100% confiança).

## 4. Vista de revisão dentro da obra

Mover a UI de validação artigo-a-artigo (atualmente em `/motor-classificacao`) para um componente reutilizável e embutir em `/obras/$id/mq` quando o utilizador clica "Rever classificação". Filtra por defeito apenas artigos `necessita_revisao` + `sem_classificacao`.

## 5. Centro de Classificação global (transversal)

`/motor-classificacao` mantém-se no menu como **painel transversal de supervisão**:
- Lista artigos pendentes de validação de **todas as obras** (com coluna "Obra")
- KPIs globais: total pendentes, taxa de acerto, palavras-chave em falta
- Não tem botão "Iniciar Classificação" — só revisão e aprendizagem
- Sidebar: continuar a chamar-se "Centro de Classificação"

## 6. Single source of truth

Manter o modelo atual: `orcamento_artigos` (origem) + `classificacao_artigos` (classificação). Todos os módulos (Orçamentação, Procurement) consultam estas tabelas, sem cópias.

## 7. Preparar versionamento (sem implementar)

Adicionar coluna `versao` (text, default `'v1'`) e `versao_ordem` (int, default `1`) à tabela `orcamentos`, e índice `(obra_id, versao)`. UI desta fase mostra apenas v1; futura iteração ativará criação de v2, Rev A, comparação.

## Detalhes técnicos

**Ficheiros novos:**
- `src/routes/_app/obras.$id.tsx` — layout com tabs
- `src/routes/_app/obras.$id.index.tsx` — Resumo
- `src/routes/_app/obras.$id.documentos.tsx` — reusa `documentos.tsx` filtrado por obra
- `src/routes/_app/obras.$id.mq.tsx` — dashboard MQ + revisão embutida
- `src/routes/_app/obras.$id.orcamentacao.tsx` — lista de orçamentos da obra (filtra `orcamentos` por `obra_id`)
- `src/routes/_app/obras.$id.procurement.tsx` — reusa pacotes filtrados por obra
- `src/routes/_app/obras.$id.planeamento.tsx`, `.financeira.tsx`, `.medicoes.tsx`, `.relatorios.tsx` — placeholders
- `src/components/obras/ObraTabs.tsx` — barra de tabs
- `src/components/obras/MQDashboard.tsx` — KPIs e ações do MQ
- `src/components/classificacao/RevisaoArtigos.tsx` — extrai a tabela/popover de revisão de `motor-classificacao.tsx` para reutilização

**Ficheiros alterados:**
- `src/routes/_app/obras.tsx` — linha da tabela passa a navegar para `/obras/$id`
- `src/components/orcamentos/ImportMQDialog.tsx` — após importar, chamar `runClassificacao` automaticamente e mostrar progresso
- `src/routes/_app/motor-classificacao.tsx` — remover botão "Iniciar Classificação", virar painel global de revisão multi-obra
- `src/components/AppSidebar.tsx` — manter "Centro de Classificação"; "CRM de Obras" passa a ser ponto de entrada principal

**Migração BD:**
- `ALTER TABLE orcamentos ADD COLUMN versao text NOT NULL DEFAULT 'v1'`
- `ALTER TABLE orcamentos ADD COLUMN versao_ordem int NOT NULL DEFAULT 1`
- `CREATE INDEX ON orcamentos(obra_id, versao_ordem)`
- Adicionar enum `estado_mq` em `orcamentos.estado_mq` (`importado | em_classificacao | aguardando_validacao | validado | convertido_pacotes`)
- Trigger: ao concluir `orcamento_classificacao_run`, atualizar `estado_mq` em `orcamentos`

## Fora desta fase (futuro)

- Parser de PDF / Word / outros formatos
- Criar v2 / Rev A / comparação visual de versões
- Histórico de alterações artigo-a-artigo entre versões
- Integração automática com Planeamento, Financeira, Medições, Relatórios

## Resultado

Ao terminar, o utilizador entra em CRM de Obras → escolhe obra → vê tabs → vai a "Mapa de Quantidades" → importa ficheiro → vê a classificação a correr automaticamente → revê apenas o que tem baixa confiança. O Centro de Classificação no menu lateral fica como painel transversal de supervisão.
