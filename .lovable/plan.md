Vou corrigir a apresentação do MQT classificado para seguir a ordem real do ficheiro carregado e evitar que linhas desapareçam.

Plano:
1. Guardar a posição original de cada linha do MQT durante a leitura, usando a ordem sequencial do ficheiro como fonte de verdade.
2. Inserir capítulos e artigos mantendo essa ordem original, sem reordenar por data de criação nem por classificação.
3. Ajustar a classificação para processar os artigos por `ordem`, garantindo que os registos classificados são criados na mesma sequência do MQT.
4. Ajustar a tabela do Passo 4 para ordenar pelo artigo original (`orcamento_artigos.ordem`) em vez de `classificacao_artigos.created_at`.
5. Rever o filtro do parser que pode estar a excluir linhas válidas do MQT atualizado, sobretudo linhas sem código mas com unidade/quantidade/descrição, para reduzir o risco de MQT incompleto.
6. Validar no ecrã que a contagem de artigos lidos/classificados bate certo e que a tabela aparece na sequência original.