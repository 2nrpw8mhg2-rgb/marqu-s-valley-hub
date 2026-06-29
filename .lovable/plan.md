## Problema

A geração de termos negativos está a propor materiais (`cimento`, `areia`, `argamassa`, `bloco`, `betonilha`, `tijolo`, `gesso cartonado`, `pladur`, `lã mineral`, `XPS`, `EPS`, `argila`, `fibra`, `juntas`, etc.). Materiais descrevem **sobre o quê** se trabalha — não o tipo de trabalho — e por isso aparecem legitimamente em descrições de Demolições, Pinturas, Rebocos, etc. Usá-los como negativos baixa o score destes artigos e provoca classificações erradas.

A causa está em `src/lib/biblioteca-mestra/knowledge-builder.server.ts`:

1. Não existe uma lista universal de materiais a excluir dos candidatos a negativo. O único bloqueio (`BLOQUEIO_DEMOLICOES_ESTRUTURA`) só se aplica a artigos da família Demolições/Estrutura — para os restantes, materiais como `betão`, `tijolo`, `cimento` continuam elegíveis.
2. Em `construirIndiceGlobal` (linhas 240-246), os tokens internos de cada expressão positiva curada são adicionados ao índice. Assim "argamassa de cimento" injecta `cimento` como termo de outra especialidade. Combinado com a falta de bloqueio universal, gera-se exactamente o padrão errado descrito pelo utilizador.

## Solução (apenas em `src/lib/biblioteca-mestra/knowledge-builder.server.ts`)

### 1. Lista universal de materiais — bloqueio transversal

Criar `MATERIAIS_CONSTRUCAO` (Set de formas canónicas via `canonicalizar` + `lemaSingular`) com os termos que **nunca** podem ser negativos para nenhuma especialidade:

```
betão, betao, bloco, tijolo, cimento, cimenticio, argamassa, areia, brita,
pedra, granito, mármore, ardósia, calcário, madeira, contraplacado, mdf, osb,
aço, ferro, alumínio, cobre, latão, inox, zinco, chumbo, pvc, ppr, peex,
multicamada, polietileno, polipropileno, cerâmica, cerâmico, mosaico,
azulejo, porcelânico, grés, terracota, reboco, estuque, betonilha,
gesso, gesso cartonado, pladur, lã mineral, lã de rocha, lã de vidro,
xps, eps, poliuretano, cortiça, argila, fibra, fibras, juntas, junta,
selante, mástique, vidro, espelho, tela, geotêxtil, membrana, papel,
tinta, primário, verniz, esmalte, asfalto, betume, gravilha, agregado,
inerte, calçada, lajeta, lajeado, pavê, cubo, paralelo
```

A lista é alfabética, agnóstica de família, e sempre canonicalizada (com `lemaSingular` para apanhar singulares/plurais — `tijolo`/`tijolos`, `bloco`/`blocos`, `junta`/`juntas`).

> Nota: vários destes termos podem (e devem) ser **positivos** num artigo específico. O bloqueio aplica-se apenas à pista de **negativos** automáticos; o pipeline de positivos não é afectado.

### 2. Aplicar o bloqueio em `derivarNegativos`

Em `derivarNegativos` (linha 296+), acrescentar logo após `if (bloqueioFamilia.has(termoCanon)) continue;`:

```ts
if (MATERIAIS_CONSTRUCAO.has(termoCanon)) continue;
```

O `BLOQUEIO_DEMOLICOES_ESTRUTURA` por família continua tal como está (cobre `viga`, `pilar`, `laje`, `armadura`, `cofragem`, `betonagem`, etc., para artigos de Demolições/Estrutura).

### 3. Não “explodir” expressões positivas em tokens individuais

No `construirIndiceGlobal`, remover o bloco que injecta cada token interno de uma expressão curada como termo isolado (linhas 240-246). Razão: foi precisamente esse bloco que fez `cimento` aparecer como “termo discriminante de outra especialidade” por estar dentro de `argamassa de cimento`. As expressões continuam a contar como termo único (ponto `c = canonicalizar(...)` mantém-se).

A FONTE 2 (classificações reais — linha 250+) **mantém-se inalterada**: a tokenização aí é legítima porque representa descrições reais inteiras, não expressões curadas.

### 4. Adicionar verbos/operações como reforço positivo (não bloquear nunca)

Para reforçar a intenção do utilizador — privilegiar **operações** como negativos legítimos — adicionar uma micro-lista `OPERACOES_ALVO` com palavras canónicas (`fornecimento`, `aplicacao`, `execucao`, `assentamento`, `montagem`, `instalacao`, `colocacao`, `fabrico`, `betonagem`, `pintura`, `impermeabilizacao`, `regularizacao`, `acabamento`, `afagamento`, `polimento`, `envernizamento`). Em `derivarNegativos`, dar bónus `+0.10` ao `score` quando o candidato pertence a este conjunto. Isto não cria novos negativos a partir do nada — apenas favorece os candidatos que já passam os gates estatísticos e que descrevem operações. Sem alteração nos thresholds.

### 5. Limpeza retroactiva

No bloco de limpeza já existente em `processRun` (referência: linha 1114, filtro por `tipo='termo_negativo'`), estender o predicado para também apagar registos cuja forma canónica está em `MATERIAIS_CONSTRUCAO`. Mantém-se a limpeza por `BLOQUEIO_DEMOLICOES_ESTRUTURA` para a família correspondente.

Logar separadamente: `negativos removidos por serem materiais: N`.

## Fora do âmbito

- Geração de positivos (palavras-chave, sinónimos, expressões, materiais) — pode continuar a aceitar `cimento`, `bloco`, `argamassa` quando relevante para o artigo.
- Motor de classificação, UI do Knowledge Builder, schema, edge functions.

## Como validar

1. **Biblioteca Mestra → Construtor de Conhecimento** → escolher *Pinturas* → **Regenerar tudo (apenas IA)**. Nenhum artigo deve apresentar `betão`, `reboco`, `gesso`, `cimento` como negativo.
2. Repetir para *Demolições Estruturais*: nenhum artigo deve apresentar `bloco`, `tijolo`, `betonilha`, `argamassa`, `cimento` como negativo; verbos como `betonagem`, `aplicacao`, `assentamento` podem aparecer se passarem nos gates.
3. Repetir para *Rebocos*: `cimento`, `areia`, `cal` ausentes dos negativos.
4. Confirmar nos logs da run a linha `negativos removidos por serem materiais: N` na limpeza retroactiva.