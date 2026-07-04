## Objetivo
Refinar o motor de classificação por subempreitada para maior precisão, respeitando threshold, hierarquia, exclusões e auditoria completa.

## Alterações

### 1. Palavras-chave e exclusões (migração de dados)
Atualizar `subempreitadas.palavras_chave` e `termos_exclusao` conforme a lista do pedido (PEDRA, CAPOTO, CAIX, CARPT, COZ, SANIT, AGUAS, AVAC, ELECT, PINT, PLADUR, REBOC, ALVEN, DEMOL, ESTRUT) via `insert` tool. Só substitui os arrays destas subempreitadas; as restantes ficam inalteradas.

Regras de exclusão específicas embutidas nos arrays (ex.: `PAV.termos_exclusao` ganha `rodape`; `CARPT.termos_exclusao` mantém `cozinha`; `SANIT.termos_exclusao` ganha `frigorifico`; `ESTRUT.termos_exclusao` ganha `soleira`, `peitoril`, `eps`).

### 2. Motor (`src/lib/subempreitadas/engine.ts`)
Reescrita com scoring aditivo em espaço 0..1 e cascata explícita:

1. Aprendizagem (match exato descrição normalizada) → conf 1.0
2. Artigo mestre com subempreitada principal → conf 0.95
3. Regras ponderadas:
   - match forte em termo principal na descrição: `+0.60`
   - match em capítulo original: `+0.20`
   - match em sinónimo/termo secundário: `+0.15`
   - unidade compatível (ex.: `m2` para PEDRA/CAPOTO/PINT/REBOC/PLADUR): `+0.05`
   - termo negativo (exclusão): `−0.50`
   - clamp final [0..1]
4. Conflito: se `(best.score − 2ª.score) < 0.20` → devolve `origem="conflito"`, `subempreitada_id=null`.
5. Threshold: se `conf < 0.70` → `subempreitada_id=null`, `origem="baixa_confianca"`, mas `subempreitada_sugerida_id` preservado no resultado para auditoria.

Nova assinatura do resultado inclui:
```ts
{
  subempreitada_id: string | null,
  subempreitada_sugerida_id: string | null,
  confianca: number,
  origem: "manual"|"aprendizagem"|"artigo_mestre"|"regras"|"baixa_confianca"|"conflito"|"sem_regra",
  razao: string,             // ex.: "match forte 'soleira' + capítulo 'pedras'"
  termos_match: string[],    // termos que fizeram match positivo
  conflitos: Array<{ subempreitada_id, score }>,
  alternativas: Array<{ subempreitada_id, score }>,
}
```

Distinção termo forte vs sinónimo: primeiros ~4 elementos de `palavras_chave` = fortes, restantes = sinónimos (convenção; ordem já reflete importância).

### 3. Persistência
Migração acrescenta a `orcamento_artigos`:
- `subempreitada_sugerida_id uuid` (fk → subempreitadas)
- `subempreitada_razao text`
- `subempreitada_termos_match jsonb`

E amplia o CHECK de `subempreitada_origem` para incluir `"baixa_confianca"` e `"conflito"`.

### 4. Server functions (`classify.functions.ts`)
- `classificarArtigo` invocado com contexto do capítulo, artigo mestre (via `orcamento_artigo_fontes` quando ligado a `biblioteca_artigos`) e aprendizagem.
- **Preserva sempre** `subempreitada_validada_manual = true` (já filtrado no `where`, mas reforço com guarda explícita).
- Grava `subempreitada_id`, `_sugerida_id`, `_confianca`, `_origem`, `_razao`, `_termos_match`.
- Batching mantido (1 update por artigo).

### 5. MCP tools
- `obter_orcamento` e `obter_artigos_por_subempreitada`: passam a devolver `subempreitada_sugerida_id`, `subempreitada_razao`, `subempreitada_termos_match` (auditoria).
- `resumo_subempreitadas_orcamento`: contadores adicionais para `baixa_confianca` e `conflito`.
- `separar_orcamento_por_subempreitada`: bucket adicional "Necessita validação" (baixa_confianca + conflito + null).

### 6. UI
Alterações mínimas na página `/orcamentos/$id/subempreitadas`:
- Nova secção "Necessita validação" com contagem de baixa_confianca + conflito.
- Cada linha mostra `sugerida` + `razão` (tooltip) quando `subempreitada_id` é null mas há sugestão.
- Sem alterações de fluxo de validação manual.

## Plano de release
1. Migração schema (colunas + check).
2. Migração dados (palavras-chave/exclusões).
3. Código: `engine.ts` reescrito, `classify.functions.ts` ajustado, tools MCP atualizadas, UI.
4. Publicar → reconectar conector MV OC 2 no ChatGPT.
5. Correr `classificarOrcamento` no orçamento Murtal para validar os casos esperados.

## Notas
- Não altero validações manuais existentes.
- Retro-compatibilidade: `subempreitada_origem` antigos (`regras`,`aprendizagem`,...) continuam válidos.
- Threshold e pesos ficam constantes exportadas no topo do `engine.ts` para afinação futura.