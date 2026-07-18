INSERT INTO public.subempreitadas (
  codigo, nome, descricao, palavras_chave, termos_exclusao, ordem
) VALUES
(
  'ACUST',
  'Isolamentos Acústicos',
  'Mantas, painéis e sistemas de isolamento acústico a ruído aéreo ou de percussão',
  ARRAY[
    'isolamento acustico','manta acustica','stravifloor','isolamento a ruido',
    'isolamento a sons de percussao','manta resiliente','barreira acustica',
    'painel acustico','correcao acustica','insonorizacao'
  ],
  ARRAY['isolamento termico','la de rocha para avac'],
  55
),
(
  'RAD',
  'Aquecimento Radiante',
  'Fornecimento, instalação, ligação e ensaio de sistemas de piso radiante',
  ARRAY[
    'aquecimento radiante','pavimento radiante','piso radiante',
    'tubo de piso radiante','coletor de piso radiante','sistema radiante',
    'placa de piso radiante','termostato de piso radiante'
  ],
  ARRAY[
    'incluido no projecto de mecanicas','incluido no projeto de mecanicas',
    'betonilha para pavimento radiante','betonilha para piso radiante'
  ],
  181
)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  palavras_chave = EXCLUDED.palavras_chave,
  termos_exclusao = EXCLUDED.termos_exclusao,
  ordem = EXCLUDED.ordem,
  ativo = true;

-- Quando o artigo começa por uma manta acústica, a betonilha é uma camada
-- complementar do sistema e não deve ganhar a classificação principal.
UPDATE public.subempreitadas
SET termos_exclusao = ARRAY[
  'microcimento','pavimento final','manta acustica','stravifloor'
]
WHERE codigo = 'BETON';
