## Knowledge Builder — Fontes Multi-Nível

Evoluir `recolherFontes` para consultar três fontes distintas, com pesos e confiança próprios, e refletir tudo isto no prompt da IA, na persistência e no painel "Conhecimento IA".

### 1. Três fontes em `recolherFontes(sb, artigoId)`

**Fonte A — Histórico do Artigo Mestre** (mantém + refina)
- Query a `classificacao_artigos` com estados `validado`, `classificado_manual`, `classificado_auto`.
- Agrupar por descrição normalizada, contando ocorrências por estado.
- Confiança base por linha:
  - `validado` / `classificado_manual` → 95
  - `classificado_auto` → `min(85, score original)` (usar coluna de score se existir; senão 70)
- Resultado: `historico[]` com `{ descricao, ocorrencias, confiancaBase, estado }`.

**Fonte B — Orçamentos brutos** (`orcamento_artigos`)
- Ativa quando `historico.length < 20` OU sempre como complemento (limite 200 linhas).
- Filtro: linhas ainda não classificadas para este artigo (sem entrada em `classificacao_artigos` para o par `orcamento_artigo_id` × `artigo_mestre_id`, ou estado `sem_classificacao`).
- Procura por similaridade textual (pg_trgm via `similarity()`) entre `orcamento_artigos.descricao` e o conjunto:
  - descrição do Artigo Mestre
  - keywords já existentes no `biblioteca_artigo_conhecimento` deste artigo
  - nome da especialidade/subespecialidade/categoria
- Threshold de similaridade ≥ 0.25; ordenar por score desc, top 60.
- Confiança base: `Math.round(40 + similaridade*40)` (intervalo 50–80).
- Resultado: `candidatos[]` com `{ descricao, similaridade, confiancaBase }`.

**Fonte C — Artigos semelhantes**
- Buscar até 15 artigos da mesma subespecialidade (fallback: mesma especialidade) excluindo o atual.
- Para cada um, ler top descrições validadas de `classificacao_artigos` (limit 5 por artigo).
- Devolver `semelhantes[]` com `{ artigoCodigo, artigoDescricao, exemplos[] }`.
- Usado pela IA principalmente para gerar **termos negativos** (palavras comuns nos vizinhos mas que não pertencem a este artigo) e contexto.
- Confiança base baixa (40–55) se o termo só aparecer aqui.

### 2. Prompt da IA

Estender `buildPrompt` para incluir secções claramente separadas:

```
FONTE A — Descrições validadas para este artigo (peso alto, N=…)
  (123x) [validado] fornecimento e aplicação de…
  …
FONTE B — Descrições brutas candidatas por similaridade (peso médio, N=…)
  (sim 0.72) execução de vedação provisória em…
  …
FONTE C — Artigos vizinhos para diferenciação (N artigos, N=… exemplos)
  Artigo "Tapumes": pintura, sinalização, …
  Artigo "Portões Provisórios": automação, motor, …
```

Instruções adicionais à IA:
- Para cada termo, indicar **fonte_origem** (`historico` | `candidatos` | `vizinhos` | `inferido`) na resposta JSON.
- A confiança deve refletir a fonte (regras acima).
- Termos que aparecem nos vizinhos mas não no artigo → marcar como `termos_negativos`.
- Quando `FONTE A` for vazia, ser conservador: confiança ≤ 65 e adicionar prefixo `[provisório]` na justificação.

### 3. Persistência

Em `persistir`:
- Acrescentar campo `fonte_origem` (texto) à linha guardada.
- Mapear `fonte_origem` → coluna `origem` do enum existente:
  - `historico` → `mapas_quantidades`
  - `candidatos` → novo valor `orcamentos_brutos` (ver migração)
  - `vizinhos` → novo valor `artigos_vizinhos`
  - `inferido` → `ia`
- `calcOcorrenciasEExemplos` passa a varrer as três fontes (histórico + candidatos), guardando até 3 exemplos com tag da fonte.

### 4. Migração SQL

```sql
ALTER TYPE biblioteca_conhecimento_origem
  ADD VALUE IF NOT EXISTS 'orcamentos_brutos';
ALTER TYPE biblioteca_conhecimento_origem
  ADD VALUE IF NOT EXISTS 'artigos_vizinhos';

-- Índice trigram para pesquisa rápida em orcamento_artigos
CREATE INDEX IF NOT EXISTS idx_orc_art_descr_trgm
  ON orcamento_artigos USING gin (descricao gin_trgm_ops);
```

(`pg_trgm` já está instalado — confirmado pelas funções `similarity_op` listadas.)

### 5. Resumo / painel de fontes

Estender o `resumo` JSON gravado no `biblioteca_knowledge_run` com:
```json
{
  "fontes": {
    "historico_validado": 124,
    "historico_auto": 86,
    "candidatos_brutos": 312,
    "vizinhos_analisados": 14
  },
  "semHistorico": false,
  …
}
```

Em `ArtigoConhecimentoTab.tsx`:
- Dashboard ganha um bloco **"Fontes analisadas"** com as 4 métricas (ícone + número + label).
- Quando `semHistorico === true`, mostrar banner informativo amarelo no topo:
  > "Este Artigo Mestre ainda não possui histórico validado. A IA usou descrições semelhantes de mapas importados e artigos vizinhos. A confiança inicial é inferior até validação."
- Coluna "Origem" passa a distinguir os 4 ícones: 📄 histórico, 📥 bruto, 🧭 vizinho, 🤖 IA.
- No painel de detalhe (Sheet), separar exemplos por fonte.

### 6. Diálogo de geração

No `AlertDialog` do botão "Gerar Conhecimento IA", atualizar o texto da análise:
- "Histórico validado deste artigo"
- "Descrições brutas similares em mapas importados"
- "Artigos tecnicamente próximos (para termos negativos)"
- Tempo estimado ~15–20 s.

### Ficheiros afetados

- **Migração nova**: `supabase/migrations/<ts>_knowledge_sources_multi.sql`
- `src/lib/biblioteca-mestra/knowledge-builder.server.ts` — `recolherFontes`, `buildPrompt`, `callAI` (aceitar `fonte_origem`), `persistir`, `processRun` (resumo).
- `src/components/biblioteca-mestra/ArtigoConhecimentoTab.tsx` — bloco de fontes, banner, ícones de origem, detalhe.
- `src/lib/biblioteca-mestra/types.ts` — estender `CONHECIMENTO_ORIGENS` com `orcamentos_brutos` e `artigos_vizinhos` (label + ícone).

### Fora do âmbito (esta iteração)

- Knowledge Builder em lote (scope ≠ artigo) continua a usar apenas Fonte A — manter compatibilidade.
- Reescrever motor de classificação para usar os novos pesos de origem.
