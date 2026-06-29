# Relatório Final do Knowledge Builder — qualquer âmbito

## Problema

Hoje o **Relatório Final de Conhecimento** só é construído quando o âmbito é **Artigo Mestre** (`scope.tipo === "artigo"`). Para Especialidade e Subespecialidade, o `resumo` guardado é apenas `{ fontes, counts }` e a UI cai para o painel "Progresso" com totais e logs técnicos — exactamente o que o utilizador quer eliminar como resultado principal.

A solução é estender o mesmo relatório (com agrupamento por tipo **e** por Artigo Mestre) a Especialidade e Subespecialidade, mantendo os logs apenas numa secção colapsável "Logs técnicos".

## O que vai mudar

### 1. Backend — `src/lib/biblioteca-mestra/knowledge-builder.server.ts`

Construir o `resumo` rico para **todos os âmbitos**, não só `artigo`.

Durante o ciclo `for (const artigoId of ids)`:
- Acumular por artigo: `codigo`, `descricao`, contexto (esp/sub/cat), `novosIds` desse artigo, `fontesPorArtigo` (historico/cand/vizinhos/correcoes), `errado?` flag.
- Manter `antesSnapshot` por artigo (mini-snapshot count por tipo + confiança ponderada) para calcular `perTipo.antes/depois/delta` agregados.

No fim, em vez do bloco actual restrito a `scope.tipo==="artigo"`:
- Carregar `biblioteca_artigo_conhecimento` para **todos os `ids` processados** com sucesso (`.in("artigo_mestre_id", ids)`), incluindo `artigo_mestre_id` no select.
- Construir:
  - `escopo`: `{ tipo, especialidade, subespecialidade, artigo? }` resolvido por nome/código (lookup leve nas tabelas `biblioteca_especialidades`/`biblioteca_subespecialidades`/`biblioteca_artigos`).
  - `execucao`: `{ totalArtigos, processados, saltados, falhados, modo }`.
  - `perTipo` agregado (antes/depois/delta somado sobre todos os artigos).
  - `perOrigem` agregado.
  - `confiancaGlobal` ponderada por peso sobre todos os termos.
  - `fontes` (agregadas): `historico { total, validados, auto, descricoesUnicas }`, `candidatos { total }`, `vizinhos { artigos, exemplos }`, `correcoes { total }`, `reutilizados { total }`.
  - `termos`: lista achatada com `{ id, artigoMestreId, artigoCodigo, artigoDescricao, tipo, termo, peso, confianca, origem, ocorrencias, exemplos, justificacao, novo }`.
  - `artigos`: `[{ id, codigo, descricao, contexto, totalTermos, novos, falhou?, erro? }]` para a vista "por Artigo Mestre".
  - `counts`, `semHistorico`, `erro`.

Para âmbito = Artigo continua a funcionar (caso degenerado de `ids.length === 1`).

### 2. Tipos — `src/lib/biblioteca-mestra/types.ts`

Estender `KnowledgeRunReport`:
- Adicionar `escopo: { tipo: "especialidade"|"subespecialidade"|"artigo"; especialidade?: string; subespecialidade?: string; artigo?: {id, codigo, descricao} }`.
- Adicionar `execucao: { totalArtigos, processados, saltados, falhados, modo }`.
- Adicionar `artigos: KnowledgeRunReportArtigo[]` (novo tipo com totais por artigo).
- Em `KnowledgeRunReportTermo`, adicionar `artigoMestreId`, `artigoCodigo`, `artigoDescricao` (opcionais para compatibilidade).
- Tornar `artigo` (single) opcional / mantê-lo só preenchido para âmbito Artigo.

### 3. UI — `src/components/biblioteca-mestra/KnowledgeRunReport.tsx`

Refactor para suportar âmbito alargado mantendo a estética actual:

- **Cabeçalho**: título dinâmico
  - Artigo → mantém actual.
  - Subespecialidade → "030.01 — Demolições Gerais" + breadcrumb da especialidade.
  - Especialidade → nome da especialidade.
- **Resumo da execução**: cartões com `Artigos processados X/Y · Saltados · Falhados · Modo · Estado`.
- **Antes vs Depois** (totais agregados) — já existe, passa a usar `perTipo` agregado.
- **Fontes analisadas** — já existe, passa a usar fontes agregadas.
- **Conhecimento gerado** — duas vistas via tabs `Tabs` (shadcn):
  - **Por Tipo** (vista actual com `Accordion` dos 5 tipos, todos os termos achatados).
  - **Por Artigo Mestre**: `Accordion` por artigo (código + descrição + badge "X termos / Y novos"); dentro, sub-accordion ou secções compactas por tipo só com os termos desse artigo.
- **Detalhe do termo** (sheet): adicionar linha "Artigo Mestre: <código — descrição>" quando vier preenchido.
- **Logs técnicos** (colapsável `Collapsible`, fechado por defeito) no fundo — move o que hoje aparece no painel de progresso (`log[]`, mensagens `A:0 B:0 C:11`).
- **Ações**: o botão "Aprovar conhecimento" continua a funcionar (a função já lê `resumo.termos` e aprova `novo && origem==='ia'` de qualquer artigo). "Editar conhecimento" só fica disponível para âmbito Artigo.

### 4. Página — `src/routes/_app/biblioteca-mestra.knowledge-builder.tsx`

Substituir a condição actual:
```
s.estado === "concluido" && s.scope_tipo === "artigo" && (s.resumo as any)?.termos
```
por simplesmente:
```
s.estado === "concluido" && (s.resumo as any)?.termos
```

O painel de Progresso fica visível apenas enquanto `isRunning`/`erro`/`cancelado`. Quando concluído, mostra apenas o `KnowledgeRunReport`.

## Out of scope

- Sem mudanças no motor de geração da IA, prompt, ou tabelas.
- Sem novas server functions.
- Sem alterações ao schema do `biblioteca_knowledge_run` (o `resumo jsonb` aceita o payload alargado).
- Sem export por artigo (o export JSON actual continua a despejar o `report` completo).
