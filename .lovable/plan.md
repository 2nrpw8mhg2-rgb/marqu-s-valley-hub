## Objetivo
Resolver o erro das tools `obter_orcamento` e `obter_artigos_por_subempreitada`, que pedem `orcamento_artigos.updated_at` (coluna inexistente).

## Decisão
Opção 2 — **adicionar a coluna `updated_at`**. É útil para auditoria/ordenação de artigos alterados manualmente (relevante na validação de subempreitadas) e não obriga a recuar noutras tools que possam vir a usá-la.

## Passos

1. **Migração de base de dados**
   - `ALTER TABLE public.orcamento_artigos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();`
   - Reutilizar a função `public.set_updated_at()` já existente no projeto (evita criar duplicados).
   - Criar trigger `BEFORE UPDATE` em `orcamento_artigos` que executa `public.set_updated_at()`.
   - Backfill implícito via `DEFAULT now()` para as linhas existentes.

2. **Sem alterações de código**
   - As tools MCP já fazem `select` de `updated_at`; após a migração passam a devolver o valor real em vez de `null`.

3. **Republicar**
   - Publicar a app para o endpoint `/mcp` produção ficar atualizado.
   - No ChatGPT, no conector **MV OC 2**, fazer *Refresh tools / Reconnect* para reler o manifesto.

## Notas técnicas
- Não altero `created_at` nem outras colunas.
- A coluna é `NOT NULL DEFAULT now()` — inserts existentes continuam a funcionar.
- Reutilizo `set_updated_at()` (já usa `SET search_path = public`).