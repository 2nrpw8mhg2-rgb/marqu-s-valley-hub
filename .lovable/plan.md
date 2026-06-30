## Objetivo

Mostrar o **Mapa de Quantidades classificado** diretamente no Passo 4 (Validação) da Preparação de Orçamento, em vez de apenas KPIs + link para o Motor de Classificação. O utilizador deve ver/agir sem sair do wizard.

## Alterações

### `src/routes/_app/obras.$id.preparacao-orcamento.tsx` — Passo 4

Substituir o conteúdo atual do `Passo4` (apenas KPIs e botões) por uma vista completa:

1. **Manter no topo**: cabeçalho, KPIs (Total/Auto/Validados/A validar/Sem classif.) e o aviso "Nenhum orçamento final será gerado nesta fase".

2. **Adicionar tabela do MQT classificado** (corpo principal do passo), com colunas:
   - Código
   - Descrição (do MQT original, imutável)
   - Un.
   - Quantidade
   - **Resultado IA** (badge — reutilizar `ResultadoIABadge`)
   - **Confiança** (barra — reutilizar `ConfiancaBar`)
   - **Classificação proposta**: Especialidade › Subespecialidade › Categoria › Artigo Mestre
   - **Próxima ação** (chip — reutilizar `ProximaAcaoChip`: Aceitar / Corrigir / Escolher / Criar)

3. **Filtros rápidos** acima da tabela: Todos · A validar · Sem classificação · Validados · Auto · Capítulos. Pesquisa por texto (descrição/código).

4. **Linhas de capítulo** renderizadas como header destacado (sem colunas de classificação).

5. **Ações por linha**:
   - Aceitar (estado → validado, usa candidato top)
   - Abrir painel lateral de detalhe (reutilizar `ClassificacaoSidePanel` já existente) para corrigir/escolher/criar keyword/criar artigo mestre — toda a aprendizagem corre por aqui, igual ao Motor de Classificação.
   - Após qualquer ação, invalidar a query do passo.

6. **Rodapé**: manter "Marcar rascunho técnico como pronto"; remover/secundarizar "Abrir Motor de Classificação" (deixar como link discreto "Abrir em página inteira" para quem quiser o ecrã dedicado).

### Dados

Nova query no `Passo4` que carrega:
- `orcamento_artigos` (id, codigo, descricao, unidade, quantidade, is_capitulo, ordem) do rascunho
- `classificacao_artigos` (artigo_id, estado, metodo, confianca, candidatos, especialidade_id, subespecialidade_id, categoria_id, artigo_mestre_id)
- nomes resolvidos da Biblioteca Mestra (join client-side via maps)

Paginação: virtualização leve ou paginação simples 100/página (236 artigos no caso atual — uma página chega, mas preparar para maiores).

### Imutabilidade

A tabela **não edita** código/descrição/unidade/quantidade. Só altera a classificação (linhas em `classificacao_artigos`), respeitando o trigger já criado.

## Fora de âmbito

- Pacotes / Procurement (próxima entrega).
- Geração de orçamento final.
- Mudanças no Passo 3 (continua a correr a classificação automática).
