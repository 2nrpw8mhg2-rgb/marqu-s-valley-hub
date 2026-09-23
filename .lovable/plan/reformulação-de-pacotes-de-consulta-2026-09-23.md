# Reformulação de «Pacotes de Consulta»

## Objetivo
Substituir a tabela administrativa global por uma experiência visual, simples e contextual à obra selecionada, mantendo os pacotes automáticos existentes e a área de trabalho de cada pacote.

## Alterações previstas

### 1. Lista de pacotes por obra
- Reformular `/obras/{obraId}/procurement/pacotes` com o título e subtítulo pedidos.
- Mostrar quatro métricas calculadas exclusivamente a partir dos dados reais da obra: pacotes criados, consultas enviadas, propostas recebidas e em comparação.
- Apresentar os pacotes como uma lista de pastas clicáveis, com ícone, nome, resumo factual, estado real e separadores discretos.
- Manter pesquisa, filtro de estado e ordenação em controlos compactos; remover a alternância para tabela e qualquer criação manual.
- Criar apresentação responsiva: métricas em grelha no desktop e coluna no telemóvel; pastas sem tabela larga nem deslocamento horizontal.

### 2. Área de trabalho do pacote
- Ajustar `/obras/{obraId}/procurement/pacotes/{pacoteId}` com cabeçalho de pasta, estado, artigos, revisão do MQ e obra.
- Manter os breadcrumbs `Procurement → Pacotes de Consulta → {nome}`.
- Preservar exatamente os cinco separadores pedidos e o separador ativo no URL.
- Manter o mapa individual e as exportações Excel/PDF com os dados integrais atuais.
- Reorganizar o «Âmbito da Consulta» como camada independente com gravação automática, incluindo inclusões, exclusões, responsabilidades, meios/equipamentos e notas técnicas/comerciais.
- Mostrar indicação de alterações ao MQ apenas quando existir uma versão congelada comparável; não criar snapshots nem envios.

### 3. Documentação e empresas
- Melhorar a seleção documental com pesquisa, seleção múltipla, agrupamento pelas pastas/categorias reais da mesma obra e resumo dos associados.
- Preservar os ficheiros na Gestão Documental: apenas criar/remover referências do pacote.
- Manter empresas da base global, priorizar correspondências com a subempreitada, permitir pesquisa e mostrar contactos/especialidades reais e estado selecionada/disponível.
- Manter estados vazios honestos para pedidos de cotação e propostas, sem simulação nem envio.

### 4. Percurso histórico e segurança
- Fazer `/procurement/pacotes` deixar de apresentar a tabela global: encaminhar para a experiência de uma obra quando o contexto existir ou pedir seleção de obra.
- Garantir que cada consulta permanece filtrada pela obra e que o pacote aberto pertence à obra do endereço.
- Reutilizar as tabelas, regras de acesso, hooks e operações da primeira fase; não criar migração salvo necessidade descoberta durante a implementação.

### 5. Validação
- Atualizar testes para métricas reais e zeros, isolamento por obra, ausência de números ilustrativos, abertura da pasta, ordem dos cinco separadores, integridade do MQ, documentos da mesma obra, reutilização de fornecedores globais e ausência de envios.
- Verificar a apresentação e interação em desktop, tablet e telemóvel.
- Executar todos os testes, verificação de tipos e compilação; corrigir eventuais falhas.

## Fora do âmbito
- Não publicar.
- Não enviar emails ou pedidos de cotação.
- Não criar propostas, adjudicações, fornecedores, documentos ou pacotes fictícios.
- Não alterar classificações, artigos, quantidades ou ficheiros reais.
