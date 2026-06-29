## Relatório de Geração de Conhecimento (modo artigo)

Reformular o ecrã final do Knowledge Builder, quando o âmbito é **um Artigo Mestre**, transformando-o num relatório completo, expansível e auditável. O ecrã antigo (contadores secos) passa a ser apenas o fallback para âmbitos em massa (especialidade/subespecialidade).

### 1. Backend — enriquecer o `resumo` da run

Ficheiro: `src/lib/biblioteca-mestra/knowledge-builder.server.ts`

Antes de chamar `persistir`, capturar um **snapshot "antes"** do conhecimento existente do artigo (por tipo: contagem + confiança média ponderada + lista `tipo::termo`). Em `persistir`, devolver também a lista de IDs dos termos novos inseridos. No final, para `scope.tipo === "artigo"`, gravar em `resumo` (jsonb da `biblioteca_knowledge_run`) um payload novo:

```
{
  artigo: { id, codigo, descricao, especialidade, subespecialidade, categoria },
  confiancaGlobal: { antes, depois },
  perTipo: { palavra_chave: { antes, depois, delta }, ... },
  fontes: {
    historico: { total, validados, auto, descricoesUnicas },
    candidatos: { total },
    vizinhos: { artigos, exemplos },
    correcoes: { total },   // contar classificacao_aprendizagem por artigo, se existir
    reutilizados: { total } // termos pré-existentes mantidos
  },
  termos: [
    {
      id, tipo, termo, peso, confianca, origem,
      ocorrencias, exemplos[], justificacao,
      novo: true|false
    }, ...
  ],
  counts, semHistorico
}
```

A lista `termos` inclui **tudo o que está ativo no artigo** (novos + pré-existentes), marcando `novo: true` apenas para os criados nesta run. Isto sustenta o "Novos vs já existentes" do UI.

Os âmbitos em massa mantêm o `resumo` atual (perTipo/perOrigem/fontes agregados).

### 2. Frontend — novo componente de relatório

Ficheiro novo: `src/components/biblioteca-mestra/KnowledgeRunReport.tsx`

Renderizado em `src/routes/_app/biblioteca-mestra.knowledge-builder.tsx` quando `status.estado === "concluido"` **e** `scope_tipo === "artigo"`. Substitui o card "Progresso" final. Para os outros âmbitos mantém-se o card atual.

Layout:

```text
┌─ ✅ Conhecimento gerado com sucesso ───────────────────────┐
│ 050.06 — Betão Projetado via húmida                       │
│ Especialidade / Subespecialidade / Categoria              │
│                              Confiança Global  🟢 94%     │
├─ Antes vs Depois ─────────────────────────────────────────┤
│ Palavras-chave 12 → 18 (+6)   Sinónimos 5 → 8 (+3)  ...   │
│ Confiança Global  78%  ↓  94%                             │
├─ Fontes utilizadas ───────────────────────────────────────┤
│ 📄 Histórico   📥 Orçamentos   📚 Vizinhos   👤 Correções │
├─ Conhecimento gerado (accordion por tipo) ────────────────┤
│ ▶ Palavras-chave (18)   ⬤ 6 novos                         │
│ ▶ Sinónimos (8)         ⬤ 3 novos                         │
│ ...                                                       │
│   ao expandir → chips de termos, 🟢 novos / ⚪ existentes  │
│   cada chip clicável → painel lateral                     │
├─ Ações ───────────────────────────────────────────────────┤
│ [Aprovar]  [Editar]  [Regenerar]  [Exportar]  [Fechar]    │
└────────────────────────────────────────────────────────────┘
```

Detalhes:

- Cabeçalho: `ConfiancaBar` reutilizado para a confiança global.
- "Antes vs Depois": grid de 5 tipos + linha de confiança global, usando os campos `perTipo.{antes, depois, delta}` e `confiancaGlobal.{antes, depois}` do resumo.
- "Fontes utilizadas": 4 cards (histórico / orçamentos brutos / vizinhos / correções) com os totais. Reaproveita os ícones do `CONHECIMENTO_ORIGENS`.
- "Conhecimento gerado": `Accordion` do shadcn, um item por tipo. Cada item mostra `(total) ⬤ N novos`. Ao expandir, chips de termos (`Badge`) com cor verde para `novo: true` e cinza para existentes; ao clicar um chip abre um `Sheet` lateral.
- Sheet lateral por termo: termo + origem (ícone+label), ocorrências, peso, confiança (`ConfiancaBar`), até 3 exemplos reais (do array `exemplos`), justificação da IA.
- Ações:
  - **Aprovar conhecimento** → marca todos os termos `novo` com `origem === "ia"` como `origem = "utilizador"` (ou flag de validação; reusar update simples a `biblioteca_artigo_conhecimento`).
  - **Editar conhecimento** → navega para a ficha do artigo (`biblioteca-mestra/artigos` com query/aba conhecimento).
  - **Regenerar conhecimento** → reabre o ecrã de configuração com `modo="regenerar"` pré-selecionado e re-arranca.
  - **Exportar conhecimento** → CSV/JSON client-side com a lista `termos`.
  - **Guardar e fechar** → limpa `runId` no estado local.

### 3. Pequenos suportes

- Adicionar 2 server fns auxiliares em `src/lib/biblioteca-mestra/knowledge-builder.functions.ts`:
  - `aprovarConhecimentoRun({ runId })` — usa `requireSupabaseAuth`, lê `resumo.termos` da run, faz update em `biblioteca_artigo_conhecimento` (set origem → `utilizador`) apenas para os ids `novo: true`.
- Tipos partilhados de relatório em `src/lib/biblioteca-mestra/types.ts` (`KnowledgeRunReport`).
- Sem alterações à BD (já existem `resumo jsonb`, `biblioteca_artigo_conhecimento.ocorrencias/exemplos/justificacao/origem`).

### Fora do âmbito

- Âmbito massivo (especialidade/subespecialidade) continua com o card atual de progresso/contadores; o relatório detalhado só faz sentido para 1 artigo.
- Nenhuma alteração ao motor de geração (fontes, prompt, IA) — esta tarefa é apenas apresentação + snapshot.
