## Duas novas ferramentas MCP: descoberta da Biblioteca Mestra

Objetivo: eliminar a dependência de UUIDs manuais. O ChatGPT passa a poder listar a estrutura completa e pesquisar subespecialidades por nome (tolerante a acentos/maiúsculas/parcial), obter o `id` e encadear com `enriquecer_subespecialidade_com_ia`.

### Ficheiros a criar

1. `src/lib/mcp/tools/biblioteca/listar-subespecialidades.ts`
2. `src/lib/mcp/tools/biblioteca/pesquisar-subespecialidade.ts`

E registar ambos em `src/lib/mcp/index.ts` (import + entrada no array `tools`). Bump da versão MCP: `0.5.0` → `0.6.0`.

Nenhuma migração de BD. Usa `biblioteca_especialidades`, `biblioteca_subespecialidades`, `biblioteca_artigos`, `biblioteca_artigo_qualidade`. Ambos usam `supabaseForUser(ctx)` (RLS aplica-se), `notAuthed()` sem sessão.

---

### 1. `listar_subespecialidades`

Anotações: `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`, `idempotentHint: true`.

Input (Zod):
- `especialidade_id?: uuid` — filtro opcional
- `apenas_ativas?: boolean` (default `true`) — só conta artigos com `ativo=true` no total principal, mas devolve sempre também o total absoluto
- `incluir_qualidade?: boolean` (default `true`)

Fluxo:
1. Ler `biblioteca_especialidades` (id, codigo, nome), ordenar por `codigo`/`nome`.
2. Ler `biblioteca_subespecialidades` (id, codigo, nome, especialidade_id), com filtro opcional.
3. Contar artigos por `subespecialidade_id` em `biblioteca_artigos` — dois counts: `n_artigos_ativos` (`ativo=true`) e `n_artigos_total`.
4. Se `incluir_qualidade`: ler `biblioteca_artigo_qualidade` para os artigos envolvidos e calcular média de `score_qualidade` por subespecialidade (arredondar a 3 casas). Se sem dados → `null`.
5. Agregar em estrutura aninhada.

Output:
```
{
  especialidades: [
    {
      id, codigo, nome,
      subespecialidades: [
        { id, codigo, nome, n_artigos_ativos, n_artigos_total, score_medio_qualidade }
      ]
    }
  ],
  totais: { n_especialidades, n_subespecialidades, n_artigos_ativos, n_artigos_total }
}
```

---

### 2. `pesquisar_subespecialidade`

Anotações: `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`, `idempotentHint: true`.

Input (Zod):
- `nome: string` (obrigatório, trim, min 2)
- `especialidade_nome?: string` — filtro tolerante pelo nome da especialidade pai
- `apenas_ativas?: boolean` (default `true`)
- `limite?: number` (1–20, default 10)

Fluxo:
1. Normalizar: `NFD` → remover diacríticos → `toLowerCase()` → `trim()`. Aplica-se ao input e a cada candidato.
2. Ler todas as subespecialidades + nome da especialidade pai (join via `especialidade_id`).
3. Se `especialidade_nome`: filtrar em memória por `includes` normalizado.
4. Scoring por subespecialidade:
   - exato (nome ou código): 100
   - código exato: 95
   - prefixo: 80
   - contido: 60
   - sobreposição de tokens: 30 + 10×n_tokens_partilhados
   - descartar score 0
5. Ordenar por score desc, cortar a `limite`.
6. Para cada resultado: contar `n_artigos_ativos` / `n_artigos_total` e ler `score_medio_qualidade` (mesma lógica da ferramenta 1).
7. `match_unico`: `true` se 1 resultado, ou se o top tem score 100 e o segundo <100.

Output:
```
{
  match_unico: boolean,
  subespecialidade?: { id, codigo, nome, especialidade: { id, nome }, n_artigos_ativos, n_artigos_total, score_medio_qualidade },
  correspondencias: [ { id, codigo, nome, especialidade: {...}, n_artigos_ativos, n_artigos_total, score_medio_qualidade, score_match } ],
  razao: "..." // pt-PT, ex.: "Encontrada 1 correspondência exata." / "3 correspondências possíveis — pedir ao utilizador para especificar."
}
```

Regras: **nunca escreve**. Sem match → `correspondencias: []` e `razao` sugere usar `listar_subespecialidades`.

---

### Depois da criação

- `app_mcp_server--extract_mcp_manifest` para regenerar `.lovable/mcp/manifest.json` (deve ficar com 27 ferramentas, versão `0.6.0`).
- Publicar. No ChatGPT: **Refresh tools** no conector MV OC.

### Fluxo final desbloqueado

"Enriquece a subespecialidade Alvenarias." → `pesquisar_subespecialidade("Alvenarias")` → obtém `id` → `enriquecer_subespecialidade_com_ia({ subespecialidade_id, aplicar: false })` → proposta → confirmação → `aplicar: true`.
