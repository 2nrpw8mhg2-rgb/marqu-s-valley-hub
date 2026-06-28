
# Fase 3 — Motor de Relações Construtivas

Constrói a infraestrutura central do Motor de Relações Construtivas, com **Sistemas Construtivos como entidade dedicada** e **relações direcionais com inverso automático** entre artigos mestre. Coloca já o motor ao serviço da **validação técnica do Mapa de Quantidades** da obra, mas mantém o esquema preparado para ser reutilizado por Procurement, Planeamento, Histórico de Preços, Financeira e IA em fases seguintes.

## 1. Modelo de dados (migração única)

### 1.1 Sistemas Construtivos

```text
biblioteca_sistemas_construtivos
  id, codigo, nome, descricao,
  categoria_sistema   (cobertura | fachada | pavimento | estrutura | impermeabilizacao | redes | acabamentos | outros)
  observacoes, ativo, created_at, updated_at

biblioteca_sistema_artigos      -- composição do sistema
  id, sistema_id, artigo_id,
  papel              (principal | fixacao | isolamento | impermeabilizacao | acabamento
                      | acessorio | remate | drenagem | ventilacao | ensaio | outro)
  obrigatoriedade    (obrigatorio | muito_frequente | frequente | opcional | raro)
  ordem_execucao     int            -- sequência lógica dentro do sistema
  observacoes
  UNIQUE(sistema_id, artigo_id)
```

Um artigo pode pertencer a vários sistemas. Cada sistema conhece os seus membros, o seu papel, se é obrigatório ou opcional, e a ordem lógica de execução.

### 1.2 Relações entre artigos (grafo)

```text
biblioteca_artigo_relacoes
  id,
  artigo_origem_id,
  artigo_destino_id,
  tipo_relacao        (complementa | depende_de | antecede | substitui | incompativel | opcional)
  obrigatoriedade     (obrigatorio | muito_frequente | frequente | opcional | raro)
  confianca           numeric(3,2) default 1.00
  sistema_id          nullable      -- relação derivada de um sistema construtivo
  origem              (manual | sistema | ia | aprendizagem) default 'manual'
  observacoes,
  created_by, created_at, updated_at
  UNIQUE(artigo_origem_id, artigo_destino_id, tipo_relacao)
  CHECK(artigo_origem_id <> artigo_destino_id)
```

**Inverso automático via trigger**: ao inserir/atualizar/eliminar uma relação manual, o trigger `tg_relacao_inversa` mantém uma linha-espelho com `origem='sistema'` ou `origem='auto_inverso'` e tipo invertido:

```text
complementa     ↔ complementa
depende_de      ↔ requerido_por
antecede        ↔ precede
substitui       ↔ substituido_por
incompativel    ↔ incompativel
opcional        ↔ opcional_em
```

Adiciona-se ao enum `tipo_relacao` os inversos (`requerido_por`, `precede`, `substituido_por`, `opcional_em`) marcados como auto-gerados. UI só permite editar/criar as direções "canónicas"; as inversas são read-only.

### 1.3 Derivação a partir de Sistemas

Quando um `biblioteca_sistema_artigos` é criado/alterado, um trigger gera/atualiza relações `complementa` entre o artigo `principal` do sistema e cada outro membro, com `origem='sistema'`, `sistema_id` preenchido e a `obrigatoriedade` herdada do membro. Eliminar o membro remove a relação derivada.

Resultado: o utilizador define o **sistema** (ex.: ETICS = EPS + cola + rede + primário + acabamento) e o grafo de relações é alimentado automaticamente, sem perder a possibilidade de criar relações manuais avulsas.

### 1.4 Alertas técnicos no MQ

```text
orcamento_alertas_tecnicos
  id, orcamento_id, artigo_mq_id (orcamento_artigos),
  artigo_mestre_origem_id, artigo_mestre_esperado_id,
  sistema_id (nullable), tipo_relacao, obrigatoriedade,
  severidade        (critico | aviso | info)   -- derivada da obrigatoriedade
  estado            (aberto | aceite_omissao | justificado | ignorado | resolvido)
  justificacao text, resolvido_por uuid, resolvido_em timestamptz,
  created_at, updated_at
  UNIQUE(orcamento_id, artigo_mq_id, artigo_mestre_esperado_id, tipo_relacao)
```

Severidade: `obrigatorio`→`critico`, `muito_frequente`→`aviso`, restantes→`info` (ou suprimir `raro`/`opcional` da análise por defeito, com toggle).

## 2. Análise de omissões (motor)

Novo módulo `src/lib/relacoes/analise.ts`:

- `analisarOmissoes(orcamentoId)` corre após classificação (ou manualmente):
  1. Carrega artigos do MQ já com `artigo_mestre_id` (estado `classificado_auto` ou `validado`).
  2. Para cada artigo presente, expande o conjunto de **artigos esperados** via:
     - membros obrigatórios/muito_frequentes dos sistemas a que o artigo pertence;
     - relações `complementa` e `depende_de` com obrigatoriedade ≥ configurável.
  3. Compara com o conjunto presente; gera/atualiza linhas em `orcamento_alertas_tecnicos`.
  4. Preserva estado de alertas já fechados (`justificado`, `ignorado`, `aceite_omissao`) — só reabre se voltar a faltar e estado era `resolvido`.
- Reexecutável: botão "Reanalisar coerência técnica" no separador MQ da obra.
- Hook automático: chamar no fim de `runClassificacao` (Fase 2.2) quando o orçamento atinge `validado`/`em_classificacao`.

Constantes em `src/lib/relacoes/config.ts`:

```ts
export const RELACOES_CONFIG = {
  LIMIAR_ALERTA: ['obrigatorio', 'muito_frequente'], // estados que geram alerta por defeito
  INCLUIR_FREQUENTE: false,
  TIPOS_ANALISADOS: ['complementa', 'depende_de'],
};
```

## 3. UI — Biblioteca Mestra

### 3.1 Separador "Relações Construtivas" no Artigo Mestre

Novo separador no `ArtigoMestreFormDialog` (ou nova página dedicada `biblioteca-mestra.artigos.$id.tsx` se o dialog ficar denso). Conteúdo:

- Lista agrupada por tipo: Complementa / Depende de / Antecede / Substitui / Incompatível / Opcional.
- Cada linha: artigo destino (com especialidade/subespecialidade), obrigatoriedade, origem (badge: manual/sistema/auto), confiança, observações, ações editar/eliminar (apenas em relações manuais).
- Botão "Adicionar relação" → dialog com selector de artigo (com search), tipo, obrigatoriedade, observações.
- Secção separada "Sistemas Construtivos a que pertence" com link para cada sistema.

### 3.2 Nova página "Sistemas Construtivos"

Rota `src/routes/_app/biblioteca-mestra.sistemas.tsx` (+ entrada no `biblioteca-mestra.tsx` tabs):

- Lista de sistemas com filtro por `categoria_sistema`.
- CRUD de sistema (nome, código, categoria, descrição, ativo).
- Editor de composição: tabela de membros (artigo, papel, obrigatoriedade, ordem), reordenável por drag ou input de ordem. Cada alteração regenera relações derivadas via trigger.
- Botão "Pré-visualizar grafo": dialog simples com lista hierárquica (principal → membros agrupados por papel).

### 3.3 Indicadores na lista de artigos

Coluna nova em `biblioteca-mestra.artigos.tsx` com contagem de relações e badge de "pertence a N sistemas".

## 4. UI — Obra · separador Mapa de Quantidades

- Novo cartão "Coerência técnica" no topo do MQ com contadores: `crítico`, `aviso`, `info` (abertos) + botão "Reanalisar".
- Painel/drawer "Alertas técnicos" lista cada alerta:
  - artigo presente no MQ;
  - artigo esperado em falta (com link para o artigo mestre / sistema);
  - tipo de relação, obrigatoriedade, motivo gerado (ex.: *"O sistema ETICS inclui Rede de fibra de vidro (obrigatório), em falta."*);
  - ações: **Aceitar omissão**, **Justificar** (textarea), **Ignorar**, **Marcar resolvido** (após adicionar o artigo ao MQ, fica auto-resolvido na próxima análise).
- Estados de alertas tornam-se auditáveis (user + timestamp).

Sem alterações a Procurement/Planeamento/IA nesta fase — apenas garantir que os dados ficam disponíveis para consumo futuro.

## 5. Aplicação ao consumo futuro (preparado, não implementado)

- `biblioteca_artigo_relacoes` + `biblioteca_sistema_artigos` ficam disponíveis para queries de Procurement (sugerir artigos no mesmo pacote), Planeamento (dependências `antecede`/`precede`), IA (perguntas sobre completude).
- A função `analisarOmissoes` é genérica e poderá ser invocada por outros módulos passando a lista de artigos mestre presentes.

## 6. Fora de âmbito desta fase

- Sugestões automáticas em Procurement, Planeamento, Financeira, Histórico de Preços.
- Agente de IA conversacional sobre relações.
- Aprendizagem automática de relações a partir de MQs analisados (campo `origem='aprendizagem'` reservado).
- Visualização gráfica do grafo (apenas lista nesta fase).
- Importação em massa de sistemas/relações.

## Detalhe técnico

### Ficheiros principais

- **Migração** `supabase/migrations/<ts>_motor_relacoes.sql` — enums (`tipo_relacao`, `obrigatoriedade_relacao`, `papel_sistema`, `categoria_sistema`, `origem_relacao`, `severidade_alerta`, `estado_alerta`), 4 tabelas + GRANTs + RLS + triggers `tg_relacao_inversa`, `tg_sistema_artigo_sync_relacoes`, `set_updated_at`.
- `src/lib/biblioteca-mestra/types.ts` — novos tipos `SistemaConstrutivo`, `SistemaArtigo`, `ArtigoRelacao`, `TipoRelacao`, `Obrigatoriedade`, `PapelSistema`.
- `src/lib/relacoes/config.ts` — pesos e limiares.
- `src/lib/relacoes/analise.ts` — `analisarOmissoes(orcamentoId)`, `marcarAlerta(id, acao, justificacao?)`.
- `src/lib/classificacao/engine.ts` — chamar `analisarOmissoes` no fim de `runClassificacao`.
- `src/components/biblioteca-mestra/ArtigoRelacoesTab.tsx` *(novo)* — separador de relações dentro do dialog/edição do artigo.
- `src/components/biblioteca-mestra/RelacaoFormDialog.tsx` *(novo)* — criar/editar relação manual.
- `src/components/biblioteca-mestra/SistemaFormDialog.tsx` *(novo)* — CRUD de sistema + composição.
- `src/routes/_app/biblioteca-mestra.sistemas.tsx` *(novo)* + entrada no menu de tabs `biblioteca-mestra.tsx`.
- `src/components/obras/CoerenciaTecnicaCard.tsx` *(novo)* e `AlertasTecnicosPanel.tsx` *(novo)* — integrados em `obras.$id.mq.tsx`.

### Diagrama lógico

```text
SistemaConstrutivo ───< SistemaArtigo >─── ArtigoMestre
                                              │
                                              ├──< ArtigoRelacao (manual/auto/sistema) >── ArtigoMestre
                                              │
                                              └── analisarOmissoes(orcamento) → orcamento_alertas_tecnicos
```

### Notas de RLS/permissões

Todas as tabelas: `authenticated` full CRUD nas tabelas de biblioteca; `orcamento_alertas_tecnicos` herdam a regra das obras (mesmo padrão dos `orcamento_artigos`). `service_role` ALL.
