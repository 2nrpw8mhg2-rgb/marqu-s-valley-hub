# Plano — Módulo MCP Biblioteca Mestra (Knowledge Engine)

## 1. Arquitetura

Novo agrupamento de tools dentro do MCP existente (`src/lib/mcp/index.ts`), sob a pasta `src/lib/mcp/tools/biblioteca/`. Todas seguem o padrão `defineTool` já em uso, com Zod, `annotations` corretos (`readOnlyHint`, `destructiveHint`) e chamadas via `supabaseForUser(ctx)` para respeitar RLS.

Cada tool devolve sempre:
- `subempreitada` (quando aplicável) — não, aqui é: `resultado`, `origem`, `confianca`, `razao`, `avisos`, `sugestoes` (harmoniza com padrão do motor de subempreitadas).

Todo o texto gerado por IA passa por normalizador pt-PT (reutiliza regra existente `mem://constraints/idioma-ptpt`).

## 2. Alterações de schema (migração única)

Tabelas novas ou reforçadas:

- `biblioteca_artigo_conhecimento` — já existe; adicionar índices por `tipo` e `origem`, coluna `score` (numeric) e `aprovado_por` (uuid).
- `biblioteca_artigo_relacoes` — já existe; garantir enum `tipo_relacao` inclui `variante_de`, `sucessor_de`, `componente_de`.
- `biblioteca_artigo_qualidade` (nova) — snapshot por artigo: `completude`, `score_qualidade`, `n_utilizacoes`, `n_classif_auto`, `n_validacoes_humanas`, `ultima_auditoria`.
- `biblioteca_auditoria_run` (nova) — cabeçalho + `resumo jsonb` (duplicados, lacunas, recomendações).
- `biblioteca_sugestao` (nova) — sugestões pendentes de reclassificação/fusão: `artigo_id`, `tipo` (reclassificar|fundir|renomear|nova_relacao), `payload jsonb`, `estado` (pendente|aceite|rejeitada), `origem` (ia|regra|utilizador), `confianca`.
- `biblioteca_aprendizagem_evento` (nova) — log append-only de cada correção/aprovação, para o motor aprender.

Todas com `GRANT` para `authenticated`/`service_role`, RLS scoped a `authenticated` (biblioteca é partilhada, políticas simples de leitura para todos autenticados, escrita para roles admin/editor via `has_role`).

## 3. Tools MCP (14)

Ficheiros em `src/lib/mcp/tools/biblioteca/`:

1. `listar-biblioteca-completa.ts` — paginação obrigatória (`cursor`, `limite<=500`); filtros por especialidade/subespecialidade/categoria; devolve árvore + metadados de qualidade. `readOnlyHint`.
2. `obter-artigo-mestre.ts` — devolve artigo + conhecimento + relações + exemplos + estatísticas.
3. `criar-artigo-mestre.ts` — cria artigo + conhecimento inicial numa transação (RPC).
4. `editar-artigo-mestre.ts` — patch parcial; escreve evento de aprendizagem.
5. `enriquecer-artigo-com-ia.ts` — chama Lovable AI Gateway (`google/gemini-2.5-flash`) com prompt estruturado; devolve proposta (não grava); segunda chamada `aplicar_enriquecimento` para persistir após revisão. Calcula `score_qualidade`.
6. `adicionar-palavras-chave.ts` — merge sem apagar; regista origem.
7. `adicionar-sinonimos.ts` — filtro pt-PT (bloqueia lista negra pt-BR).
8. `adicionar-termos-negativos.ts` — distingue `concorrente` vs `incompativel`; valida que incompatíveis são de outra especialidade.
9. `adicionar-exemplos.ts` — aceita origem (`mq`|`orcamento`|`obra`) + ref.
10. `criar-relacoes.ts` — cria relação bidirecional via trigger existente.
11. `auditar-biblioteca.ts` — corre em background (usa `biblioteca_auditoria_run`); devolve `run_id`; segunda tool `obter_auditoria(run_id)`.
12. `detetar-duplicados.ts` — usa `pg_trgm` (já instalado) + embeddings opcionais; devolve pares com `similaridade`.
13. `detetar-lacunas.ts` — cruza `orcamento_artigos` sem match com Biblioteca; agrupa por especialidade.
14. `sugerir-reclassificacoes.ts` — grava em `biblioteca_sugestao` (nunca aplica). Tool auxiliar `aprovar_sugestao(id)` aplica após validação humana.

## 4. Motor de aprendizagem contínua

`src/lib/biblioteca-mestra/learning.server.ts`:
- Hook chamado por: correção manual em `/classificacao`, aceitação de sugestão, criação de artigo, adição de kw/sinónimo/exemplo.
- Regista evento em `biblioteca_aprendizagem_evento`.
- Trigger SQL agenda recomputação de `score_qualidade` do artigo afetado.

## 5. Dashboard de Qualidade

Nova rota `/_app/biblioteca-mestra/qualidade.tsx`:
- Cartões: totais por entidade, score médio, cobertura %, artigos completos %.
- Tabelas: duplicados detetados, lacunas, sugestões pendentes.
- Botões: "Correr auditoria", "Enriquecer em lote", "Ver sugestões".
- Dados via server functions (`getBibliotecaQualidade`, `listSugestoes`) — não consomem MCP.

## 6. Registo e publicação

- `src/lib/mcp/index.ts`: importar as 14 tools + `aplicar_enriquecimento` + `aprovar_sugestao` + `obter_auditoria` = 17 tools no total no grupo Biblioteca.
- Correr `app_mcp_server--extract_mcp_manifest` após alterações.
- Publicar; reconectar conector MV OC 2 no ChatGPT.

## 7. Segurança e limites

- Escritas restritas a role `admin` ou `editor_biblioteca` via `has_role` dentro de cada tool.
- `enriquecer_artigo_com_ia` limita 20 chamadas/min por utilizador.
- Todas as tools de escrita são `destructiveHint: false` exceto `editar_artigo_mestre` e `aprovar_sugestao`.

## 8. Ordem de entrega

```text
1. Migração (schema + RLS + GRANT)
2. Server helpers (learning, quality scoring, pt-PT filter)
3. 17 tools MCP
4. Registo no MCP + extract manifest
5. Dashboard /biblioteca-mestra/qualidade
6. Publicar + reconectar
7. Validação: auditar Biblioteca real, enriquecer 1 artigo, aprovar sugestão
```

## Notas técnicas

- Enriquecimento IA usa `LOVABLE_API_KEY` já existente, modelo `google/gemini-2.5-flash`, `response_format: json_object`.
- Score de qualidade = média ponderada: kw(0.15) + sinónimos(0.1) + expressões(0.1) + materiais(0.1) + negativos(0.15) + exemplos(0.15) + relações(0.15) + unidade(0.05) + capítulos(0.05).
- Paginação obrigatória em `listar_biblioteca_completa` para suportar milhões de artigos.
- Todas as respostas incluem `origem` e `razao` (mesmo padrão do motor de subempreitadas afinado na iteração anterior).
