
-- 1. Tabela subempreitadas
CREATE TABLE public.subempreitadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  palavras_chave text[] NOT NULL DEFAULT '{}',
  termos_exclusao text[] NOT NULL DEFAULT '{}',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subempreitadas TO authenticated;
GRANT ALL ON public.subempreitadas TO service_role;

ALTER TABLE public.subempreitadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subempreitadas_select_auth" ON public.subempreitadas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "subempreitadas_insert_admin" ON public.subempreitadas
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "subempreitadas_update_admin" ON public.subempreitadas
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "subempreitadas_delete_admin" ON public.subempreitadas
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER tg_subempreitadas_updated
  BEFORE UPDATE ON public.subempreitadas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Seed das 22 subempreitadas padrão
INSERT INTO public.subempreitadas (codigo, nome, descricao, palavras_chave, termos_exclusao, ordem) VALUES
('DEMOL', 'Demolições', 'Demolição, desmonte e remoção de elementos existentes',
  ARRAY['demolicao','demolir','desmonte','desmontagem','remocao','arranque','picagem','picar','levantamento de','retirada de'],
  ARRAY['reconstrucao','reposicao'], 10),
('ESTRUT', 'Estrutura / Betão Armado', 'Betão, cofragem, armaduras e estrutura',
  ARRAY['betao','betonagem','cofragem','descofragem','armadura','aco em varao','estrutura','laje','pilar','viga','sapata','fundacao','muro de suporte','microestaca','estaca'],
  ARRAY['betao de limpeza para pavimento','betao decorativo'], 20),
('ALVEN', 'Alvenarias', 'Paredes de tijolo, bloco, alvenaria em geral',
  ARRAY['alvenaria','tijolo','bloco termico','bloco de betao','parede de tijolo','pano de alvenaria'],
  ARRAY['pladur','gesso cartonado','divisoria em pladur'], 30),
('REBOC', 'Rebocos e Estuques', 'Rebocos, estuques e argamassas de acabamento',
  ARRAY['reboco','estuque','argamassa de acabamento','chapisco','esboco','regularizacao de paredes'],
  ARRAY['betonilha'], 40),
('PLADUR', 'Pladur / Tetos Falsos', 'Divisórias e tetos em gesso cartonado',
  ARRAY['pladur','gesso cartonado','teto falso','tecto falso','divisoria em pladur','forra em pladur','sanca','placa hidrofuga'],
  ARRAY[]::text[], 50),
('IMPERM', 'Impermeabilizações', 'Telas, membranas e produtos impermeabilizantes',
  ARRAY['impermeabilizacao','tela asfaltica','membrana','telas','pintura impermeavel','emulsao betuminosa'],
  ARRAY[]::text[], 60),
('CAPOTO', 'Capoto / ETICS', 'Isolamento térmico pelo exterior',
  ARRAY['capoto','etics','isolamento pelo exterior','eps de fachada','sistema etics'],
  ARRAY[]::text[], 70),
('COBERT', 'Coberturas', 'Telhados, coberturas e remates',
  ARRAY['cobertura','telha','telhado','telha ceramica','asna','ripado','subtelha','rufos','caleira','beiral','claraboia'],
  ARRAY[]::text[], 80),
('PAV', 'Pavimentos', 'Pavimentos interiores e exteriores',
  ARRAY['pavimento','betonilha','vinilico','flutuante','madeira macica','laminado','mosaico','ceramico de pavimento','microcimento','autonivelante','pavimento vinilico'],
  ARRAY['pavimento exterior em cubo','calcada'], 90),
('REVEST', 'Revestimentos', 'Revestimentos de paredes (azulejo, cerâmicos)',
  ARRAY['azulejo','revestimento ceramico','faianca','ceramico de parede','revestimento de parede'],
  ARRAY['pedra natural'], 100),
('PEDRA', 'Pedras Naturais', 'Mármores, granitos e pedras naturais',
  ARRAY['pedra natural','marmore','granito','calcario','ataija','moleanos','lioz','soleira em pedra','peitoril em pedra','bancada em pedra'],
  ARRAY[]::text[], 110),
('CARPT', 'Carpintarias', 'Portas, rodapés, mobiliário fixo em madeira',
  ARRAY['carpintaria','porta interior','aro','guarnicao','rodape','armario embutido','roupeiro','portada'],
  ARRAY['cozinha','porta exterior de aluminio','caixilharia'], 120),
('CAIX', 'Caixilharias', 'Janelas, portas exteriores, envidraçados',
  ARRAY['caixilharia','janela','porta exterior','vidro duplo','envidracado','estore','persiana','oscilo batente','porta de entrada'],
  ARRAY['porta interior'], 130),
('SERR', 'Serralharias', 'Guardas metálicas, portões, estruturas ligeiras',
  ARRAY['serralharia','guarda metalica','corrimao','portao','grade','estrutura metalica ligeira','guarda em aco','escada metalica'],
  ARRAY['estrutura em betao','asna'], 140),
('PINT', 'Pinturas', 'Pinturas interiores e exteriores',
  ARRAY['pintura','tinta','primario','betumar','lixar para pintar','esmalte','verniz','tinta plastica','tinta de agua'],
  ARRAY[]::text[], 150),
('ELECT', 'Eletricidade', 'Instalação elétrica, iluminação, ITED',
  ARRAY['eletrica','electrica','iluminacao','tomada','interruptor','quadro eletrico','cabo eletrico','luminaria','ited','domotica','circuito'],
  ARRAY[]::text[], 160),
('AGUAS', 'Águas e Esgotos', 'Redes de água, esgotos, pluviais',
  ARRAY['agua fria','agua quente','esgoto','pluvial','tubagem','ppr','multicamada','pex','sifao','ralo','coletor','saneamento'],
  ARRAY['avac'], 170),
('AVAC', 'AVAC / Climatização', 'Ar condicionado, ventilação, aquecimento',
  ARRAY['avac','ar condicionado','climatizacao','ventilacao','vmc','recuperador de calor','condutas','bomba de calor','split','multi split'],
  ARRAY[]::text[], 180),
('SANIT', 'Equipamentos Sanitários', 'Loiças, torneiras, acessórios de casa de banho',
  ARRAY['sanita','autoclismo','lavatorio','base de duche','banheira','bide','misturadora','torneira','acessorios sanitarios','termoacumulador'],
  ARRAY[]::text[], 190),
('COZ', 'Cozinhas e Mobiliário', 'Móveis de cozinha e mobiliário fixo especial',
  ARRAY['cozinha','movel de cozinha','bancada de cozinha','placa vitroceramica','placa de inducao','exaustor','forno encastravel','frigorifico'],
  ARRAY[]::text[], 200),
('EXT', 'Trabalhos Exteriores', 'Arranjos exteriores, calçada, muros, jardim',
  ARRAY['calcada','cubo de granito','muro exterior','portao exterior','pavimento exterior','jardim','rega','relvado','arranjo exterior','passeio','lancil'],
  ARRAY[]::text[], 210),
('DIV', 'Limpezas e Diversos', 'Limpezas finais, estaleiro, diversos',
  ARRAY['limpeza final','limpeza de obra','estaleiro','montagem de estaleiro','contentor','vedacao de obra','placa de obra','wc de obra'],
  ARRAY[]::text[], 220);

-- 3. Colunas novas em biblioteca_artigos
ALTER TABLE public.biblioteca_artigos
  ADD COLUMN subempreitada_principal_id uuid REFERENCES public.subempreitadas(id) ON DELETE SET NULL,
  ADD COLUMN subempreitada_secundaria_id uuid REFERENCES public.subempreitadas(id) ON DELETE SET NULL,
  ADD COLUMN confianca_subempreitada numeric(4,3),
  ADD COLUMN origem_classificacao_subempreitada text CHECK (origem_classificacao_subempreitada IN ('manual','regras','ia','herdada'));

CREATE INDEX idx_biblioteca_artigos_subempreitada_principal
  ON public.biblioteca_artigos(subempreitada_principal_id);

-- 4. Colunas novas em orcamento_artigos
ALTER TABLE public.orcamento_artigos
  ADD COLUMN subempreitada_id uuid REFERENCES public.subempreitadas(id) ON DELETE SET NULL,
  ADD COLUMN subempreitada_confianca numeric(4,3),
  ADD COLUMN subempreitada_origem text CHECK (subempreitada_origem IN ('artigo_mestre','regras','manual','ia','aprendizagem')),
  ADD COLUMN subempreitada_validada_manual boolean NOT NULL DEFAULT false;

CREATE INDEX idx_orcamento_artigos_subempreitada
  ON public.orcamento_artigos(subempreitada_id);

-- 5. Tabela subempreitada_aprendizagem
CREATE TABLE public.subempreitada_aprendizagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao_normalizada text NOT NULL,
  artigo_mestre_id uuid REFERENCES public.biblioteca_artigos(id) ON DELETE CASCADE,
  subempreitada_id uuid NOT NULL REFERENCES public.subempreitadas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  peso integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_aprend_descricao ON public.subempreitada_aprendizagem(descricao_normalizada);
CREATE INDEX idx_sub_aprend_artigo ON public.subempreitada_aprendizagem(artigo_mestre_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subempreitada_aprendizagem TO authenticated;
GRANT ALL ON public.subempreitada_aprendizagem TO service_role;

ALTER TABLE public.subempreitada_aprendizagem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_aprend_select_auth" ON public.subempreitada_aprendizagem
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sub_aprend_insert_own" ON public.subempreitada_aprendizagem
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sub_aprend_update_own_or_admin" ON public.subempreitada_aprendizagem
  FOR UPDATE TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(),'admin'));
CREATE POLICY "sub_aprend_delete_own_or_admin" ON public.subempreitada_aprendizagem
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(),'admin'));

CREATE TRIGGER tg_sub_aprend_updated
  BEFORE UPDATE ON public.subempreitada_aprendizagem
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
