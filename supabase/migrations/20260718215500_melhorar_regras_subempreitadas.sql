-- Especialidade em falta no catálogo inicial e termos observados em mapas reais.
INSERT INTO public.subempreitadas (
  codigo, nome, descricao, palavras_chave, termos_exclusao, ordem
) VALUES (
  'VIDRO',
  'Vidros e Espelhos',
  'Espelhos, divisórias e outros trabalhos executados por vidraceiro',
  ARRAY['vidros e espelhos','espelho','vidro temperado','divisoria para duche','resguardo de duche','vidraceiro'],
  ARRAY['caixilharia','vidro duplo'],
  135
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
  'carpintaria','porta interior','portas interiores','paineis em mdf',
  'guarnicao','rodape','armario embutido','roupeiro','portada',
  'apainelado','mdf','aro'
]
WHERE codigo = 'CARPT';

UPDATE public.subempreitadas
SET palavras_chave = ARRAY[
  'equipamento sanitario','sanita','lavatorio','base de duche',
  'autoclismo','banheira','bide','misturadora','torneira',
  'acessorios sanitarios','termoacumulador','loica sanitaria','bancada para banho'
]
WHERE codigo = 'SANIT';
