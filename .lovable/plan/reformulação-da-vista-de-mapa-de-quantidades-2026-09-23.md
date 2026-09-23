# Reformulação da vista de Mapa de Quantidades

## Objetivo
Transformar o mapa individual numa composição reutilizável, compacta e profissional, sem alterar dados nem o funcionamento das exportações.

## Implementação
- Extrair componentes genéricos para cabeçalho, barra de pesquisa e filtros, hierarquia capítulo/subcapítulo, descrição progressiva, seleção, paginação e painel lateral de detalhe.
- Criar lógica pura e memoizável para pesquisa, filtros dependentes, ordenação dentro dos grupos, agrupamento, somatórios por unidade compatível, paginação e seleção visível.
- Persistir pesquisa, capítulo, subcapítulo, ordenação, direção, página, tamanho e artigo aberto no endereço da página.
- Manter a ordem original por omissão; abrir automaticamente grupos com resultados e representar explicitamente artigos sem capítulo/subcapítulo.
- Aplicar tabela fixa e densa no desktop, cartões equivalentes no telemóvel, com descrições em três linhas e expansão apenas da página atual.
- Adicionar painel lateral responsivo com todos os dados existentes e navegação anterior/seguinte na lista visível.
- Preservar Excel/PDF sobre o conjunto integral original da pasta, sem depender de filtros, seleção, paginação ou expansão.

## Desempenho e estados
- Paginação local 25/50/100 para esta pasta, suficiente para conjuntos até 100 e sem renderização integral em conjuntos maiores.
- Cálculos derivados memoizados, pesquisa com atraso curto e nenhuma consulta adicional por artigo.
- Estados de carregamento, vazio, erro e ausência de resultados com os componentes visuais existentes.

## Verificação
- Testes unitários da hierarquia, filtros e endereço, ordenação, seleção, paginação, descrições e integridade das exportações.
- Testes de interface para tabela/cartões, painel lateral, teclado, foco e larguras de 1440, 1024 e 390 px.
- Executar todos os testes, verificação de tipos e construção; não publicar nem alterar dados reais.
