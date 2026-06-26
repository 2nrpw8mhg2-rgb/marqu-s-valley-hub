# Plano: Subespecialidades da 110 (MEP) como disciplinas autónomas

## Objetivo
Manter a 110 — Especialidades Técnicas (MEP) visível como uma única especialidade para o utilizador, mas dar a cada subespecialidade (Eletricidade, AVAC, ITED, SCIE, Gás, …) o estatuto interno de **disciplina técnica autónoma**, com identidade própria para Procurement, Histórico de Preços, Financeiro, Planeamento, Documentação, IA e Dashboards.

## Estratégia
Em vez de duplicar a Especialidade ou inflar a Biblioteca Mestra, introduzimos um conceito novo, transversal, chamado **Disciplina Técnica**, baseado nas subespecialidades existentes. Tudo o que hoje agrupa por `especialidade` passará a poder agrupar adicionalmente por `disciplina = subespecialidade` quando estamos dentro da 110.

## Passo 1 — Marcar a 110 como "mãe de disciplinas"
- Adicionar à tabela `biblioteca_especialidades` a flag `subesp_como_disciplina boolean default false`.
- Marcar a 110 como `true`. Nenhuma outra especialidade afetada hoje.
- Adicionar a `biblioteca_subespecialidades` os campos `slug` (ex. `eletricidade`, `avac`, `ited`, `scie`, `gas`, `domotica`, `seguranca`, `renovaveis`, `aqs`, `elevadores`, `especiais`, `comissionamento`, `bms`, `hidraulicas`) e `cor` (para badges nos dashboards). Preencher com os valores da spec.

## Passo 2 — Keywords e regras por disciplina (IA)
Hoje só temos `biblioteca_especialidade_keywords`. Criar:
- `biblioteca_subespecialidade_keywords` (mesma forma: termo, tipo positiva/negativa, peso, origem).
- `biblioteca_subespecialidade_regras` (regras de classificação por subespecialidade — pares "se contém X → vai para subespecialidade Y / categoria Y"; cobre os exemplos "tomadas → Eletricidade", "downlights → Iluminação", "condutas metálicas → AVAC", "piso radiante → Aquecimento", etc.).
- Estender `suggestCategoria` em `src/lib/biblioteca-mestra/biblioteca.functions.ts` com um passo prévio `suggestSubespecialidade` que, dentro da 110, escolhe a disciplina antes de escolher a categoria. As regras do passo anterior são aplicadas determinísticamente; a IA só decide o que sobrar.
- Popular as keywords iniciais para as 14 disciplinas (lista da tua spec: Eletricidade, AVAC, ITED, SCIE, Gás, Domótica, Segurança, Renováveis, Bombas de Calor/AQS, Elevadores, Sistemas Especiais, Comissionamento, BMS, Hidráulicas).

## Passo 3 — Procurement por disciplina
- Adicionar `procurement_pacotes.subespecialidade_id` (uuid, opcional). Quando a especialidade do pacote é "Especialidades Técnicas (MEP)", o pacote passa a estar ligado a uma disciplina específica.
- No fluxo "Criar Pacote de Consulta" do orçamento, quando a especialidade é MEP, agrupar artigos por subespecialidade e gerar **um pacote por disciplina** (Eletricidade, AVAC, ITED, …) em vez de um único pacote MEP.
- Adicionar `subempreiteiros.subespecialidades text[]` para podermos sugerir subempreiteiros certos por disciplina (ex. AVAC ≠ Eletricidade ≠ ITED certificado). As entradas atuais que tenham "AVAC", "Eletricidade", "ITED", "Gás" no array `especialidades` são migradas automaticamente.
- Ajustar a sugestão de fornecedores no pacote para filtrar primeiro por subespecialidade, depois por especialidade.

## Passo 4 — Histórico de preços por disciplina
- O histórico já vive em `orcamento_artigo_fontes` ligado a `biblioteca_artigos` (que já tem `subespecialidade_id`). Não precisa de schema novo — apenas adicionar `disciplina` (= subespecialidade) como dimensão de agrupamento nas vistas/queries existentes de histórico.
- Adicionar uma view `v_precos_por_disciplina` (subespecialidade_id → categoria → artigo → preço médio, mínimo, máximo, nº de ocorrências, última obra).

## Passo 5 — Financeiro e Dashboards por disciplina
- Adicionar uma view `v_financeiro_obra_disciplina` que, para cada obra, soma adjudicado / faturado / executado / desvio por subespecialidade da 110 (e mantém os outros agrupamentos por especialidade para 010-100, 120+).
- Os dashboards de obra passam a ter um drill-down: clicar em "MEP" abre as 14 disciplinas com KPIs próprios (adjudicado, faturado, % executado, desvios, nº propostas, nº fornecedores ativos).

## Passo 6 — Planeamento por disciplina
- Quando existir planeamento (módulo futuro), cada disciplina poderá ter o seu cronograma. Para já fica preparado: `biblioteca_subespecialidades.sequencia_construtiva jsonb` guarda a sequência típica (ex. AVAC: condutas → equipamentos → balanceamento → ensaios; Eletricidade: execução → ensaios → comissionamento). Permite gerar templates automáticos quando o módulo de planeamento existir.

## Passo 7 — Gestão Documental por disciplina
- Estender `criar_pastas_padrao_obra` para, dentro da pasta "Especialidades", criar automaticamente uma subpasta por disciplina (Eletricidade, AVAC, ITED, SCIE, Gás, …) com as pastas-tipo já definidas na spec (Projeto, Telas Finais, Certificados, Ensaios, Balanceamento, Manuais conforme aplicável a cada disciplina).
- A configuração de quais pastas-tipo cada disciplina recebe vive em `biblioteca_subespecialidades.pastas_padrao text[]`.

## Passo 8 — UI da Biblioteca Mestra
- A página `/biblioteca-mestra/especialidades` continua a mostrar uma única linha "110 — Especialidades Técnicas (MEP)".
- A página `/biblioteca-mestra/subespecialidades` ganha um filtro "Disciplina autónoma" e, para as filhas da 110, mostra um indicador visual (badge da cor da disciplina) e dá acesso direto às keywords / regras / pastas-tipo / sequência construtiva de cada uma.
- Nova página `/biblioteca-mestra/disciplinas` (só lista as 14 disciplinas da 110, com cartões de configuração rápida). Esta é a porta de entrada para configurar tudo o que é "por disciplina" sem inflar a UI principal.

## Detalhes técnicos
- Tudo migrações SQL standard com GRANTs (`authenticated`, `service_role`).
- Sem breaking changes: as colunas novas são opcionais; o código atual continua a funcionar e tratará a 110 como uma especialidade normal até o frontend usar os novos campos.
- Passo 1, 2 e 3 são feitos numa primeira migração + edição do `suggestCategoria`. Passos 4-7 são migrações + views isoladas (podem ser entregues em iterações seguintes).
- Não tocamos em `auth`, `storage`, nem em ficheiros auto-gerados.

## O que NÃO faz
- Não cria 14 especialidades novas no topo (decisão expressa do utilizador).
- Não altera a 010-100 nem 120+ — só a 110.
- Não implementa o módulo de Planeamento nem reescreve os Dashboards (apenas prepara dados e views; UI dos dashboards entra noutra iteração).

## Confirmações antes de avançar
1. **Slugs e cores das 14 disciplinas** — gero defaults razoáveis (ex. AVAC = azul, Eletricidade = amarelo, ITED = roxo, …) ou queres definir tu?
2. **Agrupamento em Procurement** — quando crio o pacote MEP a partir de um orçamento, gero **um pacote por disciplina automaticamente** (recomendado) ou deixo o utilizador escolher disciplina-a-disciplina?
3. **Ordem de entrega** — faço **tudo numa só iteração** (Passos 1-8) ou prefere **faseado** (1+2+3 primeiro, restantes depois conforme módulos amadurecem)?
