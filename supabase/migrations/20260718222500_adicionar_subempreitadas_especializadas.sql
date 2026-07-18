-- Subempreitadas especializadas observadas em mapas de quantidades reais.
INSERT INTO public.subempreitadas (
  codigo, nome, descricao, palavras_chave, termos_exclusao, ordem
) VALUES
(
  'MICRO',
  'Microcimento',
  'Sistemas contínuos de microcimento em pavimentos, paredes e zonas húmidas',
  ARRAY[
    'microcimento','microcrete','microbetao','revestimento continuo',
    'microcimento para zonas humidas','microcimento em paredes','microcimento em pavimentos'
  ],
  ARRAY[]::text[],
  105
),
(
  'PISC',
  'Piscinas',
  'Construção, impermeabilização, revestimento e equipamento técnico de piscinas',
  ARRAY[
    'piscina','equipamento de piscina','tratamento de agua da piscina',
    'casa das maquinas da piscina','pastilha de piscina','skimmer',
    'bomba de piscina','filtro de piscina','iluminacao subaquatica'
  ],
  ARRAY[]::text[],
  195
),
(
  'ELETRO',
  'Eletrodomésticos',
  'Fornecimento e instalação de eletrodomésticos e equipamentos de cozinha',
  ARRAY[
    'eletrodomestico','placa de inducao','placa vitroceramica','forno',
    'exaustor','frigorifico','garrafeira','maquina de lavar louca',
    'maquina lavar louca','micro ondas','microondas'
  ],
  ARRAY['quadro eletrico','instalacao eletrica'],
  205
),
(
  'ZINCO',
  'Coberturas em Zinco / Funilaria',
  'Caleiras, rufos, remates e revestimentos metálicos de cobertura',
  ARRAY[
    'zinco','vmzinc','caleira de zinco','rufo','rufos','funilaria',
    'chapa de zinco','remate de cobertura','platibanda em zinco'
  ],
  ARRAY['estrutura metalica','chapa de aco'],
  85
)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  palavras_chave = EXCLUDED.palavras_chave,
  termos_exclusao = EXCLUDED.termos_exclusao,
  ordem = EXCLUDED.ordem,
  ativo = true;

-- As categorias genéricas deixam de competir pelos mesmos termos.
UPDATE public.subempreitadas
SET palavras_chave = array_remove(array_remove(palavras_chave, 'microcimento'), 'microbetao')
WHERE codigo = 'PAV';

UPDATE public.subempreitadas
SET palavras_chave = ARRAY[
  'cozinha','movel de cozinha','bancada de cozinha','armario de cozinha',
  'mobiliario de cozinha','ilha de cozinha'
]
WHERE codigo = 'COZ';

UPDATE public.subempreitadas
SET palavras_chave = ARRAY[
  'cobertura','telha','telhado','telha ceramica','asna','ripado',
  'subtelha','beiral','claraboia'
]
WHERE codigo = 'COBERT';
