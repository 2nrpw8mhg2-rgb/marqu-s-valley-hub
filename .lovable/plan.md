## Objetivo
Expor a funcionalidade de Subempreitadas no servidor MCP para que o ChatGPT possa auditar, analisar e validar orçamentos. Toda a autenticação continua via OAuth Supabase e RLS aplica-se como o utilizador ligado — sem service role.

## 1. Atualizar `obter_orcamento`
Ficheiro: `src/lib/mcp/tools/obter-orcamento.ts`

Expandir o `select` de `orcamento_artigos` para incluir:
`subempreitada_id, subempreitada_confianca, subempreitada_origem, subempreitada_validada_manual` + join `subempreitada:subempreitadas(codigo, nome)`.

Cada artigo devolve sempre os campos (com `null` quando não classificado):
```
subempreitada_id, subempreitada_codigo, subempreitada_nome,
subempreitada_confianca, subempreitada_origem, subempreitada_validada_manual
```

## 2. Novas ferramentas MCP
Criar sob `src/lib/mcp/tools/`:

- **`listar-subempreitadas.ts`** → `listar_subempreitadas` — sem input, devolve todas as subempreitadas ativas (`id, codigo, nome, descricao, ordem`).
- **`resumo-subempreitadas-orcamento.ts`** → `obter_resumo_subempreitadas_orcamento` — input `{ orcamento_id }`. Agrega por subempreitada: `numero_artigos`, `valor_total` (Σ `quantidade * preco_unitario`), `percentagem` do total, mais linha "Sem classificação".
- **`artigos-por-subempreitada.ts`** → `obter_artigos_por_subempreitada` — input `{ orcamento_id, subempreitada_id (nullable p/ não classificados) }`. Devolve lista completa de artigos com campos de subempreitada, capítulo e confiança.
- **`validar-subempreitada-artigo.ts`** → `validar_subempreitada_artigo` — input `{ artigo_id, subempreitada_id, validado_manual? }`. Replica a lógica de `alterarSubempreitadaArtigo`: update do artigo + insert em `subempreitada_aprendizagem` com `user_id = ctx.getUserId()`. Anotação `readOnlyHint: false`.
- **`separar-orcamento-por-subempreitada.ts`** → `separar_orcamento_por_subempreitada` — input `{ orcamento_id }`. Reutiliza a lógica de `classificarOrcamento` (import direto do engine + queries). Devolve `{ artigos_processados, artigos_classificados, sem_classificacao, tempo_ms, conflitos }` (conflitos = artigos com `confianca < 0.7`). Anotação `readOnlyHint: false`.

Todas usam `supabaseForUser(ctx)` — RLS aplica-se.

## 3. Registo
`src/lib/mcp/index.ts`: importar e adicionar as 5 ferramentas ao array `tools`. Bump `version` para `0.3.0`.

## 4. Metadados de auditoria
`obter_artigos_por_subempreitada` e `obter_orcamento` devolvem por artigo:
- `subempreitada_confianca` (score 0–1)
- `subempreitada_origem` (`manual | artigo_mestre | regras | ia`)
- `subempreitada_validada_manual` (bool)
- `updated_at` do artigo (timestamp da última alteração)

## 5. Validação
Após as edições, correr `app_mcp_server--extract_mcp_manifest` para regenerar `.lovable/mcp/manifest.json` e confirmar que as 5 novas tools aparecem sem erros.

## Notas técnicas
- Sem alterações de schema — todas as colunas já existem.
- Sem service role — tudo via cliente publishable + bearer do utilizador; RLS existente sobre `orcamento_artigos`, `subempreitadas` e `subempreitada_aprendizagem` cobre o acesso.
- Nomes de tools e mensagens em pt-PT.