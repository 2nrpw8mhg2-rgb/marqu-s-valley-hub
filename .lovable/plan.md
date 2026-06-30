Vou corrigir o fluxo de «Re-ler MQT» para que a leitura guardada corresponda ao ficheiro carregado, sem perder linhas nem reorganizar capítulos/artigos.

Plano:
1. Ajustar o parser do MQT para preservar a sequência original de linhas e não descartar linhas válidas que tenham descrição, mesmo quando não têm código/unidade/quantidade claros.
2. Melhorar a deteção de capítulos para evitar que artigos sem unidade/quantidade sejam tratados indevidamente como capítulos, o que hoje pode retirar artigos da tabela classificada.
3. Corrigir a associação artigo → capítulo para usar uma chave estável da linha original, e não apenas a descrição do capítulo, evitando falhas quando há capítulos com descrições repetidas.
4. Guardar artigos e capítulos com `ordem` baseada na posição real no ficheiro, mantendo a organização original após «Re-ler».
5. Ajustar a tabela do Passo 4 para carregar as classificações ligadas aos artigos e ordenar sempre pela `ordem` do artigo original.
6. Garantir que a contagem apresentada no Passo 2/3/4 usa a mesma fonte de verdade, para ser possível perceber se todas as linhas do MQT foram lidas.
7. Validar no ecrã que, depois de «Re-ler MQT» e classificar, o número de artigos fica consistente e a tabela aparece pela ordem do ficheiro atualizado.