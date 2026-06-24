## FASE 3 — Procurement · Módulo 1: Pacotes de Consulta

Criar a área **Procurement** integrada com Orçamentação e Decomposição de Preços, começando pelo Módulo 1 (Pacotes de Consulta). Os módulos seguintes (envio a subempreiteiros, receção e comparação de propostas, adjudicação, histórico) ficam para entregas posteriores desta mesma fase.

### 1. Base de dados (migração)

Novas tabelas em `public`:

- `procurement_pacotes`
  - `id`, `orcamento_id` (FK → orcamentos), `obra_id` (FK → obras, nullable derivado), `nome`, `especialidade`, `estado` (enum: `por_preparar | preparado | enviado | em_analise | adjudicado | cancelado`, default `por_preparar`), `observacoes`, `user_id`, `created_at`, `updated_at`.
- `procurement_pacote_artigos`
  - `id`, `pacote_id` (FK → procurement_pacotes ON DELETE CASCADE), `artigo_id` (FK → orcamento_artigos), `codigo`, `descricao`, `unidade`, `quantidade`, `capitulo`, `subcapitulo`, `preco_seco_estimado` (= custo unit. da decomposição), `categoria_custo`, `especialidade`, `created_at`.

Enum `procurement_pacote_estado`. Grants `authenticated` + `service_role`. RLS por `user_id` (mesmo padrão das outras tabelas). Trigger `set_updated_at` no pacote.

Não toca em `orcamento_artigos` nem na Decomposição — apenas cria uma camada nova de organização. Os dados são copiados para o pacote no momento da geração (snapshot) para permitir editar especialidade/preço estimado sem alterar o orçamento original.

### 2. Sidebar

Remover `disabled` de **Procurement** e expandir para sub-itens:
- Procurement
  - Pacotes de Consulta → `/procurement/pacotes`

### 3. Rotas novas

- `src/routes/_app/procurement.pacotes.tsx` — lista de pacotes
- `src/routes/_app/procurement.pacotes.$id.tsx` — detalhe do pacote

### 4. Página Lista (`/procurement/pacotes`)

Topo:
- Filtro **Obra/Orçamento** (select dos orçamentos do utilizador).
- Botões: **Novo pacote** · **Gerar pacotes automaticamente** (dialog que pede orçamento e cria 1 pacote por especialidade detectada).

Cards de resumo:
- Total de pacotes · Por preparar · Enviados · Adjudicados · Valor total estimado em consulta.

Tabela:
| Nome | Especialidade | Nº artigos | Valor estimado | Estado | Criado | Atualizado | Ações |

Ações por linha: Abrir · Editar nome/especialidade · Duplicar · Eliminar · Preparar envio (muda estado para `preparado`).

### 5. Página Detalhe (`/procurement/pacotes/$id`)

Header: nome editável, obra/orçamento associado, especialidade (select), badge de estado, dropdown para mudar estado.

Bloco de observações internas (textarea).

Tabela de artigos do pacote (código, descrição, capítulo/subcapítulo, un., qtd, preço seco estimado, total, ações).

Ações:
- **Adicionar artigos**: dialog com a lista de artigos do orçamento de origem que ainda não estão no pacote (com pesquisa, checkboxes para multi-add).
- **Remover artigo**.
- **Editar quantidade / preço seco** inline.
- Botão **Preparar pedido de orçamento para subempreiteiros** (apenas marca `preparado` por agora — o envio real entra no próximo módulo).

Totais no rodapé: nº artigos, valor total estimado.

### 6. Geração automática por especialidade

Função client-side `inferirEspecialidade(artigo)` que devolve uma das especialidades-alvo (Demolições, Estruturas, Alvenarias, Cobertura, Caixilharias, Eletricidade/ITED, AVAC, Canalizações, Carpintarias, Pinturas, Outros) com base em:

1. `especialidade` ou `categoria_custo` já presentes na Decomposição (prioridade máxima);
2. `capitulo` / `subcapitulo` (regras por prefixo/contém);
3. Palavras-chave na `descricao` (mapa keyword → especialidade, ex.: `tomada|cabo|quadro elétrico|ITED → Eletricidade/ITED`, `tubo|esgoto|sanita|lavatório → Canalizações`, etc.).

O **preço seco estimado** = `custo_total_decomposicao` do artigo (soma dos 7 componentes). Se a decomposição não estiver preenchida, usa `preco_unitario` como fallback e marca o artigo no pacote com aviso.

A geração automática:
- agrupa artigos por especialidade detectada;
- cria um pacote por grupo com `nome = "{Especialidade} – {nome do orçamento}"`, `estado = por_preparar`;
- ignora artigos que já pertencem a outro pacote do mesmo orçamento (evita duplicação) — confirmação no dialog.

### 7. Ficheiros

Novos:
- `supabase/migrations/<timestamp>_procurement_pacotes.sql`
- `src/routes/_app/procurement.pacotes.tsx`
- `src/routes/_app/procurement.pacotes.$id.tsx`
- `src/lib/procurement/especialidades.ts` (lista canónica + `inferirEspecialidade`)
- `src/components/procurement/GerarPacotesDialog.tsx`
- `src/components/procurement/AdicionarArtigosDialog.tsx`

Alterados:
- `src/components/AppSidebar.tsx` (ativar Procurement + sub-item)

### Fora do âmbito desta entrega (próximos módulos da Fase 3)

- Pedidos de orçamento a subempreiteiros (envio por email, links públicos de resposta)
- Grelha de comparação de propostas e adjudicação
- Histórico de preços por artigo/especialidade/subempreiteiro
- Relatórios de poupança e margem real vs orçamentada
