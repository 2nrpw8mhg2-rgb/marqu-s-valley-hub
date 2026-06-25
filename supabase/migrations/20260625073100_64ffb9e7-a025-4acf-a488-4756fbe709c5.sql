
-- Especialidades
CREATE TABLE public.biblioteca_especialidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text,
  descricao text,
  ordem integer NOT NULL DEFAULT 0,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_especialidades TO authenticated;
GRANT ALL ON public.biblioteca_especialidades TO service_role;
ALTER TABLE public.biblioteca_especialidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY biblioteca_especialidades_auth_all ON public.biblioteca_especialidades FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER biblioteca_especialidades_set_updated_at BEFORE UPDATE ON public.biblioteca_especialidades FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE UNIQUE INDEX biblioteca_especialidades_nome_uidx ON public.biblioteca_especialidades(lower(nome));

-- Subespecialidades
CREATE TABLE public.biblioteca_subespecialidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  especialidade_id uuid NOT NULL REFERENCES public.biblioteca_especialidades(id) ON DELETE CASCADE,
  nome text NOT NULL,
  codigo text,
  descricao text,
  ordem integer NOT NULL DEFAULT 0,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_subespecialidades TO authenticated;
GRANT ALL ON public.biblioteca_subespecialidades TO service_role;
ALTER TABLE public.biblioteca_subespecialidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY biblioteca_subespecialidades_auth_all ON public.biblioteca_subespecialidades FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER biblioteca_subespecialidades_set_updated_at BEFORE UPDATE ON public.biblioteca_subespecialidades FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX biblioteca_subespecialidades_esp_idx ON public.biblioteca_subespecialidades(especialidade_id);
CREATE UNIQUE INDEX biblioteca_subespecialidades_esp_nome_uidx ON public.biblioteca_subespecialidades(especialidade_id, lower(nome));

-- Artigos Mestre
CREATE TABLE public.biblioteca_artigos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subespecialidade_id uuid NOT NULL REFERENCES public.biblioteca_subespecialidades(id) ON DELETE CASCADE,
  codigo text,
  descricao text NOT NULL,
  unidade text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_artigos TO authenticated;
GRANT ALL ON public.biblioteca_artigos TO service_role;
ALTER TABLE public.biblioteca_artigos ENABLE ROW LEVEL SECURITY;
CREATE POLICY biblioteca_artigos_auth_all ON public.biblioteca_artigos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER biblioteca_artigos_set_updated_at BEFORE UPDATE ON public.biblioteca_artigos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX biblioteca_artigos_sub_idx ON public.biblioteca_artigos(subespecialidade_id);
CREATE INDEX biblioteca_artigos_desc_idx ON public.biblioteca_artigos USING gin (to_tsvector('portuguese', descricao));

-- Palavras-chave
CREATE TYPE public.biblioteca_keyword_tipo AS ENUM ('positiva','negativa');
CREATE TABLE public.biblioteca_artigo_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artigo_id uuid NOT NULL REFERENCES public.biblioteca_artigos(id) ON DELETE CASCADE,
  termo text NOT NULL,
  tipo public.biblioteca_keyword_tipo NOT NULL DEFAULT 'positiva',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_artigo_keywords TO authenticated;
GRANT ALL ON public.biblioteca_artigo_keywords TO service_role;
ALTER TABLE public.biblioteca_artigo_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY biblioteca_artigo_keywords_auth_all ON public.biblioteca_artigo_keywords FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX biblioteca_artigo_keywords_artigo_idx ON public.biblioteca_artigo_keywords(artigo_id);
CREATE INDEX biblioteca_artigo_keywords_termo_idx ON public.biblioteca_artigo_keywords(lower(termo));
CREATE UNIQUE INDEX biblioteca_artigo_keywords_uniq ON public.biblioteca_artigo_keywords(artigo_id, lower(termo), tipo);

-- Templates de Obra
CREATE TABLE public.templates_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates_obra TO authenticated;
GRANT ALL ON public.templates_obra TO service_role;
ALTER TABLE public.templates_obra ENABLE ROW LEVEL SECURITY;
CREATE POLICY templates_obra_auth_all ON public.templates_obra FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER templates_obra_set_updated_at BEFORE UPDATE ON public.templates_obra FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE UNIQUE INDEX templates_obra_nome_uidx ON public.templates_obra(lower(nome));

CREATE TABLE public.template_obra_pacotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates_obra(id) ON DELETE CASCADE,
  pacote_id uuid NOT NULL REFERENCES public.procurement_pacotes(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_obra_pacotes TO authenticated;
GRANT ALL ON public.template_obra_pacotes TO service_role;
ALTER TABLE public.template_obra_pacotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_obra_pacotes_auth_all ON public.template_obra_pacotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX template_obra_pacotes_uniq ON public.template_obra_pacotes(template_id, pacote_id);

-- Seed inicial
INSERT INTO public.biblioteca_especialidades (nome, codigo, ordem) VALUES
  ('Estruturas', 'EST', 1),
  ('Envolvente', 'ENV', 2),
  ('Acabamentos', 'ACA', 3),
  ('Especialidades Técnicas', 'TEC', 4),
  ('Arranjos Exteriores', 'EXT', 5),
  ('Finalização', 'FIN', 6);

INSERT INTO public.templates_obra (nome, descricao) VALUES
  ('Reabilitação', 'Obras de reabilitação'),
  ('Moradia', 'Moradia unifamiliar'),
  ('Edifício', 'Edifício multifamiliar / serviços'),
  ('Construção Nova', 'Construção nova genérica');
