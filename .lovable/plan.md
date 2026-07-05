## Nova ferramenta MCP: `enriquecer_subespecialidade_com_ia`

Enriquecimento em lote de todos os Artigos Mestre ativos de uma subespecialidade, com uma única chamada MCP em vez de N chamadas de `enriquecer_artigo_com_ia`.

### Ficheiro a criar

`src/lib/mcp/tools/biblioteca/enriquecer-subespecialidade-com-ia.ts`

Registar em `src/lib/mcp/index.ts` (import + entry no array `tools`). Bump da versão do MCP de `0.4.0` → `0.5.0`.

### Input (Zod)

```
subespecialidade_id: uuid (obrigatório)
palavras_chave, sinonimos, expressoes, materiais, negativos_concorrentes, negativos_incompativeis: number, default 10
capitulos, exemplos: number, default 5
criar_relacoes: boolean, default true
aplicar: boolean, default false
limite?: number (default 50, máx 200 — evita timeouts e custos)
offset?: number (default 0)
modelo?: enum, default "google/gemini-2.5-flash"
```

### Fluxo do handler

1. `notAuthed()` se sessão inválida. Cliente Supabase do utilizador (RLS aplica-se).
2. Ler subespecialidade + nome da especialidade pai (contexto para o prompt).
3. Listar artigos ativos da subespecialidade com paginação `limite/offset`, ordenados por `codigo`. Se vazio → devolver resumo com aviso.
4. Para cada artigo, em série (para respeitar rate limit da IA):
   - Ler conhecimento existente (`biblioteca_artigo_conhecimento` ativo) e indexar por `(tipo, termo.toLowerCase())` — a proposta será filtrada contra este set para nunca duplicar.
   - Calcular `score_antes` via `contarConhecimento` + query de relações (mesma lógica de `_shared.ts`).
   - Chamar Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) com prompt pt-PT reforçado (lista negra explícita: "tijolo baiano", "alvenaria de concreto", "contrapiso", "drywall", "massa corrida" → substituir por "tijolo cerâmico", "bloco de betão", "betonilha", "placa de gesso cartonado", "argamassa de assentamento"), pedindo os counts especificados nos parâmetros. `response_format: json_object`.
   - Normalizar via `normalizarPtPt` + filtrar termos já existentes.
   - Se `aplicar=false`: acumular proposta no output; gravar uma linha em `biblioteca_sugestao` (`tipo: novo_conhecimento`, `origem: ia`) por artigo para permitir aprovação posterior via `aprovar_sugestao`.
   - Se `aplicar=true`:
     - Insert em lote em `biblioteca_artigo_conhecimento` (origem=ia, ativo=true, confianca do modelo).
     - Se `criar_relacoes=true`: para cada relação sugerida, tentar resolver o artigo destino por código exacto dentro da mesma subespecialidade/especialidade; ignorar silenciosamente se não encontrar (relações inter-artigo requerem UUID, não inventar).
     - `registarAprendizagem(sb, artigo_id, "enriquecido_ia_lote", {...counts}, userId)`.
     - `recalcularQualidade(sb, artigo_id)` → `score_depois`.
   - Try/catch por artigo: falhas individuais são registadas em `erros[]`, o lote continua.
5. Nunca tocar em: `descricao`, `unidade`, `subespecialidade_id`, `categoria_id`, `especialidade_id`, `ativo`. Nunca fazer `delete`/`update` de conhecimento existente.

### Output (JSON estruturado)

```
{
  subespecialidade: { id, nome, especialidade },
  parametros: { aplicar, criar_relacoes, limite, offset, alvos: {...} },
  totais: {
    artigos_encontrados, artigos_enriquecidos, artigos_ignorados,
    palavras_chave, sinonimos, expressoes, materiais,
    capitulos_tipicos, exemplos_reais,
    negativos_concorrentes, negativos_incompativeis, relacoes
  },
  qualidade: { score_medio_antes, score_medio_depois, delta },
  artigos: [ { id, codigo, descricao, score_antes, score_depois, adicionados: {...}, aplicado } ],
  propostas?: [...] // só se aplicar=false
  erros: [ { artigo_id, codigo, mensagem } ],
  razao: "..."
}
```

### Salvaguardas anti-pt-BR

- Prompt system inclui lista de proibidos + substitutos.
- `normalizarPtPt` aplicado a **todos** os termos antes de comparar/gravar.
- `detetarPtBr` residual gera avisos em `erros[]` (não bloqueia).

### Anotações MCP

`readOnlyHint: false`, `destructiveHint: false`, `openWorldHint: true` (chama IA externa), `idempotentHint: false`.

### Depois da criação

Correr `app_mcp_server--extract_mcp_manifest` para regenerar `.lovable/mcp/manifest.json` (deve passar a listar 26 ferramentas, versão `0.5.0`). Publicar. No ChatGPT: **Refresh tools** no conector MV OC.

### Notas técnicas

- Nenhuma migração de BD necessária — todas as tabelas usadas já existem (`biblioteca_artigos`, `biblioteca_artigo_conhecimento`, `biblioteca_artigo_relacoes`, `biblioteca_artigo_qualidade`, `biblioteca_aprendizagem_evento`, `biblioteca_sugestao`).
- `LOVABLE_API_KEY` lida dentro do handler (nunca no top-level).
- Processamento em série com pausa opcional entre chamadas caso o gateway devolva 429 (retry simples).
- Cap rígido de 200 artigos por chamada protege contra timeouts do Worker.
