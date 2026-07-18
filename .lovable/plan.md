## Objetivo

Aplicar os dados da migração `20260718221500_adicionar_subempreitada_estaleiro.sql` na base de dados e confirmar que o código do ecrã de Subempreitadas já reflete o commit `0bbfce9` (lista todas as subempreitadas ativas, incluindo as que têm zero artigos).

## Passo 1 — Aplicar os dados na base

O ficheiro é 100% DML (INSERT/UPDATE em `public.subempreitadas`), sem alterações de esquema. Uso a ferramenta de dados para:

- Inserir a subempreitada `ESTAL — Estaleiro` (ordem 5) com as palavras‑chave de estaleiro/instalações provisórias/PSS/telas finais (ON CONFLICT atualiza nome, descrição, palavras‑chave, exclusões, ordem e reativa).
- Atualizar `DIV — Limpezas e Diversos` para conter apenas os termos de limpeza/diversos (removendo os termos de estaleiro que passam para ESTAL).

Verificação: `SELECT codigo, nome, ordem FROM subempreitadas WHERE codigo IN ('ESTAL','DIV');` e confirmar que `palavras_chave` de DIV já não inclui termos de estaleiro.

## Passo 2 — Código do ecrã de Subempreitadas

Já confirmei em `src/routes/_app/orcamentos.$id.subempreitadas.tsx`:

- A query carrega `subempreitadas` ativas por ordem (linha 67) e guarda em `data.subs`.
- O render itera `data.subs.map(...)` (linha 315) e usa `stats.bySub.get(s.id) ?? { count: 0, total: 0, ... }` (linha 316), pelo que subempreitadas sem artigos aparecem com contadores a zero.
- O contador "Subempreitadas ativas" usa `stats.bySub.size` (linhas 256/275), que só conta as que têm artigos — está assim de propósito e não é o que o pedido pede alterar.

Conclusão: o comportamento pedido ("mostrar todas as subempreitadas mesmo com zero artigos") já está presente no código atual. Não há alteração de UI a fazer — cumpre a instrução "não alterar nem recriar a interface".

Após o Passo 1, a nova subempreitada `Estaleiro` passará a aparecer automaticamente na lista do ecrã, com zero artigos até correr a reclassificação.

## O que NÃO faço

- Não crio ficheiro de migração de esquema (não há DDL).
- Não altero componentes, estilos, filtros ou ordenação da UI.
- Não corro reclassificação automática — fica a cargo do utilizador via botão existente.
