
# Melhorias aos Artigos Mestre

Três melhorias estruturais à tabela `biblioteca_artigos` e respetiva UI em `/biblioteca-mestra/artigos`.

## 1. Campo "Tipo" do artigo

Novo enum `biblioteca_artigo_tipo` com os valores:
`servico`, `material`, `equipamento`, `sistema`, `mao_obra`, `transporte`, `taxa_licenca`, `outros`.

- Coluna `tipo biblioteca_artigo_tipo NOT NULL DEFAULT 'outros'` em `biblioteca_artigos`.
- Backfill: todos os artigos existentes ficam `'outros'` (utilizador refina depois).
- Índice `btree(tipo)` para filtros rápidos.

## 2. Campo "Estado IA"

Novo enum `biblioteca_artigo_estado_ia` com os valores:
`validado`, `revisto`, `criado_auto`, `pendente`.

- Coluna `estado_ia biblioteca_artigo_estado_ia NOT NULL DEFAULT 'pendente'` em `biblioteca_artigos`.
- Backfill: artigos atuais (criados manualmente via SQL pelo utilizador) → `'validado'`.
- Índice `btree(estado_ia)`.

## 3. Unidades normalizadas

Nova tabela `public.biblioteca_unidades`:

| coluna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `codigo` | text UNIQUE NOT NULL | ex: `m2`, `m3`, `un`, `vg` (sigla canónica usada em código) |
| `simbolo` | text NOT NULL | ex: `m²`, `m³`, `un` (apresentado na UI) |
| `nome` | text NOT NULL | ex: "Metro quadrado" |
| `categoria` | text | "comprimento", "área", "volume", "massa", "tempo", "global"… (opcional, ajuda agrupar no dropdown) |
| `ordem` | int default 100 | |
| `ativa` | boolean default true | |
| `created_at`/`updated_at` | timestamptz | + trigger `set_updated_at` |

Seed inicial: `un`, `m`, `m2`, `m3`, `ml`, `kg`, `t`, `vg`, `h`, `dia`, `mes`, `lote`, `cj`, `par`, `km`, `l`.

RLS + GRANTs: leitura para `authenticated`, escrita reservada a `admin` (via `has_role(auth.uid(),'admin')`).

### Migração de `biblioteca_artigos.unidade`

- Adicionar `unidade_id uuid REFERENCES biblioteca_unidades(id) ON DELETE RESTRICT`.
- Backfill: mapear texto livre atual → `unidade_id` via lookup case-insensitive contra `codigo`/`simbolo` (apenas `vg` existe hoje, fica trivial).
- Manter a coluna `unidade` (texto) por agora como cache de leitura, alimentada por trigger a partir de `unidade_id`, para não partir consultas/orçamentos existentes. Pode ser removida em migração futura quando todo o código consumir `unidade_id`.
- Após backfill: `ALTER COLUMN unidade_id SET NOT NULL`.

## UI — `biblioteca-mestra.artigos.tsx`

- **Listagem**: novas colunas `Tipo` (badge) e `Estado IA` (badge colorido com bolinha 🟢🟡🔵🔴). Coluna `Un.` passa a mostrar `simbolo` da unidade ligada.
- **Filtros**: dropdowns adicionais `Tipo` e `Estado IA`.
- **Ficha de edição**: novos campos obrigatórios `Tipo` (Select) e `Estado IA` (Select); `Unidade` passa de `Input` para `Select` (autocomplete via Command/Popover) alimentado por `biblioteca_unidades` ativas, ordenadas por categoria/ordem.
- Validação no `save`: `tipo` e `unidade_id` obrigatórios; `estado_ia` default `'validado'` em novos artigos criados manualmente.
- Atualizar `src/lib/biblioteca-mestra/types.ts` (`ArtigoMestre` ganha `tipo`, `estado_ia`, `unidade_id`; novo tipo `Unidade`).

## Nova página: Gestão de Unidades

- Rota `src/routes/_app/biblioteca-mestra.unidades.tsx` (CRUD simples idêntico ao das categorias): listar, criar, editar, ativar/desativar.
- Entrada no menu/cards de `biblioteca-mestra.index.tsx`.

## Fora de âmbito

- Cor/ícone do badge "Estado IA" em outras páginas (orçamentos, procurement) — só Biblioteca Mestra.
- Conversões automáticas entre unidades.
- Remoção definitiva da coluna `unidade` texto (deferida).
- Lógica de IA que muda `estado_ia` automaticamente (fica para a fase do motor de classificação).

## Resumo técnico

1 migração SQL: 2 enums + 3 colunas em `biblioteca_artigos` + tabela `biblioteca_unidades` (com GRANTs, RLS, trigger) + backfill + índices.
1 insert SQL: seed das 16 unidades + backfill de `unidade_id`.
Edições: `types.ts`, `biblioteca-mestra.artigos.tsx`, `biblioteca-mestra.index.tsx`, nova rota `biblioteca-mestra.unidades.tsx`.
