-- Separa os trabalhos de estaleiro da categoria genérica Limpezas e Diversos.
INSERT INTO public.subempreitadas (
  codigo, nome, descricao, palavras_chave, termos_exclusao, ordem
) VALUES (
  'ESTAL',
  'Estaleiro',
  'Montagem, exploração e desmontagem do estaleiro e trabalhos preparatórios gerais',
  ARRAY[
    'estaleiro',
    'montagem de estaleiro',
    'desmontagem do estaleiro',
    'instalacoes provisorias',
    'vedacao de obra',
    'placa de obra',
    'wc de obra',
    'plano de seguranca e saude',
    'plano de gestao de residuos',
    'compilacao tecnica',
    'telas finais'
  ],
  ARRAY[]::text[],
  5
)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  palavras_chave = EXCLUDED.palavras_chave,
  termos_exclusao = EXCLUDED.termos_exclusao,
  ordem = EXCLUDED.ordem,
  ativo = true;

UPDATE public.subempreitadas
SET palavras_chave = ARRAY[
  'limpeza final',
  'limpeza de obra',
  'limpezas gerais',
  'limpeza geral',
  'diversos'
]
WHERE codigo = 'DIV';
