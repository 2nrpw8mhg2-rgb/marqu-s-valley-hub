# Classificador Inteligente de Pacotes de Consulta

Refatoração completa do sistema de classificação para suportar análise contextual, scoring multi-pacote, aprendizagem global e auditoria automática.

## 1. Base de dados (1 migration)

**Tabela nova `classificacao_aprendizagem`** (global, partilhada entre obras):
- descricao_original (texto)
- descricao_normalizada (texto, indexado — minúsculas, sem acentos, sem números soltos)
- codigo_artigo
- capitulo, subcapitulo
- especialidade_sugerida (o que o motor sugeriu)
- especialidade_final (o que o utilizador escolheu)
- confianca_sugerida (0–1)
- obra_id, user_id, acao (move/add/remove/change)
- created_at
- RLS: leitura por qualquer autenticado (aprendizagem é global); escrita só do próprio user_id

**Tabela nova `classificacao_cache`**:
- hash (sha256 da descrição+capítulo+vizinhos) — PK
- resultado_json (scores por pacote + justificação)
- modelo (regras / ia) + created_at
- Evita pagar IA várias vezes pelo mesmo artigo

**Coluna nova em `procurement_pacote_artigos`**:
- confianca (numeric)
- motivo (texto)
- sinalizado_revisao (bool) — para auditoria

## 2. Motor de classificação (`src/lib/procurement/classifier.ts`)

Novo módulo orquestrador (mantém `especialidades.ts` como camada de regras):

**Pipeline para cada artigo**:
1. **Aprendizagem** — procura na `classificacao_aprendizagem` por descrição normalizada igual ou muito semelhante (similaridade Jaccard sobre tokens). Se houver ≥3 ocorrências consistentes da mesma especialidade → confiança 0.98, motivo "aprendido com X correções".
2. **Contexto estrutural** — usa código do capítulo + nome (ex.: cap. 12 → cobertura; cap. 3 → demolições; cap. 4.2 → terraplanagens). Bloqueia automaticamente pacotes incompatíveis.
3. **Scoring multi-pacote** — corre regex existentes mas devolve `Map<Especialidade, score 0–100>` em vez de só um vencedor. Aplica pesos:
   - palavra-chave forte no início da descrição: +30
   - palavra-chave no capítulo: +25
   - vizinhos imediatos (mesmo subcapítulo) com a mesma classificação: +15
   - exclusões duras (ex.: "tela em fundações" para Cobertura): -100
4. **Confiança híbrida** — se top1 < 0.85 OU top1−top2 < 0.10 (ambíguo): chama IA.
5. **IA (Gemini via Lovable AI Gateway)** — server function que recebe descrição + capítulo + 2 vizinhos anteriores + 2 seguintes + lista de pacotes disponíveis. Devolve JSON estruturado com score por pacote + justificação curta. Cache por hash.
6. **Resultado final**: especialidade, confiança, motivo, scores_alternativos[].

## 3. Auditoria pós-geração

Quando se cria um pacote, depois de inserir os artigos, corre uma segunda passagem:

**Para cada artigo no pacote**: re-pergunta "este artigo pertence a esta especialidade?" Se confiança < 0.7 → marca `sinalizado_revisao=true`.

**Para cada artigo NÃO no pacote (no orçamento)**: corre classificador; se top1 == especialidade do pacote E confiança ≥ 0.85 → adiciona à lista de "artigos sugeridos em falta" mostrada na UI.

## 4. UI

**Em `procurement.pacotes.$id.tsx`**:
- Badge de confiança ao lado de cada artigo (verde ≥85%, amarelo 70–85%, vermelho <70%)
- Tooltip mostra o motivo + scores alternativos
- Botão **"Reanalisar pacote"** no topo — corre auditoria, mostra:
  - artigos sinalizados para revisão (com sugestão de pacote alternativo)
  - artigos em falta sugeridos (com botão "adicionar")
- Quando utilizador move/remove/adiciona artigo → grava em `classificacao_aprendizagem`

**Em `procurement.pacotes.tsx`** (criação):
- Usa novo motor em vez do filtro simples por capítulo
- Mostra contagem prevista por especialidade com confiança média

## 5. Servidor

Server functions novas (`src/lib/procurement/classifier.functions.ts`):
- `reanalisarPacote({ pacoteId })` → corre auditoria, devolve sinalizados + sugestões
- `classificarLote({ artigos, obraId })` → corre pipeline com IA quando preciso, usa cache
- `registarCorrecao({ artigo, especialidadeAnterior, especialidadeFinal, acao })` → grava em `classificacao_aprendizagem`

## Detalhes técnicos

- IA: `google/gemini-2.5-flash` via `https://ai.gateway.lovable.dev/v1/chat/completions`, JSON mode, prompt em PT-PT
- Normalização: `descricao.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/\d+/g,' ').replace(/\s+/g,' ').trim()`
- Cache: `crypto.createHash('sha256').update(desc+chap+vizinhos).digest('hex')`
- Similaridade: Jaccard sobre tokens com stopwords PT removidas

## Ordem de execução

1. Migration (tabelas + colunas)
2. Server functions + cliente IA
3. Refactor `classifier.ts` orquestrador
4. UI: badges, botão reanalisar, painel auditoria
5. Hooks de aprendizagem em todas as ações (move/add/remove)

Sem alterações à formatação do Excel nem aos pacotes especiais já existentes (Betão continua com `isBetaoArtigo`, mas agora também passa pela auditoria).
