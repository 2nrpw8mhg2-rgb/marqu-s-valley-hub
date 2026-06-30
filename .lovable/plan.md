
## Problema

Na "Preparação de Orçamento" da obra Murtal aparecem 236 artigos (ex.: "Arranjos Exteriores", "Cumprimento do Plano de Segurança e Saúde", "Remoção de construções de grande porte"), mas a pasta `Documental → Murtal → Mapa de Quantidades` só contém **um** ficheiro real (`Okab Travessa de Macau - Medicoes_02Set2025.xls`, 409 KB).

Causa: existe um `rascunho_tecnico` antigo nesta obra cujo `mq_documento_id` aponta para outro documento (provavelmente já apagado ou de outra revisão), e o Passo 4 mostra os artigos desse rascunho — nunca foi feita a leitura do ficheiro que está agora na pasta "Mapa de Quantidades" da obra Murtal.

Hoje o Passo 1 só filtra pela pasta correta na criação do rascunho; quando já existe rascunho, o wizard salta para o Passo 4 sem revalidar a origem.

## Objetivo

A única fonte do MQT é a pasta **"Mapa de Quantidades" da obra selecionada no CRM de Obras**. Nada fora dessa pasta pode alimentar o wizard, e o utilizador tem de ver sempre — e poder trocar — o documento de origem.

## Alterações (frontend, `src/routes/_app/obras.$id.preparacao-orcamento.tsx`)

1. **Validar origem do rascunho ao carregar**
   - Após obter `rascunho` e `mqDocs`, calcular `mqDocs.some(d => d.id === rascunho.mq_documento_id)`.
   - Se for `false` (documento já não existe na pasta "Mapa de Quantidades" desta obra), forçar `passo = 1` e mostrar aviso a vermelho: "O MQT deste rascunho já não está disponível na pasta «Mapa de Quantidades» desta obra. Seleciona o MQT atual para continuar."
   - Garantir que `mqDocs` exclui rigorosamente o `tipo === "mq"` quando o documento **não** está dentro da pasta cujo `nome` (case-insensitive, trim) é "Mapa de Quantidades" da própria obra. Hoje aceita `tipo === "mq"` em qualquer pasta — passa a exigir pasta correta.

2. **Cabeçalho do wizard mostra sempre a origem**
   - Acima dos passos, mostrar bloco fixo: nome do ficheiro MQT em uso + data + tamanho + link "Trocar MQT" que volta ao Passo 1.
   - No Passo 4, repetir essa origem por cima da tabela, com botão "Re-ler a partir deste MQT" que reabre o Passo 2 (limpa `orcamento_artigos`/`orcamento_capitulos` e reimporta), mantendo o `id` do rascunho.

3. **Passo 1 — só os documentos da pasta certa**
   - Mensagem clara: "A ler de: Obra → {nome da obra} → Mapa de Quantidades."
   - Se a pasta "Mapa de Quantidades" não existir nesta obra: mostrar CTA "Criar pasta «Mapa de Quantidades» em Documentos" com link direto para `/obras/${obraId}/documentos`.
   - Se a pasta existir mas estiver vazia: mensagem específica "A pasta «Mapa de Quantidades» desta obra está vazia. Adiciona o ficheiro em Documentos."
   - Já não usar `tipo === "mq"` como fallback de origem — apenas como sinalização visual; a filtragem é por pasta.

4. **Passo 2 — confirmar o ficheiro antes de ler**
   - Antes do `download`, validar de novo que `rascunho.mq_documento_id ∈ mqDocs`. Se não, abortar com toast e voltar ao Passo 1.
   - No card de leitura, mostrar `Obra → Mapa de Quantidades → {nome do ficheiro}` em destaque para o utilizador confirmar visualmente.

## Sem alterações de schema / sem dados de seed

- Não tocar em `orcamento_artigos`, `orcamento_capitulos`, `classificacao_artigos` (continuam a respeitar a imutabilidade do MQT original).
- Não criar migrações. A limpeza de artigos antigos acontece naturalmente quando o utilizador clicar "Re-ler a partir deste MQT" no Passo 2 (já existe esse fluxo nas linhas 521-522).

## Fora de âmbito

- Pacotes/Procurement, Orçamento Final, Motor de Classificação.
- Alterar a Gestão Documental (pasta "Mapa de Quantidades" continua a ser criada/gerida lá).
