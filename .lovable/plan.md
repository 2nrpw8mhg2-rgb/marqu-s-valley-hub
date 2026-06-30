# Biblioteca Mestra como Base de Conhecimento Estruturada

Transformar o atual campo único de "Termos Negativos" em seis secções distintas, cada uma com papel próprio no motor de classificação. Mantém-se a tabela existente `biblioteca_artigo_conhecimento` — apenas se acrescentam novos tipos.

## 1. Modelo de dados (migração)

Adicionar valores ao enum `biblioteca_conhecimento_tipo`:

- `negativo_concorrente` — termos da mesma especialidade/subespecialidade que distinguem artigos semelhantes (penalização média).
- `negativo_incompativel` — termos de outras especialidades (penalização forte / eliminação).
- `unidade_compativel` — códigos de unidades válidas para o artigo.
- `capitulo_tipico` — nomes/normalizações de capítulos onde o artigo costuma aparecer.
- `exemplo_real` — descrições reais validadas (fonte principal de aprendizagem).

O tipo legado `termo_negativo` mantém-se para retro-compatibilidade. Migração de dados: converter os atuais `termo_negativo` em `negativo_incompativel` quando o termo pertence a outra especialidade, caso contrário em `negativo_concorrente` (heurística baseada no `IndiceGlobal` já calculado pelo knowledge-builder).

Campo `peso` por defeito por tipo:
- positivos (palavra_chave/sinonimo/expressao/material): +10 a +40 (como hoje)
- negativo_concorrente: −15
- negativo_incompativel: −60
- unidade_compativel: 0 (gate, não pontua)
- capitulo_tipico: +5 (bónus contextual)
- exemplo_real: 0 (usado por similaridade textual)

## 2. Geração automática (knowledge-builder.server.ts)

Reestruturar a função `derivarNegativos` em três geradores:

- **`derivarNegativosConcorrentes(artigo, irmaos, historicoConfusoes)`** — usa os outros artigos da mesma subespecialidade + especialidade. Extrai tokens distintivos desses irmãos e do histórico de classificações em que o utilizador corrigiu para outro artigo da mesma área. Resultado típico: "manual", "rocha", "aterro" quando o artigo é "Escavação Mecânica".
- **`derivarNegativosIncompativeis(artigo, indiceGlobal)`** — mantém a lógica atual (≥90% exclusividade noutras especialidades) + blocklist `GENERICOS_OBRA` já existente. Resultado: "pintura", "azulejo", "AVAC".
- **`derivarUnidadesCompativeis(artigo, historico)`** — agrega `unidade` dos artigos classificados como este artigo mestre; mantém as com ≥5% de ocorrências.
- **`derivarCapitulosTipicos(artigo, historico)`** — agrega `capitulo.titulo` normalizado dos MQs em que o artigo aparece; top-5 por frequência.
- **`derivarExemplosReais(artigo, historico)`** — guarda até 50 descrições reais validadas (origem: `mapas_quantidades` ou `utilizador`), com deduplicação por `normalizar_descricao`.

A opção "Regenerar tudo (apenas IA)" passa a popular todas as secções; "Adicionar apenas novos" preserva edições manuais.

## 3. Motor de classificação (src/lib/classificacao/engine.ts)

Nova sequência de scoring por candidato:

```
1. Gate: capítulo do item ∈ capitulos_tipicos do artigo  → +bónus contextual
2. Gate: unidade do item ∈ unidades_compativeis           → senão −20
3. Penalização forte: cada negativo_incompativel presente → −60 (pode eliminar candidato se score < 0)
4. Similaridade textual com exemplos_reais (trigram/cosine) → 0..+40
5. Soma positivos (palavra_chave/sinonimo/expressao/material) → como hoje
6. Penalização de concorrência: cada negativo_concorrente presente → −15
7. Auto-classifica apenas se margem sobre 2º candidato ≥ X (configurável, default 15 pontos)
```

A função `pontuarCandidato` recebe agora os 6 conjuntos pré-carregados por artigo (lookup único por run). Manter os logs de auditoria por etapa para o painel de classificação.

## 4. Interface (ArtigoConhecimentoTab.tsx)

Substituir as abas atuais por 6 secções acordeão/tabs:

- ✅ Palavras-chave Positivas (agrega palavra_chave + sinonimo + expressao + material)
- ⚠️ Negativos Concorrentes
- 🚫 Negativos Incompatíveis
- 📏 Unidades Compatíveis (chips ligados à tabela `biblioteca_unidades`)
- 📂 Capítulos Típicos
- 📝 Exemplos Reais (lista; cada exemplo com link para o MQ de origem quando exista)

Cada secção tem:
- botão "Adicionar manualmente"
- botão "Enriquecer com IA" (chama o knowledge-builder restrito àquela secção)
- toggle ativo/inativo por item, edição inline, eliminação

Adaptar `KnowledgeRunReport.tsx` para mostrar contadores por secção (6 cartões em vez de 5).

## 5. Aprendizagem contínua

Quando o utilizador valida ou corrige uma classificação em `classificacao_artigos`:
- a descrição original é inserida automaticamente como `exemplo_real` no artigo mestre escolhido (se ainda não existir);
- se for uma correção dentro da mesma especialidade, os tokens distintivos do artigo errado vão para `negativo_concorrente` do artigo correto;
- se for correção entre especialidades diferentes, tokens do artigo errado vão para `negativo_incompativel`.

Implementado num trigger leve em pg ou, preferencialmente, num server function chamado após `aprovarClassificacao`/`corrigirClassificacao` (mais auditável).

## 6. Validação

- `tsgo` limpo após mudanças de tipo (atualizar `types.ts` da Biblioteca Mestra).
- Correr "Regenerar tudo (apenas IA)" numa subespecialidade e confirmar que cada artigo tem conteúdo nas 6 secções.
- Comparar 2 artigos parecidos (ex.: Escavação Manual vs Escavação Mecânica) e confirmar que os negativos_concorrentes são distintos e relevantes.
- Reclassificar um lote já existente e confirmar redução de falsos positivos.

## Sequência de implementação

1. Migração: novos valores de enum + conversão dos atuais negativos.
2. `knowledge-builder.server.ts`: novos geradores + integração no run.
3. `engine.ts`: nova sequência de scoring + carregamento dos 6 conjuntos.
4. UI: `ArtigoConhecimentoTab.tsx` com 6 secções + `KnowledgeRunReport.tsx`.
5. Hook de aprendizagem em validar/corrigir classificação.
6. Verificação manual com artigos reais.

Sem alterações a `client.ts`, `auth-middleware.ts` ou ao schema `auth`. Sem novos secrets.
