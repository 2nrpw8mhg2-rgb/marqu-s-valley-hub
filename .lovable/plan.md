# Fase 2.2 — Motor de Classificação por Palavras‑chave

Estender o motor atual (`src/lib/classificacao/engine.ts`) para uma classificação **hierárquica, ponderada, auditável e reprocessável** a partir das palavras‑chave da Biblioteca Mestra. Sem IA semântica.

## 1. Normalização do texto

Nova função `normalizar()` melhorada:

- minúsculas + remoção de acentos (já existe)
- substituição de abreviaturas comuns: `p/ → para`, `c/ → com`, `s/ → sem`, `nº → numero`, `m2 → m2`, `m3 → m3`, `ø → diametro`, `betão → betao`, `arm → armado`
- remoção de pontuação (`.,;:()[]{}/\|"'`)
- colapso de espaços
- remoção de stopwords curtas/irrelevantes (`de, da, do, em, e, para, com, ou, a, o, os, as`)

Aplicada à descrição original e a todos os termos vindos da biblioteca antes de comparar.

## 2. Algoritmo de pontuação

Substituir o ranking atual (apenas keywords de artigo + overlap de tokens) por **scoring hierárquico**:

| Nível | Peso base | Origem |
|---|---|---|
| Especialidade | 20 | `biblioteca_especialidade_keywords` |
| Subespecialidade | 30 | `biblioteca_subespecialidade_keywords` |
| Categoria | 40 | (das próprias keywords dos artigos da categoria) |
| Artigo Mestre | 60 | `biblioteca_artigo_keywords` |
| Negativa | −80 | qualquer nível com `tipo='negativa'` |

Cada match multiplica o peso base pelo `peso` (numeric) da linha de keyword (default 1.0).

Para cada artigo do MQ:
1. Identifica todas as keywords presentes (match por token exato ou substring de palavra).
2. Acumula score por **artigo mestre candidato**, herdando os pontos das suas subesp/esp.
3. Keywords negativas associadas ao candidato (ou à sua hierarquia) subtraem.
4. Mantém lista das `keywords_hit` com `{termo, nivel, entidade_id, entidade_nome, peso, pontos}`.

Estado final pelo top‑candidato:
- score ≥ 90 → `classificado_auto`
- 70–89 → `necessita_revisao`
- < 70 → `sem_classificacao`

`confianca` = `min(100, round(score))`. `metodo_match` = `keyword_artigo` (mantém o enum existente; `keyword_esp`/`keyword_subesp` ficam para quando só há match a esses níveis).

A regra **aprendido > exato > keywords** mantém‑se.

## 3. Persistência — `classificacao_artigos.candidatos`

Reaproveitar a coluna `candidatos jsonb` (já existe) para guardar até 3 candidatos com:
```json
{
  "artigo_mestre_id": "...",
  "descricao": "...",
  "score": 95,
  "motivo": "Encontradas keywords: cofragem, pilares, betão armado",
  "keywords_hit": [
    {"termo":"cofragem","nivel":"subespecialidade","entidade":"Cofragens","peso":1,"pontos":30},
    {"termo":"pilares","nivel":"categoria","entidade":"Cofragens Verticais","peso":1,"pontos":40},
    {"termo":"betão armado","nivel":"especialidade","entidade":"Estruturas","peso":1,"pontos":20}
  ],
  "negativas": []
}
```

`motivo` (string) passa a ser auto‑gerado: `"Classificado por palavras-chave: cofragem, pilares, betão armado"`.

## 4. UI — Centro de Classificação (`src/routes/_app/motor-classificacao.tsx`) e Revisão na Obra

- **Coluna "Motivo da classificação"**: trocar a célula `Porquê?` (atualmente um Popover curto) por texto resumo (`motivo`) + botão `Detalhes`.
- **Dialog de detalhe da classificação** (novo `ClassificacaoDetailDialog.tsx`): tabela com palavras encontradas, entidade, nível, peso, pontos; secção separada para negativas aplicadas; total e estado final.
- **Botão "Reprocessar classificação"** no header da página e na tab MQ da obra: chama `runClassificacao(orcamentoId)` preservando linhas `validado` (já é o comportamento atual).

## 5. Aprendizagem supervisionada

Quando o utilizador valida/corrige uma classificação (`validar`, `atribuir` e `remover` em `motor-classificacao.tsx` e em `RevisaoArtigos`), registar em `classificacao_aprendizagem`:

```ts
{
  user_id,
  descricao_original,
  descricao_normalizada,
  especialidade_sugerida: <nome da esp do top candidato>,
  especialidade_final: <nome da esp atribuída>,
  confianca_sugerida: <score do top candidato>,
  obra_id,
  acao: 'validar' | 'corrigir' | 'remover',
}
```

Esta tabela já existe — só é preciso passar a inserir. A `classificacao_memoria` continua a alimentar o método `aprendido`.

## 6. Configuração dos pesos (preparado para futuro)

Centralizar pesos numa constante exportada em `engine.ts`:

```ts
export const PESOS_CLASSIFICACAO = { ESP: 20, SUBESP: 30, CAT: 40, ART: 60, NEGATIVA: -80, LIMIAR_AUTO: 90, LIMIAR_REVER: 70 };
```

Sem ecrã de configuração nesta fase.

## 7. Fora de âmbito (próximas fases)

- IA semântica / embeddings
- Ecrã de gestão de pesos
- Regras (`biblioteca_subespecialidade_regras`) — só leitura, não consumidas ainda
- Dashboard de aprendizagem

## Ficheiros tocados

- `src/lib/classificacao/engine.ts` — nova normalização, scoring hierárquico, motivos auto‑gerados, registo de `classificacao_aprendizagem`
- `src/routes/_app/motor-classificacao.tsx` — coluna Motivo, botão Reprocessar, integração com novo dialog
- `src/components/classificacao/ClassificacaoDetailDialog.tsx` *(novo)* — detalhe palavras/pontos
- `src/components/obras/RevisaoArtigos.tsx` — mesma coluna + dialog + reprocessar (se aplicável)

Sem migrações novas — todas as tabelas e colunas necessárias já existem.
