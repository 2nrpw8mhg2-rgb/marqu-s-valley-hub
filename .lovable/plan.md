# FASE 1 — Knowledge Base por Artigo Mestre

Objetivo: criar a infraestrutura (tabela + UI de gestão) para guardar conhecimento por artigo. **Não altera o algoritmo de classificação**. A `biblioteca_artigo_keywords` atual mantém-se intacta e o motor continua a usá-la.

## 1. Migração — nova tabela `biblioteca_artigo_conhecimento`

Dois ENUMs novos (extensíveis com `ALTER TYPE ... ADD VALUE` no futuro):

- `biblioteca_conhecimento_tipo`: `palavra_chave`, `sinonimo`, `expressao`, `material`, `termo_negativo`
- `biblioteca_conhecimento_origem`: `ia`, `utilizador`, `sistema`, `importacao`

Tabela:

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `artigo_mestre_id` | uuid NOT NULL | FK → `biblioteca_artigos(id)` ON DELETE CASCADE |
| `tipo` | enum acima | NOT NULL |
| `termo` | text | NOT NULL, trim, não vazio (CHECK) |
| `peso` | integer | NOT NULL DEFAULT 10 (permite negativo para `termo_negativo`) |
| `origem` | enum acima | NOT NULL DEFAULT `'utilizador'` |
| `confianca` | numeric(5,2) | NOT NULL DEFAULT 100, CHECK 0–100 |
| `ativo` | boolean | NOT NULL DEFAULT true |
| `created_at` | timestamptz | DEFAULT now() |
| `updated_at` | timestamptz | DEFAULT now() + trigger `set_updated_at` |

Unicidade: `UNIQUE (artigo_mestre_id, tipo, lower(termo))` para evitar duplicados.

Índices:
- `(artigo_mestre_id)`
- `(tipo)`
- `(ativo)`
- GIN `gin_trgm_ops` em `lower(termo)` para pesquisa rápida por substring (ativa `pg_trgm` se ainda não estiver).
- Composto `(artigo_mestre_id, tipo, ativo)` para a query mais comum (carregar conhecimento ativo de um artigo).

Permissões + RLS (padrão do projeto):
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_artigo_conhecimento TO authenticated;
GRANT ALL ON public.biblioteca_artigo_conhecimento TO service_role;
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
CREATE POLICY "biblioteca_conhecimento_auth_all" ... TO authenticated USING (true) WITH CHECK (true);
```
(mesmo padrão das outras tabelas `biblioteca_*`)

Trigger `BEFORE UPDATE` a chamar `public.set_updated_at()` (já existe).

## 2. Tipos TypeScript

Após a migração, `src/integrations/supabase/types.ts` é regenerado automaticamente. Adicionar em `src/lib/biblioteca-mestra/types.ts`:

- `ConhecimentoTipo`, `ConhecimentoOrigem` (com labels PT)
- `ArtigoConhecimento` (espelha a row)
- Constantes `CONHECIMENTO_TIPOS` e `CONHECIMENTO_ORIGENS` para selects.

## 3. UI — aba "Conhecimento IA" na ficha do Artigo Mestre

Refatorar `src/components/biblioteca-mestra/ArtigoMestreFormDialog.tsx`:

- Envolver o conteúdo do dialog num `Tabs` com duas abas:
  - **Geral** — formulário atual (campos + keywords positivas/negativas existentes, sem mudanças).
  - **Conhecimento IA** — novo painel (ver abaixo).
- A aba "Conhecimento IA" só fica ativa quando o artigo já foi guardado (precisa de `editing.id`). Para artigos novos mostra mensagem: "Guarde o artigo primeiro para adicionar conhecimento."

Novo componente `src/components/biblioteca-mestra/ArtigoConhecimentoTab.tsx`:

- Query `["bm-conhecimento", artigoId]` que carrega todos os registos do artigo ordenados por `tipo`, depois `termo`.
- Tabela com colunas: **Tipo** (badge colorido por tipo), **Termo**, **Peso** (input inline editável), **Origem** (badge), **Confiança** (%), **Ativo** (Switch), **Ações** (editar / remover).
- Barra superior:
  - Filtros: select por `tipo`, toggle "mostrar inativos", campo de pesquisa por termo.
  - Botão **"Adicionar conhecimento"** → abre dialog secundário com: tipo (select), termo (input), peso (number, default conforme tipo: 30 palavra-chave, 10 sinónimo, 40 expressão, 8 material, −30 termo negativo), confiança (slider 0–100, default 100).
- Mutations:
  - `insert` → `origem = 'utilizador'`.
  - `update` (peso, ativo, confiança, termo, tipo).
  - `delete` (com confirmação).
- Empty state quando o artigo ainda não tem conhecimento, com CTA para adicionar o primeiro.
- Contador "X registos · Y ativos" no topo.

Acessos a dados via cliente Supabase existente (`@/integrations/supabase/client`), igual ao resto do módulo Biblioteca Mestra. Sem server functions novas.

## 4. Listagem de Artigos Mestre — coluna "Conhecimento"

Em `src/routes/_app/biblioteca-mestra.artigos.tsx` (ajuste mínimo, opcional mas útil):

- Adicionar contagem agregada de registos ativos de conhecimento por artigo (query separada `select artigo_mestre_id, count(*) ... group by` filtrada pela página visível) e mostrar badge "N" ao lado do nome. Permite ver rapidamente que artigos ainda estão "vazios".

## 5. Não alterado nesta fase

- `src/lib/classificacao/engine.ts` — **sem mudanças**. O motor continua a usar `biblioteca_artigo_keywords` + keywords de especialidade/subespecialidade exatamente como hoje.
- `biblioteca_artigo_keywords` — mantida. Numa fase futura poderá ser migrada para `biblioteca_artigo_conhecimento` (tipos `palavra_chave` / `termo_negativo`), mas não agora.
- Sem alterações em RLS de outras tabelas, sem novas edge functions, sem Knowledge Builder ainda.

## Resumo de ficheiros tocados

- **Migração SQL** (1): cria enums, tabela, índices, RLS, trigger.
- `src/lib/biblioteca-mestra/types.ts` — novos tipos e constantes.
- `src/components/biblioteca-mestra/ArtigoMestreFormDialog.tsx` — abas Geral / Conhecimento IA.
- `src/components/biblioteca-mestra/ArtigoConhecimentoTab.tsx` — **novo**.
- (Opcional) `src/routes/_app/biblioteca-mestra.artigos.tsx` — badge de contagem.

## Validação manual após implementação

1. Abrir um artigo mestre existente → aba "Conhecimento IA" → adicionar registos de cada tipo → confirmar persistência, edição inline, ativar/desativar e remover.
2. Confirmar via dados que o algoritmo de classificação continua a produzir os mesmos resultados de antes (correr "Reclassificar" num orçamento de teste e comparar contagens `classificado_auto` / `necessita_revisao` / `sem_classificacao`).
