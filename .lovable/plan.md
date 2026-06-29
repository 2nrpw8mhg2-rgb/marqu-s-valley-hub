
## Problema

O Knowledge Builder está a gerar **os mesmos termos como positivos e negativos** no mesmo artigo (ex.: "betão", "vigas", "pilares" aparecem em palavras-chave **e** em termos negativos de Demolições Estruturais), porque os negativos são livremente inventados pela IA a partir da FONTE C (artigos vizinhos da mesma subespecialidade) e não há validação cruzada antes de gravar. Há ainda duplicados ("betão" três vezes), falta de normalização singular/plural e nenhuma estatística inter-especialidades a sustentar os negativos.

## Objetivo

Transformar a geração de conhecimento num processo **estatisticamente fundamentado**:
- Negativos só existem se forem **dominantes noutras especialidades e ausentes neste artigo**.
- Um termo **nunca** pode estar em duas listas em simultâneo.
- Tudo normalizado (acentos, plural, espaços) e único.
- Mostrar **frequência e origem** ao utilizador para explicabilidade.

## O que vai mudar

Toda a alteração concentra-se em `src/lib/biblioteca-mestra/knowledge-builder.server.ts` (motor) e dois pequenos ajustes na UI (`ArtigoConhecimentoTab.tsx` para mostrar frequência/explicação). Sem alterações de schema — os campos `ocorrencias`, `justificacao`, `exemplos` e `confianca` já existem em `biblioteca_artigo_conhecimento`.

### 1. Normalização canónica de termos (nova função `canonicalizar`)

Aplicada antes de qualquer comparação ou gravação:
- minúsculas + remover acentos (já existe em `normalize`)
- colapsar espaços
- remover pontuação supérflua
- **lema singular** simples para pt-PT: regras finais (`ões→ão`, `ães→ão`, `is→l`, `ns→m`, e por último `s$` quando o termo tem ≥4 caracteres e não termina em `ês`/`ós`/`às`)
- chave única = forma canónica; duplicados eliminados mantendo a melhor confiança/peso

### 2. Análise estatística inter-especialidades (novo passo no início do run)

No arranque de `processRun`, antes do ciclo por artigo, construir **uma só vez** um índice global:

```text
termoCanonico → Map<especialidade_id, { artigos: Set<id>, ocorrencias: number }>
```

Fontes alimentadoras:
- `biblioteca_artigo_conhecimento` (tipos positivos) agrupado por especialidade do artigo
- `biblioteca_artigos.descricao` tokenizada
- `classificacao_artigos.descricao_original` (validados/auto) agrupados pela especialidade do `artigo_mestre_id`

Resultado: para cada termo conseguimos calcular `dominanciaEspecialidade(termo, espId) = artigosNaEsp / artigosTotaisDaEsp` e identificar a **especialidade dominante**.

### 3. Geração de negativos passa a ser determinística (não vem da IA)

A IA continua a gerar `palavras_chave`, `sinonimos`, `expressoes`, `materiais`. **`termos_negativos` deixa de ser pedido à IA** — passa a ser calculado por `derivarNegativos(artigo, indiceGlobal)`:

Para cada termo do índice global, é negativo do artigo X se:
- `dominanciaEspecialidade(termo, espDoArtigo) < 0.02` (praticamente ausente)
- `max(dominanciaEspecialidade(termo, outraEsp)) ≥ 0.40` (dominante noutra)
- não pertence ao vocabulário positivo do artigo nem dos seus vizinhos
- não é stopword nem token genérico (`fornecimento`, `aplicacao`, etc.)

Cada negativo carrega `justificacao` automática:
`"Predominante em Eletricidade (87% dos artigos) e ausente em Demolições Estruturais."`
`origem = "artigos_vizinhos"` ou nova etiqueta `"estatistica"` (reutilizo `artigos_vizinhos` para não tocar no enum).

### 4. Validação cruzada antes de gravar (novo `resolverConflitos`)

Logo antes do `persistir`:
1. Construir `Set<canonical>` de todos os positivos (palavras-chave + sinónimos + expressões + materiais).
2. Filtrar `termos_negativos` removendo qualquer termo cuja forma canónica esteja no Set positivo.
3. Eliminar duplicados intra-lista pela forma canónica.
4. Eliminar negativos que pertençam ao vocabulário dominante do artigo (top-tokens da descrição do artigo + termos com `ocorrencias > 0` no histórico próprio).
5. Registar no log do run quantos foram filtrados e porquê.

### 5. Persistir frequência real

O `ocorrencias` gravado passa a usar o índice global (nº de artigos onde o termo aparece) em vez de só contar dentro do histórico do próprio artigo, e `justificacao` ganha texto curto do tipo:
`"Aprendido em 34 MQ · 112 artigos · dominante em Demolições Estruturais (95%)."`

### 6. UI — explicabilidade

Em `src/components/biblioteca-mestra/ArtigoConhecimentoTab.tsx`:
- Mostrar `termo (N)` onde N = `ocorrencias`.
- Tooltip/segunda linha com `justificacao` quando existir.
- Badge "negativo" ganha um ícone de info ligado à `justificacao` que explica em que especialidade é dominante.

Sem alterações na tabela.

## Detalhes técnicos

- Mantém-se o `callAI`, mas o prompt deixa de pedir `termos_negativos` (e passa a impor: "**não devolvas termos negativos — são derivados estatisticamente pelo sistema**"). Reduz tokens e elimina a fonte do conflito.
- `normalizarGenerated` é estendida para usar a nova `canonicalizar` e devolver `Set<canonical>` para passar a `resolverConflitos`.
- O índice global é construído com `service_role` no início do run. Custo: 1× scan de `biblioteca_artigo_conhecimento` + 1× scan de `classificacao_artigos` filtrado por estados validado/auto. Em memória do run.
- Para runs com âmbito "artigo" único, ainda assim construímos o índice (pequeno overhead, mas é o que sustenta os negativos).
- Sem mudanças no schema; sem migrações.

## Fora de âmbito

- Não se altera o engine de classificação (`src/lib/classificacao/engine.ts`).
- Não se mexe na tabela `biblioteca_artigo_conhecimento` nem nos seus enums.
- Não se eliminam automaticamente os negativos contraditórios já gravados; o utilizador pode correr **"Regenerar tudo (apenas IA)"** depois do deploy para limpar.
