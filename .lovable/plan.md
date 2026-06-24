## Decomposição de Preços — Nova área de orçamentação

Vou criar um sub-menu "Decomposição de Preços" dentro do editor de orçamento, onde cada artigo importado do Mapa de Quantidades pode ser aberto e ter o custo decomposto pelas várias categorias, gerando automaticamente o preço de venda final.

### 1. Base de dados (nova migração)

Adicionar 7 colunas de custo a `orcamento_artigos` (default 0):
- `custo_mao_obra`, `custo_tarefeiros`, `custo_subempreitadas`, `custo_materiais`, `custo_equipamentos`, `custo_transportes`, `custo_encargos_gerais`, `custo_outros`

Nova tabela `orcamento_artigo_fontes` para guardar associações a subempreiteiros/fornecedores:
- `artigo_id`, `categoria` (subempreitada | material | equipamento | mao_obra), `subempreiteiro_id` (nullable), `descricao`, `valor`, `selecionado` (boolean — só o selecionado alimenta o custo)

Manter `preco_unitario` e `margem_pct` existentes (passam a ser calculados/sobrescritos pela decomposição quando esta tem valores > 0).

### 2. Nova rota: `/orcamentos/$id/decomposicao`

Sub-menu visível no editor do orçamento (tabs: **Mapa de Quantidades** | **Decomposição de Preços**).

**Grelha principal** com colunas: Código · Descrição · Un. · Qtd · Mão de Obra · Tarefeiros · Equipamentos · Materiais · Subempreitadas · Encargos · **Custo Total** (auto) · **Margem %** · **PV Unit** (auto) · **Total Venda** (auto) · ações.

Cada linha expansível mostra:
- Inputs dos 7 componentes de custo
- Lista de **fontes associadas** (orçamentos de subempreiteiros / cotações) com radio button "selecionada" — o valor da fonte selecionada preenche automaticamente o campo de custo correspondente
- Botão "Associar subempreiteiro" → dialog que lista subempreiteiros ativos e permite adicionar uma proposta (categoria, descrição, valor)

### 3. Cálculos automáticos (client-side, reativos)

```
custoTotal     = soma dos 7 componentes
pvUnitario     = custoTotal * (1 + margem%/100)
totalVenda     = pvUnitario * quantidade
lucroBruto     = totalVenda - (custoTotal * quantidade)
```

Aplicar margem: individual por artigo OU global (botão "Aplicar margem global a tudo" já existente é reutilizado).

### 4. Resumo global (sticky no topo)

Cards com: **Total Custos** · **Total Venda** · **Lucro Bruto** · **Margem Média %** · barra com **% de custos por categoria** (MO, Subs, Materiais, Equip., Encargos, Outros).

### 5. Ligação ao orçamento comercial

Ao guardar a decomposição, o `preco_unitario` de cada artigo é actualizado para o `pvUnitario` calculado. A vista actual `/orcamentos/$id` (Mapa de Quantidades) continua a mostrar os preços, mas com aviso visual de que vêm da Decomposição — edição manual do PV ali fica bloqueada quando o artigo tem decomposição preenchida (`custoTotal > 0`).

Export PDF/Excel continua a usar `preco_unitario` (agora alimentado pela decomposição), garantindo que o orçamento comercial reflecte sempre os custos reais + margem.

### 6. Sidebar

Adicionar atalho "Decomposição de Preços" como sub-item visual em Orçamentação (na prática leva à lista de orçamentos e dentro escolhe-se um para abrir a aba).

### Ficheiros novos / alterados

- **migration**: colunas de custo + tabela `orcamento_artigo_fontes` + grants/RLS
- `src/routes/_app/orcamentos.$id.decomposicao.tsx` (nova rota — sub-página)
- `src/routes/_app/orcamentos.$id.tsx` (adicionar tabs MQ / Decomposição, bloquear edição de PV quando há decomposição)
- `src/components/orcamentos/AssociarFonteDialog.tsx` (novo)
- `src/lib/orcamento-utils.ts` (helpers de cálculo da decomposição)
- `src/components/AppSidebar.tsx` (atalho opcional)

### Fora do âmbito desta entrega

- Biblioteca de Recursos reutilizável (€/h por categoria) — fica para fase seguinte; agora os valores são introduzidos por artigo ou vindos de propostas
- Composições detalhadas por receita — adiamento; modelo escolhido é **preço directo + margem** com decomposição por categoria de custo, que cobre o pedido actual
