## Fase 2 — Redesenho (plano aprovado, com ajustes)

### Princípios não-negociáveis

1. O MQT do Dono de Obra é **imutável**: `codigo`, `descricao`, `unidade`, `quantidade`, `notas` nunca podem ser alterados depois de lidos. Qualquer normalização (ex.: unidade normalizada para o motor) vive em **colunas paralelas** (`unidade_normalizada`, etc.), nunca por cima do original.
2. A Fase 2 **nunca pede upload** de MQ nem cria nova obra — tudo vem da Gestão Documental.
3. O **Orçamento Final** ao Dono de Obra **só existe depois** de receção, comparação e adjudicação das propostas. Antes disso só há um **rascunho técnico interno** (MQ classificado + pacotes), nunca apresentado como "orçamento" ao cliente.
4. A divisão em pacotes de consulta **não depende só da Subespecialidade**: usa um campo obrigatório **`pacote_tipo`** na Biblioteca Mestra (com regras complementares), porque um pacote pode agregar várias subespecialidades (ex.: "Estruturas" = Cofragens + Armaduras + Betão).
5. Toda a correção manual (classificação ou movimentação entre pacotes) **alimenta `classificacao_aprendizagem`**.
6. Tudo passa pela Biblioteca Mestra; toda a adjudicação realimenta o Histórico de Preços.

### Renomeação dos separadores da obra

`src/components/obras/ObraLayout.tsx`

| Antes | Depois |
|---|---|
| Mapa de Quantidades · Orçamentação · Procurement | **Preparação de Orçamento** · Procurement · **Orçamento Final** (inativo até existirem adjudicações) |

"Mapa de Quantidades" deixa de ser separador autónomo — passa a ser o passo 1 do wizard de Preparação. "Orçamento Final" só fica ativo quando ≥1 pacote estiver adjudicado.

### Fluxo global

```text
Documentação da Obra (Gestão Documental)
        │
        ▼
[Separador: Preparação de Orçamento]   ← entrega 1
   Passo 0 · Checklist da documentação disponível
   Passo 1 · Selecionar MQT (revisão A/B/Final) — sem upload
   Passo 2 · Leitura IA da estrutura do MQT (imutável)
   Passo 3 · Classificação IA contra a Biblioteca Mestra (% confiança)
   Passo 4 · Validação manual + aprendizagem
        │
        ▼
[Separador: Procurement]               ← entrega 2
   Passo 5 · Divisão automática em Pacotes (via pacote_tipo)
   Envio aos subempreiteiros · estado dos pedidos
        │
        ▼
   Receção e Comparação de propostas   ← entrega 3
   Adjudicação por linha/pacote → Histórico de Preços
        │
        ▼
[Separador: Orçamento Final]           ← entrega 4
   custos diretos adjudicados + materiais/MO próprios
   + indiretos + estaleiro + risco + margem
```

## Entrega 1 — Wizard "Preparação de Orçamento" (foco desta primeira fase)

Rota única `obras/$id/preparacao-orcamento` (substitui o atual `obras/$id/orcamentacao`; rota antiga redireciona). Passos no URL via `?step=0..4`.

**Passo 0 — Documentação disponível**
- Lê `documento_pastas` + `documentos` da obra; mostra ✓/✗ para Arquitetura, Estruturas, Especialidades, Caderno de Encargos, Mapa de Quantidades, Memória Descritiva, Peças Desenhadas.
- Botão único: **"Iniciar Preparação do Orçamento"**.

**Passo 1 — Selecionar MQT**
- Lista os ficheiros classificados como MQ na Gestão Documental (Rev A, Rev B, Final…).
- Sem upload. Permite mudar de versão mais tarde, mantendo histórico de classificações.

**Passo 2 — Leitura IA do MQT**
- Extrai capítulos, subcapítulos, artigos, descrições, unidades, quantidades, notas.
- Grava **integralmente** o texto original em colunas imutáveis. Qualquer dado derivado (unidade normalizada, tokens, etc.) vai para colunas paralelas.
- Pré-visualização em árvore (capítulo → artigo).

**Passo 3 — Classificação IA**
- Reusa `runClassificacao` contra a Biblioteca Mestra: Especialidade · Subespecialidade · Categoria · Artigo Mestre · Sistema Construtivo · Unidade normalizada · % Confiança.
- Linhas abaixo do limiar entram em "Necessitam validação".

**Passo 4 — Validação**
- Resumo: Analisados / Auto-classificados / A validar / Conflitos / Sem classificação.
- Tabela filtrável para corrigir. **Cada correção grava em `classificacao_aprendizagem`** (já existe).
- Conclui o rascunho técnico interno. Não cria orçamento, não cria pacotes ainda — fim da entrega 1.

### Detalhe técnico da entrega 1

Novos / alterados:
- `src/components/obras/ObraLayout.tsx` — renomeia separadores; remove "Mapa de Quantidades"; "Orçamento Final" como `soon` por agora.
- `src/routes/_app/obras.$id.preparacao-orcamento.tsx` — novo wizard.
- `src/components/preparacao-orcamento/` — `Passo0Documentacao.tsx`, `Passo1SelecionarMQ.tsx`, `Passo2LeituraMQ.tsx`, `Passo3Classificacao.tsx`, `Passo4Validacao.tsx`.
- `src/lib/preparacao-orcamento/*.functions.ts` — `getDocumentacaoChecklist`, `listMQsDaObra`, `iniciarLeituraMQ`, `getResumoClassificacao`, `marcarRascunhoConcluido`.
- `src/routes/_app/obras.$id.mq.tsx` — redireciona para o novo wizard (mantém para não partir links).
- `src/routes/_app/obras.$id.orcamentacao.tsx` — redireciona idem.

Migração mínima desta entrega (apenas o necessário):
- `ALTER TABLE orcamentos ADD COLUMN mq_documento_id uuid REFERENCES documentos(id);`
- `ALTER TABLE orcamentos ADD COLUMN mq_revisao text;`
- `ALTER TABLE orcamentos ADD COLUMN wizard_passo smallint NOT NULL DEFAULT 0;`
- `ALTER TABLE orcamentos ADD COLUMN tipo text NOT NULL DEFAULT 'rascunho_tecnico';` — distingue rascunho interno do futuro orçamento final ao cliente.
- `ALTER TABLE orcamento_artigos ADD COLUMN unidade_normalizada text;` (a unidade original em `unidade` permanece intocada).

A imutabilidade do MQ é reforçada por **trigger**: `BEFORE UPDATE ON orcamento_artigos` impede alterações a `codigo`, `descricao`, `unidade`, `quantidade`, `notas` quando o orçamento tem `tipo = 'rascunho_tecnico'` (libertado só na compilação do Orçamento Final, e mesmo aí estas colunas não são tocadas — a edição passa por novas linhas próprias).

## Entrega 2 — Divisão em Pacotes + Procurement na obra (futura)

- Migração: `ALTER TABLE biblioteca_subespecialidades ADD COLUMN pacote_tipo text;` + nova tabela `biblioteca_pacote_tipos` (slug, nome, ordem) e tabela ponte `biblioteca_pacote_tipo_regras` (regras adicionais por Artigo Mestre / Categoria / palavras-chave, para casos em que a subespecialidade sozinha não chega).
- A divisão automática usa, por ordem: (1) regra explícita por Artigo Mestre, (2) `pacote_tipo` da Subespecialidade, (3) fallback heurístico marcado como "a validar".
- Utilizador pode mover artigos entre pacotes → grava em `classificacao_aprendizagem` com `tipo = 'movimentacao_pacote'`.
- `obras/$id/procurement` deixa de ser link externo; passa a listar pacotes da obra com estados.

## Entrega 3 — Receção e Comparação de Propostas (futura)

- Novas tabelas `procurement_propostas` e `procurement_proposta_linhas`.
- Template Excel por pacote (com `pacote_artigo_id` oculto) para preenchimento pelo subempreiteiro.
- Tabela de comparação com alertas IA: omissões, unidade diferente, quantidade diferente, outliers alto/baixo, desvio vs Histórico de Preços.
- Adjudicação por linha/pacote.

## Entrega 4 — Orçamento Final + Histórico de Preços (futura)

- Nova tabela `biblioteca_artigo_preco_historico` alimentada na adjudicação.
- Separador `obras/$id/orcamento-final` (novo `tipo='orcamento_cliente'` em `orcamentos`).
- Composição automática: custos diretos adjudicados + materiais/MO próprios + indiretos + estaleiro + risco + margem.
- Cada linha mantém ligação ao Artigo Mestre e à proposta de origem; a descrição apresentada ao Dono de Obra é a do MQT original.

## Aprendizagem contínua (pontos de escrita)

Já nesta entrega 1:
- Correção de Especialidade / Subespecialidade / Categoria / Artigo Mestre / Sistema / Unidade → `classificacao_aprendizagem`.

Nas entregas seguintes:
- Movimentação de artigo entre pacotes → `classificacao_aprendizagem` (sinal forte).
- Adjudicação → `biblioteca_artigo_preco_historico`.

## O que muda já agora para o utilizador (entrega 1)

- Entra na obra → vê **"Preparação de Orçamento"** (já não "Orçamentação").
- Vê de imediato o checklist da documentação da obra.
- Carrega num único botão → escolhe a revisão do MQT que quer trabalhar (sem upload).
- A IA lê e classifica; ele só valida o que está incerto.
- No fim, fica um **rascunho técnico interno** pronto — nenhuma promessa de "orçamento" enquanto não houver propostas dos subempreiteiros.

Confirmas que arrancamos pela entrega 1 com este âmbito?
