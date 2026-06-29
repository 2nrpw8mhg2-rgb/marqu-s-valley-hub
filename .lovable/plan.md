## Correção do parser de resposta da IA

A última run falhou com `Unexpected non-whitespace character after JSON at position 4580` — o modelo devolveu o JSON correto mas com texto/markdown extra a seguir, e o fallback regex guloso voltou a falhar. A run terminou marcada como `concluido` com 0 termos.

### Alterações

**1. `src/lib/biblioteca-mestra/knowledge-builder.server.ts` — `callAI`**

- Adicionar helper `parseJsonLoose(content)` que:
  1. Remove fences ` ```json … ``` ` / ` ``` `.
  2. Faz `JSON.parse` direto.
  3. Se falhar, varre o conteúdo carácter a carácter (respeitando strings e escapes) e extrai o **primeiro objeto JSON balanceado**, ignorando o resto.
  4. Se nada parsear, devolve `{}`.
- Reforçar o system prompt: `"Devolve apenas JSON válido. Sem markdown, sem texto antes ou depois."`
- Adicionar `max_tokens: 4000` ao pedido para evitar truncatura com fontes grandes.

**2. `src/lib/biblioteca-mestra/knowledge-builder.server.ts` — `processRun`**

- Quando `scope.tipo === "artigo"` e o loop terminar com `falhados > 0` ou `total === 0`, anexar ao `resumo` o campo `erro` com a última mensagem do log (`✗ …`), para o UI poder distinguir "0 termos por falha" de "0 termos por escolha do utilizador".

**3. `src/components/biblioteca-mestra/KnowledgeRunReport.tsx`**

- Quando `report.erro` existir (ou `report.total === 0 && report.totalNovos === 0`), trocar o banner verde por banner âmbar **"⚠ Geração sem termos"** com a mensagem de erro e botão **Tentar novamente** (reusa o handler do botão Regenerar). Restante layout (fontes, antes/depois) mantém-se.

### Fora do âmbito

- Não muda o prompt de geração, fontes nem BD.
