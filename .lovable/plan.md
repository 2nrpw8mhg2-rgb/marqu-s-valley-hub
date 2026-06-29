## Problema

Mesmo com a derivação determinística, termos como "teste" e "integração" estão a aparecer como negativos em todos os artigos. A causa é tripla:

1. **Fonte demasiado permissiva.** O índice global é alimentado pelos tokens das próprias `biblioteca_artigos.descricao` de TODAS as especialidades. Descrições contêm verbos/substantivos genéricos ("teste de estanquidade", "integração de sistemas", "ensaio", "ligação") que aparecem só numa especialidade pequena (ex.: instalações) e ficam "dominantes" — pelo critério atual, viram negativos para todas as outras.
2. **Falta de suporte absoluto.** Basta `dom ≥ 40 %` numa especialidade com 3 artigos (2 artigos a conter o termo = 66 %) para o termo ser elegível, mesmo aparecendo só duas vezes na base inteira. Não há limiar mínimo de artigos absolutos nem de exclusividade ("aparece sobretudo aqui").
3. **Lista de termos genéricos curta.** A `STOPWORDS` cobre conectores mas deixa passar dezenas de verbos/substantivos de obra (teste, ensaio, integração, ligação, montagem, fixação, remoção, transporte, limpeza, controlo, verificação, manutenção, etc.) que nunca devem ser negativos de ninguém porque são vocabulário genérico de construção.

## Objetivo

Garantir que **só termos especificamente discriminantes** entre especialidades possam virar negativos, com base estatística forte, e nunca verbos/substantivos genéricos de construção civil.

## O que muda

Tudo concentrado em `src/lib/biblioteca-mestra/knowledge-builder.server.ts`. Sem migrações, sem alterações de UI nem de schema.

### 1. Fonte do índice mais limpa

`construirIndiceGlobal` deixa de tokenizar `biblioteca_artigos.descricao`. O índice global passa a ser construído **apenas** a partir de:
- `biblioteca_artigo_conhecimento` (positivos: palavra_chave, sinonimo, expressao, material) — já curado.
- `classificacao_artigos.descricao` e `descricao_original` em estado `validado` ou `auto` — tokenizado, mas atribuído à especialidade do `artigo_mestre_id` resolvido.

Resultado: o índice mede o que realmente caracteriza uma especialidade no histórico real, não o vocabulário ruidoso das descrições mestras (que misturam verbos genéricos e técnica).

### 2. Lista alargada de termos genéricos de obra (`GENERICOS_OBRA`)

Novo `Set` carregado em conjunto com `STOPWORDS` e aplicado em `derivarNegativos` (e também em `addToIdx` para nem entrar no índice). Inclui, entre outros:

```
fornecimento, aplicacao, execucao, instalacao, montagem, desmontagem,
remocao, demolicao, transporte, carga, descarga, limpeza, ensaio, teste,
verificacao, controlo, manutencao, reparacao, substituicao, ligacao,
integracao, acabamento, preparacao, regularizacao, nivelamento,
protecao, isolamento, vedacao, fixacao, alinhamento, assentamento,
implantacao, marcacao, medicao, gestao, coordenacao, supervisao,
seguranca, qualidade, conformidade, norma, especificacao, projeto,
desenho, peca, item, artigo, trabalho, servico, obra, estaleiro,
material, equipamento, ferramenta, mao, obra, dia, hora, unidade,
metro, metros, quilo, tonelada, conjunto, kit, sistema, componente
```

(Já normalizados sem acentos para casar com a forma canónica.)

### 3. Critérios estatísticos mais exigentes em `derivarNegativos`

Substituir o gate atual (`presencaThis ≤ 2 %` + `dom ≥ 40 %`) por uma combinação simultânea:

- **Suporte absoluto mínimo:** termo tem de aparecer em **≥ 4 artigos** da especialidade dominante (não só percentagem).
- **Exclusividade:** ≥ **70 %** das ocorrências totais do termo em todas as especialidades estão concentradas na dominante (`artigosNaDom / somaArtigosTodasEsp ≥ 0.70`).
- **Dominância relativa:** mantém `dom ≥ 0.50` (subido de 0.40) na especialidade dominante.
- **Ausência aqui:** `presencaThis ≤ 1 %` e `thisEspSet.size ≤ 1` em absoluto.
- **Total mínimo do índice:** termo aparece em ≥ 5 artigos somando todas as especialidades. Abaixo disso é ruído.
- **Filtros de natureza:** rejeitar se `GENERICOS_OBRA` contém o termo, se contém dígitos, ou se tem menos de 5 caracteres.

Limite final mantém-se em 12 negativos por artigo, ordenados por exclusividade × dominância.

### 4. Justificação mais informativa

`justificacao` passa a indicar suporte absoluto e exclusividade:

```
"Específico de Instalações Elétricas (12 de 14 ocorrências, 86 %) e ausente neste artigo."
```

### 5. Limpeza de negativos antigos contraditórios/genéricos

Adicionar passo no início de cada `processRun` (independente do modo escolhido): apagar de `biblioteca_artigo_conhecimento` os registos `tipo = 'termo_negativo'` cujo `canonicalizar(termo)` esteja em `GENERICOS_OBRA` ou `STOPWORDS`, registando no log do run quantos foram removidos. Garante limpeza imediata sem o utilizador ter de saber qual modo usar.

## Detalhes técnicos

- A tokenização de `classificacao_artigos.descricao` continua a usar `tokenize`/`lemaSingular`, mas qualquer token cuja forma canónica caia em `STOPWORDS ∪ GENERICOS_OBRA` é descartado em `addToIdx` (atalho antes de criar entradas no `Map`).
- O cálculo de "soma de ocorrências em todas especialidades" reaproveita o próprio `Map<espId, Set<artigoId>>` somando os `size` — sem custo extra de I/O.
- A limpeza inicial usa `service_role` (já temos `admin()`), `delete` filtrado por `tipo = 'termo_negativo'` e `termo ilike any(...)`. Lista materializada em JS a partir de `GENERICOS_OBRA`.
- O prompt da IA não precisa de mudar (já está proibido gerar negativos).

## Fora de âmbito

- Não se altera o engine de classificação.
- Não se mexe na UI (`ArtigoConhecimentoTab`, `KnowledgeRunReport`).
- Não se altera schema nem RLS.