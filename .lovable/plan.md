## Objetivo

Transformar a aba **Conhecimento IA** (dentro do diálogo *Editar Artigo Mestre*) de uma simples tabela técnica numa verdadeira **Ficha de Conhecimento do Artigo Mestre** — visual, auditável e centrada na ação de gerar conhecimento via IA.

Ficheiro principal: `src/components/biblioteca-mestra/ArtigoConhecimentoTab.tsx`
Suporte: `src/lib/biblioteca-mestra/knowledge-builder.functions.ts` / `.server.ts`, `src/lib/biblioteca-mestra/types.ts`.

---

## 1. Dashboard de estado (topo da aba)

Acrescentar, antes da tabela, um cartão de resumo com:

- **Estado** — chip colorido: 🟡 Não gerado · 🔵 Em geração · 🟢 Gerado · ⚪ Editado manualmente
- **Confiança global** — média ponderada da confiança × peso dos termos ativos (formato barra + %)
- **Última geração** — data/hora da última run concluída (ou "Nunca")
- **Fontes analisadas** — nº de fontes usadas na última run (MQ, biblioteca, etc.)
- **Conhecimento aprovado** — nº de termos ativos validados

Dados vêm de `biblioteca_knowledge_run` (filtrar pelo `scope_ids->>artigoId`) + agregação de `biblioteca_artigo_conhecimento`.

## 2. Botão "🧠 Gerar Conhecimento IA" como ação principal

- Colocar em destaque (canto superior direito do painel, variante `default`/primária).
- O botão **Adicionar** passa a secundário (`variant="outline"`, ícone +).
- Ao clicar abre um `AlertDialog` de confirmação a explicar o que a IA vai analisar (lista com ✔) e tempo estimado.
- Confirmação chama `startKnowledgeRun({ scope: { tipo: "artigo", artigoId }, modo: "regenerar" })` e faz polling com `getKnowledgeRunStatus` (já existem).
- Durante a run: barra de progresso + botão **Cancelar** (usa `cancelKnowledgeRun`).
- No fim, mostrar **resumo da geração** (toast + bloco inline): nº por tipo + confiança global obtida.

## 3. Coluna "Origem" com ícones

Substituir os badges de texto por ícones + tooltip:

- 🤖 IA (`Bot`) · 👤 Utilizador (`User`) · 📄 Mapas de Quantidades (`FileSpreadsheet`) · 📚 Biblioteca Mestra (`Library`) · ⚙ Sistema (`Settings`) · 📥 Importação (`Upload`)

Estender o enum `ConhecimentoOrigem` em `types.ts` com `"mapas_quantidades"` e `"biblioteca_mestra"` (migration a adicionar valores ao CHECK/enum). Atualizar `CONHECIMENTO_ORIGENS` com `icon` e `label`.

## 4. Nova coluna "Ocorrências"

- Adicionar coluna `ocorrencias int default 0` à tabela `biblioteca_artigo_conhecimento` (migration).
- A geração IA preenche o valor (contagem real em MQ + histórico de classificações).
- Render: número grande tabular + barra horizontal proporcional ao máximo da tabela.
- Coluna ordenável (clique no cabeçalho).

## 5. Painel lateral de detalhe do termo

Ao clicar numa linha (não nos botões de ação) abre um `Sheet` lateral à direita com:

- Termo + tipo + estado ativo
- **Origem** (ícone + descrição completa)
- **Encontrado em** — "287 mapas de quantidades" (placeholder até existirem dados)
- **Exemplos reais** — lista de descrições de MQ onde o termo apareceu (top 5)
- **Utilizado pela IA porque** — campo `justificacao text` (nova coluna, preenchida pela IA)
- Acções: editar, ativar/desativar, remover

Migration adiciona `justificacao text` e `exemplos jsonb` (array de strings curtas) a `biblioteca_artigo_conhecimento`.

## 6. Visualização gráfica da confiança

Substituir "92%" simples por:

- Barra horizontal (componente `Progress` do shadcn) com cor semântica:
  - ≥ 85% → verde · 60–84% → amarelo · < 60% → vermelho
- Número à direita da barra
- Tooltip com a categoria textual (Muito elevada / Média / Baixa)

## 7. Cartão "Composição do conhecimento"

Por baixo do dashboard de estado, um cartão com **contadores por tipo** (apenas termos ativos):

- Palavras-chave · Sinónimos · Expressões · Materiais · Termos Negativos · **Total**
- Cada contador é também filtro rápido (clique aplica `filtroTipo`).
- Visual: grid horizontal de mini-cards com ícone tipográfico + número grande.

## 8. Resumo do resultado da geração

Após `getKnowledgeRunStatus` reportar `estado = "concluido"`:

- Banner verde temporário no topo (descartável): "Conhecimento gerado com sucesso" + breakdown por tipo + confiança global.
- Persistir o último resumo em `biblioteca_knowledge_run.resumo jsonb` (já deve existir; senão acrescentar) para reabertura.

## 9. Layout final da aba (ordem visual)

```text
┌──────────────────────────────────────────────────────────────┐
│  [Estado] [Confiança] [Última geração] [Fontes] [Aprovados] │ ← Dashboard
├──────────────────────────────────────────────────────────────┤
│  [PC 24] [Sin 12] [Expr 8] [Mat 14] [Neg 5]   Total: 63     │ ← Composição
├──────────────────────────────────────────────────────────────┤
│  [Pesquisar] [Tipo▾] [Inativos]  [+ Adicionar] [🧠 Gerar IA]│ ← Toolbar
├──────────────────────────────────────────────────────────────┤
│  Tipo │ Termo │ Peso │ Origem │ Ocorr. │ Confiança │ Ativo  │ ← Tabela
│  ...  (linha clicável → abre Sheet de detalhe)              │
└──────────────────────────────────────────────────────────────┘
```

---

## Alterações técnicas (resumo para revisão)

1. **Migration Supabase** em `biblioteca_artigo_conhecimento`:
   - `ocorrencias int not null default 0`
   - `justificacao text`
   - `exemplos jsonb not null default '[]'::jsonb`
   - Adicionar valores `'mapas_quantidades'`, `'biblioteca_mestra'` ao tipo de origem.
   - (Confirmar que `biblioteca_knowledge_run` tem `resumo jsonb`; adicionar se faltar.)

2. **`types.ts`**: atualizar `ConhecimentoOrigem`, `CONHECIMENTO_ORIGENS` (com `icon`), e tipo `ArtigoConhecimento`.

3. **`ArtigoConhecimentoTab.tsx`**: reestruturar em sub-componentes:
   - `EstadoDashboard`, `ComposicaoCard`, `Toolbar`, `TabelaConhecimento`, `TermoDetalheSheet`, `GerarIADialog`, `ResumoGeracaoBanner`.

4. **Server functions** (`knowledge-builder.server.ts`): garantir que a geração popula `ocorrencias`, `justificacao`, `exemplos` e marca `origem` corretamente (já existe a infraestrutura de run).

5. **Sem alterações** em outras páginas; tudo confinado à aba dentro do `ArtigoMestreFormDialog`.

---

## Fora de âmbito (não implementar agora)

- Lógica real de contagem de ocorrências em MQ históricos (depende de pipeline de classificação) — fica como **placeholder** com valores reais quando a geração IA os fornecer; UI já preparada.
- Sistema de aprovação/revisão multi-utilizador.
- Versionamento histórico de runs.