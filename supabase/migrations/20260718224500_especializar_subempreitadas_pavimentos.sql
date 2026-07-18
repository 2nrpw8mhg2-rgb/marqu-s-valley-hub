-- Pavimentos é um capítulo de orçamento, não uma única subempreitada contratual.
INSERT INTO public.subempreitadas (
  codigo, nome, descricao, palavras_chave, termos_exclusao, ordem
) VALUES
(
  'BETON',
  'Betonilhas e Regularizações',
  'Betonilhas, enchimentos e camadas de regularização para receber acabamentos',
  ARRAY[
    'betonilha','betonilha de regularizacao','betonilha armada',
    'regularizacao de pavimento','camada de regularizacao','enchimento de pavimento',
    'betao leve','argamassa de regularizacao','autonivelante'
  ],
  ARRAY['microcimento','pavimento final'],
  86
),
(
  'CERAM',
  'Pavimentos Cerâmicos',
  'Fornecimento e assentamento de mosaicos e revestimentos cerâmicos de pavimento',
  ARRAY[
    'pavimento ceramico','mosaico ceramico','ladrilho ceramico',
    'gres porcelanico','porcelanico','assentamento de mosaico',
    'ceramico de pavimento','junta de pavimento ceramico'
  ],
  ARRAY['ceramico de parede','azulejo'],
  91
),
(
  'MADEIRA',
  'Pavimentos em Madeira',
  'Soalhos, tacos, parquet e outros pavimentos de madeira',
  ARRAY[
    'soalho','pavimento em madeira','madeira macica','parquet','taco de madeira',
    'soalho multicamada','soalho flutuante de madeira','afagamento de soalho'
  ],
  ARRAY['porta interior','carpintaria de portas','movel'],
  92
),
(
  'VINIL',
  'Pavimentos Vinílicos / Laminados',
  'Pavimentos vinílicos, laminados e flutuantes sintéticos',
  ARRAY[
    'pavimento vinilico','vinilico','pavimento laminado','laminado',
    'flutuante sintetico','pavimento flutuante','lvt','linoleo'
  ],
  ARRAY['madeira macica','soalho'],
  93
),
(
  'PAVEXT',
  'Pavimentos Exteriores / Calçada',
  'Calçadas, lancis e pavimentos exteriores pedonais ou rodoviários',
  ARRAY[
    'calcada','cubo de granito','pavimento exterior','pavimentos exteriores',
    'lancil','passeio','pavimento pedonal','pavimento rodoviario',
    'reposicao de passeio'
  ],
  ARRAY['terraço impermeabilizado','pavimento interior'],
  94
)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  palavras_chave = EXCLUDED.palavras_chave,
  termos_exclusao = EXCLUDED.termos_exclusao,
  ordem = EXCLUDED.ordem,
  ativo = true;

-- Mantém o registo histórico, mas impede novas classificações no grupo genérico.
UPDATE public.subempreitadas
SET ativo = false,
    descricao = 'Categoria histórica substituída por subempreitadas especializadas de pavimentos'
WHERE codigo = 'PAV';

-- Calçada e pavimentos deixam de competir com o pacote genérico de exteriores.
UPDATE public.subempreitadas
SET palavras_chave = ARRAY[
  'muro exterior','portao exterior','jardim','rega','relvado',
  'arranjo exterior','plantacao','paisagismo'
]
WHERE codigo = 'EXT';
