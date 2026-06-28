## Diagnóstico (confirmado)

Investiguei o motor (`src/lib/classificacao/engine.ts`) e o estado real da base de dados para o orçamento atual:

- `biblioteca_artigo_keywords`: **0 registos** (não há sinais ao nível do artigo)
- `biblioteca_subespecialidade_keywords`: 167
- `biblioteca_especialidade_keywords`: 583
- `biblioteca_artigos` ativos: 1.673

O algoritmo só pontua por keywords de especialidade/subespecialidade e depois **herda essa pontuação para todos os artigos mestres dessa subespecialidade/especialidade**. Com isto, descrições como "betão" tornam ~todos os artigos da especialidade candidatos com o mesmo score; o "vencedor" é arbitrário (ordem de inserção do Map). Daí casos reais observados:

```
"Demolição de laje de betão…"       → "Separação de betão"        (50%)
"Aterro para base…"                 → "Ensaio Proctor"             (50%)
"Vedação provisória de terreno…"    → "Vedação em betão"           (50%)
"Betão armado C25/30…"              → "Cofragem de pilares"        (50%)
```

A descrição do artigo mestre **nunca é comparada** com a do artigo original, e a unidade é ignorada.

## Princípio orientador (conservador)

> Em caso de dúvida, o artigo vai para **`necessita_revisao`** ou **`sem_classificacao`** — nunca para `classificado_auto`.
>
> Keywords de especialidade/subespecialidade **nunca** classificam automaticamente por si só. Só servem para reforçar / desambiguar uma forte semelhança textual ao nível do artigo mestre.

## Alterações (apenas em `src/lib/classificacao/engine.ts`)

Sem alterações de schema, sem migrações, sem mexer na biblioteca.

### 1. Similaridade textual artigo↔artigo mestre passa a ser o sinal **obrigatório**

Para cada artigo mestre calcular tokens normalizados (reuso de `tokenize`) e:

```
overlap     = nº de tokens significativos partilhados
cobertura   = overlap / max(tokens_mestre, 1)
score_texto = round(cobertura * 100)            // 0–100
```

Bónus textuais (apenas relevantes se já há similaridade):
- bigrama/trigrama do mestre contido na descrição original: +15 / +25, máx **+40**
- token raro partilhado (presente em < 2 % dos mestres): +10 cada, máx **+20**

### 2. Candidato só existe se houver evidência textual ao nível do artigo

Um artigo mestre só entra na lista de candidatos se cumprir **uma** das condições:

- `score_texto ≥ 40`
- `score_texto ≥ 30` **E** unidade compatível
- tem **keyword de artigo** positiva que casa (caminho preservado para o futuro, quando `biblioteca_artigo_keywords` for povoada)

Keywords de especialidade/subespecialidade **deixam de criar candidatos por si só**. Acaba a herança de pontos para os 1.673 artigos da especialidade.

### 3. Compatibilidade de unidade

Normalização: lowercase, remover espaços, `²/³` → `2/3`, mapear sinónimos óbvios (`m³` ↔ `m3`, `un` ↔ `und` ↔ `unid`, `vg` ↔ `vg.`).

- Ambas presentes e compatíveis: **+15**
- Ambas presentes e claramente incompatíveis (`m3` vs `un`, `m2` vs `kg`, `vg` vs `m3`): **−25**
- Alguma ausente: 0 (neutro)

### 4. Score final

```
score_final = score_texto                       // dominante
            + bónus_ngrama       (≤ 40)
            + bónus_token_raro   (≤ 20)
            + esp_hit_cap        (≤ 10)         // só reforço; teto
            + subesp_hit_cap     (≤ 15)         // só reforço; teto
            + bónus/penalização_unidade
            + soma_keywords_negativas           (mantém −80)
            + 60 por keyword positiva de artigo (mantém)
```

ESP/SUBESP entram apenas como **reforço pequeno** (teto, não acumulação) e nunca tornam um candidato com `score_texto = 0` elegível.

### 5. Limiares mais conservadores

- `LIMIAR_AUTO` = **85** (era 90)
- `LIMIAR_REVER` = **60**
- Adicional para `classificado_auto`, **todas** estas condições têm de ser verdade:
  - `score_final ≥ 85`
  - `score_texto ≥ 50`
  - unidade não incompatível (compatível **ou** ausente — mas se a unidade do original existir e a do mestre existir, têm de bater certo)
  - margem `top1 − top2 ≥ 15` pontos
  - sem keywords negativas a disparar no top-1

Se qualquer uma falhar → desce para `necessita_revisao` (mantendo o top-1 como sugestão visível na sidebar) ou, se `score_final < 60`, para `sem_classificacao`.

### 6. Empates / margens curtas

- Se `top1 − top2 < 15` ou existirem ≥ 2 candidatos com score idêntico no top → força `necessita_revisao` mesmo que o score absoluto seja alto. A intenção é nunca decidir automaticamente em ambiguidade.

### 7. "Exato" e "Aprendido" — mais rigorosos

- **Exato** (`descricao_norm` idêntica): mantém `classificado_auto` apenas se houver **um único** match. Se houver vários, vai para `necessita_revisao` com todos como candidatos (já é o comportamento atual — preservar).
- **Aprendido** (`classificacao_memoria`): mantém-se `100/classificado_auto` porque foi validado pelo utilizador.

### 8. Motivo legível na sidebar "IA Explica"

Atualizar `motivo` e `keywords_hit` para refletir o sinal real:

> "Similaridade textual 78 % (tokens: betão, armado, c25/30) · unidade compatível (m³) · reforço subespecialidade: betão estrutural."

E adicionar aos `keywords_hit` um hit sintético `{ nivel: "artigo", termo: "<similaridade textual>", pontos: score_texto }` para a sidebar já existente mostrar visualmente o sinal dominante.

## Como o utilizador valida

1. Abrir o Centro de Classificação Inteligente do orçamento atual.
2. Clicar em **"Reclassificar"** (botão já existente, chama `runClassificacao`).
3. Esperar que:
   - associações claramente erradas como `"Demolição de laje de betão…" → "Separação de betão"` deixem de existir;
   - artigos sem mestre adequado fiquem em `sem_classificacao` em vez de associados arbitrariamente com 50 %;
   - número de `classificado_auto` desça e o de `necessita_revisao` / `sem_classificacao` suba — é o trade-off pretendido.

## Fora do âmbito

- Não vou popular `biblioteca_artigo_keywords` (já existe fluxo "Como Ensinar a IA" + `AddKeywordQuickDialog`).
- Sem embeddings / LLM scoring nesta fase.
- Sem alterações de schema, RLS, ou de outros módulos.

## Ficheiros tocados

- `src/lib/classificacao/engine.ts` (único ficheiro)
