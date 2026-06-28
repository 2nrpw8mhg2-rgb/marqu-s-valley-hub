
## Objetivo

Enriquecer a secção **Artigo Original** da `ClassificacaoSidePanel` para servir como cartão de identificação completo do artigo dentro do Mapa de Quantidades.

## Dados disponíveis na BD (verificado)

| Pretendido | Fonte | Disponível |
|---|---|---|
| Nome/versão do MQ | `orcamentos.nome`, `versao_label`, `versao` | ✅ |
| Capítulo (código + descrição) | `orcamento_capitulos.codigo`, `descricao` (via `orcamento_artigos.capitulo_id`) | ✅ |
| Subcapítulo | — não modelado | ⚠️ derivado do prefixo do código do artigo (best-effort) |
| Código do artigo | `orcamento_artigos.codigo` | ✅ |
| Nº do artigo (ordem) | `orcamento_artigos.ordem` | ✅ |
| Descrição / qtd / unidade | já presentes em `PanelRow` | ✅ |
| Preço unitário | `orcamento_artigos.preco_unitario` | ✅ |
| Preço total | qtd × preço_unitário (calculado) | ✅ |
| Página / linha de importação | — não modelado | ❌ omitir (não inventar) |
| Documento de origem (PDF/Excel) | — não modelado | ❌ omitir |

Sem migrações nesta fase. Os campos não existentes ficam ocultos (não mostro "—" para não poluir). Quando forem adicionados ao schema, a secção exibe-os automaticamente.

## Implementação

### 1. Novo hook `useArtigoOriginal(artigoOrigemId)`
- `src/components/classificacao/useArtigoOriginal.ts`
- React Query, key `["artigo-original", artigoOrigemId]`, staleTime 60s
- Lê `orcamento_artigos` com join a `orcamento_capitulos(codigo, descricao)` e `orcamentos(id, nome, versao, versao_label, obra_id)`
- Devolve também `prevArtigo` / `nextArtigo` (pesquisa por `ordem ± 1` no mesmo orçamento) para a acção "Ver contexto"

### 2. Novo componente `ArtigoOriginalSection`
- `src/components/classificacao/ArtigoOriginalSection.tsx`
- Estrutura visual:
  - **Breadcrumb** (no topo): `MQ {versao_label} › Capítulo {cap.codigo} › Artigo {codigo}` (segmentos como chips minimais)
  - **Localização** (grid 2 colunas label/valor):
    - Mapa de Quantidades · `{orcamento.nome} (v{versao})`
    - Capítulo · `{cap.codigo} — {cap.descricao}`
    - Subcapítulo · derivado do prefixo do código (`02.03` a partir de `02.03.014`) — apenas se o código tiver ≥ 2 segmentos
    - Artigo · `{codigo}` ou `#{ordem}` se sem código
  - **Informação do artigo** (grid 2 col):
    - Descrição completa (full text, sem truncar)
    - Quantidade · `{qtd}` formatado pt-PT
    - Unidade · `{unidade}`
    - Preço unitário · `€ {preco_unitario}` (apenas se > 0)
    - Preço total · `€ {qtd × preco}` (apenas se ambos)
- Loading state: skeleton compacto
- Acessibilidade: `dl/dt/dd` semântico

### 3. Acções rápidas (mini-toolbar dentro da secção)
- 📄 **Abrir no Mapa de Quantidades** → `navigate({ to: "/obras/$id/mq", params: { id: obraId }, search: { focus: artigoId } })` (o destino já existe; o `focus` é apenas hint — fora-do-âmbito implementar o scroll/highlight no destino)
- 📑 **Ver contexto** → `Popover` inline mostrando 3 linhas (anterior, atual destacado, seguinte) usando os dados já carregados
- 📂 **Abrir documento original** → botão presente mas **disabled** com tooltip "Documento de origem ainda não associado" (sem campo na BD)
- 📋 **Copiar referência** → `navigator.clipboard.writeText("MQ {versao_label} → Capítulo {cap.codigo} → Artigo {codigo}")` + toast

### 4. Wire-up em `ClassificacaoSidePanel.tsx`
- Substituir o bloco actual `Section title="Artigo Original"` (que mostra apenas descrição+qtd+unidade) por `<ArtigoOriginalSection artigoOrigemId={row.id_origem} />`
- A `PanelRow` já contém `id` mas é o ID do `classificacao_artigos`. Precisamos do `artigo_origem_id`. Adicionar `artigo_origem_id` ao tipo `PanelRow` e ao `select` em `motor-classificacao.tsx` (verificar — pode já estar carregado).

## Ficheiros

**Novos:**
- `src/components/classificacao/useArtigoOriginal.ts`
- `src/components/classificacao/ArtigoOriginalSection.tsx`

**Editados:**
- `src/components/classificacao/ClassificacaoSidePanel.tsx` — substituir bloco "Artigo Original"; expor `artigo_origem_id` em `PanelRow`
- `src/routes/_app/motor-classificacao.tsx` — garantir que `artigo_origem_id` é carregado na query `cc-rows` e passado para `panelRow`

## Fora do âmbito

- Persistir página / linha de importação / documento de origem (precisaria de migração ao parser de MQ).
- Implementar focus/scroll-to-artigo no destino `/obras/$id/mq` (só passamos o search param).
- Modelar subcapítulos como entidade real (continua a ser derivado do código).
- Histórico de versões, ligação a Procurement/Autos de Medição/Histórico de Preços (futuras fases).
