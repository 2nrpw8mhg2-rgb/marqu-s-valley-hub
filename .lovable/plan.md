
# Revisão profunda do Knowledge Builder

Mudança de filosofia: deixar de produzir listas curtas (≤8 por tipo) e passar a gerar enriquecimento profundo, com a IA a comportar-se como um engenheiro orçamentista sénior que cruza Artigo Mestre + Categoria + Subespecialidade + Especialidade + irmãos + mapas reais + histórico + correções + restante Biblioteca.

## 1. Remover limites artificiais

Em `src/lib/biblioteca-mestra/knowledge-builder.server.ts`:

- Substituir `TIPO_LIMIT = 8` por limites por tipo, mais generosos e usados apenas como guarda final, não como instrução à IA:
  - palavras_chave: 40 · sinonimos: 30 · expressoes: 30 · materiais: 25
- Em `callAI`/`norm()`: remover o `.slice(0, TIPO_LIMIT)` e passar a aceitar tudo o que vier; aplicar guarda só depois da validação de qualidade.
- Em `melhorarPalavrasChave`: remover `.slice(0, TIPO_LIMIT)` final; ordenar e cortar apenas pelo novo limite por tipo.
- Subir `MQ_TOP` (40 → 120), `CANDIDATOS_TOP` (60 → 150), `ORC_FETCH_PER_TOKEN` (80 → 200), `VIZINHOS_LIMIT` (15 → 40), `VIZINHO_EXEMPLOS` (5 → 12).
- `callAI`: `max_tokens` 4000 → 12000 e `response_format` mantém-se `json_object`.

## 2. Mais contexto entregue à IA (`recolherFontes` + `buildPrompt`)

Acrescentar fontes que hoje a IA nem vê:

- **Irmãos diretos da Categoria** (não só da Subespecialidade): nova query a `biblioteca_artigos` filtrando por `categoria_id`, devolver descrição + 5 exemplos reais cada.
- **Vocabulário reutilizado**: agregar os termos `palavra_chave/sinonimo/expressao/material` mais frequentes da própria Subespecialidade e Especialidade (top 50 cada) — guiam estilo e cobertura típica.
- **Correções do utilizador**: ler `classificacao_aprendizagem` por `codigo_artigo` (top 30) para mostrar à IA o que costuma confundir-se com este artigo.
- **Capítulos típicos pré-calculados**: já existe `derivarUnidadesCapitulosExemplos`; passar a executá-lo *antes* do prompt e injetar no contexto (unidades dominantes + 5 capítulos mais frequentes + 15 exemplos reais).
- **Unidade do Artigo Mestre** (campo `unidade`): sempre incluída como unidade dominante default quando não houver histórico.

Refazer `buildPrompt` com nova estrutura:

```
PERFIL: és um engenheiro orçamentista sénior português com décadas de
experiência. Vais enriquecer profundamente este Artigo Mestre cruzando
TODAS as fontes. Não restrinjas o número de termos — quanto mais
conhecimento útil e tecnicamente justificável, melhor.

ARTIGO MESTRE / CATEGORIA / SUBESPECIALIDADE / ESPECIALIDADE
HISTÓRICO REAL (até 120) / CANDIDATOS BRUTOS (até 150)
IRMÃOS DE CATEGORIA / IRMÃOS DE SUBESPECIALIDADE
VOCABULÁRIO REUTILIZADO NA SUBESPECIALIDADE / NA ESPECIALIDADE
CORREÇÕES DOS UTILIZADORES
UNIDADES, CAPÍTULOS E EXEMPLOS JÁ OBSERVADOS
```

Pedir explicitamente:
- Palavras-chave: gerar **todas** as palavras técnicas relevantes (sinais singulares/plurais, formas curtas e formas com adjetivo). Sem cota máxima; cota mínima 8 quando houver descrição suficiente.
- Sinónimos: cobrir terminologia portuguesa habitual (reboco/estuque/argamassa/revestimento/emboço/regularização…), sem cota.
- Expressões: extrair tudo o que seja frase técnica típica de MQ (2-6 palavras).
- Materiais: explícitos e implícitos (betão C25/30, aço A500, argamassa M5, EPS, XPS, lã mineral…).
- **Unidades**: nunca devolver vazio. Sugerir unidade dominante do artigo + todas as unidades plausíveis (m², m³, m, ml, un, kg, ton, vg, lote).
- **Capítulos**: nunca devolver vazio. Sugerir capítulo provável com base em Especialidade/Subespecialidade/Categoria.
- **Exemplos**: até 30 frases reais ou plausíveis ao estilo dos MQ portugueses.
- Manter regras pt-PT já existentes.

## 3. Fim dos negativos legacy

- Marcar `termo_negativo` como **deprecated** em `types.ts` (mantido só para leitura/migração; remover do array `CONHECIMENTO_TIPOS` para não aparecer na UI).
- Migração SQL: `UPDATE biblioteca_artigo_conhecimento SET ativo = false WHERE tipo = 'termo_negativo';` (não apagar, para auditoria).
- Remover toda a derivação heurística estatística (`derivarNegativos`, `IndiceGlobal`, `construirIndiceGlobal`, blocos de limpeza/validação correspondentes em `processRun`) — passa a existir apenas:
  - **`negativo_concorrente`**: já calculado em `derivarConcorrentes` (irmãos), ampliar limite (10 → 50) e baixar threshold (`count >= 2` → `count >= 1`).
  - **`negativo_incompativel`** (renomeado conceptualmente para "Especialidades Excluídas"): novo derivador `derivarIncompatibilidades` que percorre as restantes Especialidades e devolve termos técnicos centrais (palavras_chave/material já curados) que aparecem **só** noutras especialidades — sem o atual gate de 90% exclusividade, com confiança proporcional. Label na UI: "Especialidades Excluídas".
- `TIPO_MAP`: deixar de gerar `termos_negativos` via IA (já não o fazia); remover a entrada do mapa.

## 4. Dashboard reflete o enriquecimento

Em `src/routes/_app/biblioteca-mestra.knowledge-builder.tsx`:

- Substituir a grelha de 5 contadores por uma grelha de **8** com os tipos novos: Palavras-chave, Sinónimos, Expressões, Materiais, Unidades, Capítulos, Exemplos, Incompatibilidades + Concorrentes.
- Cada cartão mostra `antes → depois` (ex.: `6 → 28`) usando `counts` actual e snapshot prévio (já calculado em `processRun` → `perTipo[t].antes/depois`). Expor estes campos no estado `s.counts` actual.
- Remover o cartão "Negativos" antigo.

Em `KnowledgeRunReport.tsx`: mesma alteração — 8 secções e usar `perTipo` do resumo.

## 5. UI do Artigo (`ArtigoConhecimentoTab.tsx`)

- Remover secção "Termo negativo (legacy)".
- Renomear "Negativo incompatível" → "Especialidades Excluídas".
- Garantir que as 8 secções aparecem mesmo quando vazias (com botão "Enriquecer com IA" por secção, que continua a chamar o run global — esse já popula todas).

## 6. Validação

1. `tsgo` limpo.
2. Correr "Regenerar tudo (apenas IA)" numa subespecialidade pequena e confirmar:
   - palavras_chave ≥ 10, sinonimos ≥ 5, expressoes ≥ 5, materiais ≥ 3, unidades ≥ 1, capitulos ≥ 1, exemplos ≥ 1.
3. Confirmar que o dashboard mostra os 8 cartões com `antes → depois` e que a secção "Negativos" desapareceu.
4. Confirmar que nenhum termo `termo_negativo` ativo continua na base após a migração.

## Ficheiros tocados

- `supabase/migrations/<timestamp>_deprecate_termo_negativo.sql` (novo)
- `src/lib/biblioteca-mestra/knowledge-builder.server.ts` (limites, fontes, prompt, derivadores)
- `src/lib/biblioteca-mestra/types.ts` (remover `termo_negativo` da lista visível, renomear `negativo_incompativel` → "Especialidades Excluídas")
- `src/routes/_app/biblioteca-mestra.knowledge-builder.tsx` (grelha 8 com antes→depois)
- `src/components/biblioteca-mestra/KnowledgeRunReport.tsx` (8 secções)
- `src/components/biblioteca-mestra/ArtigoConhecimentoTab.tsx` (remover legacy, renomear)

Sem alterações a `client.ts`, `auth-middleware.ts`, schema `auth`. Sem novos secrets.
