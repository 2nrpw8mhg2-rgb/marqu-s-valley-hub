# Diferenciar termos negativos por Artigo Mestre

## Causa da repetição (resumo)

`derivarNegativos` em `src/lib/biblioteca-mestra/knowledge-builder.server.ts` (linhas 283–369) usa um índice global e devolve sempre os top 8 termos mais "exclusivos de outra especialidade". O ranking não depende do artigo — só remove o que já está nas listas positivas/contexto desse artigo. Por isso, todos os artigos da mesma especialidade recebem praticamente os mesmos negativos.

## Decisão

Manter o princípio: **negativos vêm sempre de outras especialidades** (nunca da mesma especialidade nem da subespecialidade vizinha). O que muda é **como se escolhem os negativos dentro desse pool**, para que cada Artigo Mestre receba um conjunto adaptado a si.

## Abordagem

Combinar duas fontes, mantendo o gate de confiança ≥90 %:

### 1. Negativos derivados de confundíveis reais (prioridade alta)

Para cada Artigo Mestre, consultar `classificacao_artigos` / `classificacao_aprendizagem`:
- procurar descrições reais que **a IA propôs para este artigo** mas que foram corrigidas para um artigo de **outra especialidade**;
- extrair os tokens dessas descrições rivais que **não aparecem em nenhum artigo da especialidade atual** (filtro inter-especialidade existente);
- ranquear por frequência de confusão real → estes são os verdadeiros falsos positivos deste artigo.

Resultado: dois artigos diferentes da mesma especialidade vão ter conjuntos diferentes, porque os erros históricos diferem.

### 2. Negativos por proximidade semântica (fallback / complemento)

Quando o histórico for insuficiente (< N classificações reais, ex.: N=5), usar o pool global atual mas **reordenar por proximidade ao artigo**:
- calcular sobreposição de tokens entre o termo candidato e:
  - a descrição do Artigo Mestre,
  - os seus positivos atuais (palavras-chave, sinónimos, materiais),
  - a descrição da subespecialidade;
- escolher preferencialmente termos de outras especialidades cujos vizinhos lexicais se assemelhem ao vocabulário deste artigo (típicos confundíveis), em vez dos mais exclusivos em absoluto.

### 3. Gates mantidos

- Termo nunca pode vir da mesma especialidade do artigo (filtro já existente).
- Termo nunca pode estar em positivos/contexto/histórico desse artigo.
- Confiança automática ≥90 %; abaixo disso, rejeitar em silêncio.
- Quota máxima continua em 8 negativos.

## Detalhes técnicos

Ficheiro a alterar: `src/lib/biblioteca-mestra/knowledge-builder.server.ts`

1. Adicionar uma nova função `derivarNegativosPorArtigo(artigoId, fontes, idx, historicoConfusoes)`:
   - assinatura semelhante a `derivarNegativos` mas recebe também o histórico de confusões;
   - implementa a lógica do ponto 1 acima.
2. Adaptar `derivarNegativos` para aceitar um vetor de "termos âncora" do artigo (descrição + positivos) e reordenar candidatos por proximidade semântica (ponto 2).
3. No pipeline principal (perto da linha 1518) substituir a chamada atual por:
   - se `historicoConfusoes.length >= 5` → usa a nova função;
   - senão → usa `derivarNegativos` melhorada com âncoras do artigo.
4. Pré-carregar uma vez por corrida um mapa `artigoId → confusões observadas` lendo `classificacao_artigos` (proposta vs. corrigida) filtrado para corrigida noutra especialidade.
5. Sem alterações de schema. Sem migrações.

## Modo de aplicação

A correr `Knowledge Builder` em modo **Regenerar tudo (apenas IA)**, os negativos atuais (origem IA) são apagados e regenerados com a nova lógica. Os negativos editados pelo utilizador são preservados.

## Validação após implementação

- Comparar dois artigos da mesma especialidade: confirmar que os negativos diferem.
- Confirmar que nenhum negativo pertence à mesma especialidade do artigo.
- Verificar logs: rejeições devem mencionar "não tem proximidade ao artigo" ou "ausente do histórico de confusões".
