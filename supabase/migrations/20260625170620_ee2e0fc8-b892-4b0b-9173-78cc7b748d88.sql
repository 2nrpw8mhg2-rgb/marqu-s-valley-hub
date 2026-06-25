
DO $$ BEGIN
  CREATE TYPE public.biblioteca_keyword_origem AS ENUM ('manual', 'ia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.biblioteca_especialidade_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  especialidade_id uuid NOT NULL REFERENCES public.biblioteca_especialidades(id) ON DELETE CASCADE,
  termo text NOT NULL,
  tipo public.biblioteca_keyword_tipo NOT NULL DEFAULT 'positiva',
  peso numeric(5,2) NOT NULL DEFAULT 1.00,
  origem public.biblioteca_keyword_origem NOT NULL DEFAULT 'manual',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX biblioteca_especialidade_keywords_esp_idx
  ON public.biblioteca_especialidade_keywords(especialidade_id);
CREATE INDEX biblioteca_especialidade_keywords_termo_idx
  ON public.biblioteca_especialidade_keywords(lower(termo));
CREATE UNIQUE INDEX biblioteca_especialidade_keywords_uniq
  ON public.biblioteca_especialidade_keywords(especialidade_id, lower(termo), tipo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_especialidade_keywords TO authenticated;
GRANT ALL ON public.biblioteca_especialidade_keywords TO service_role;

ALTER TABLE public.biblioteca_especialidade_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biblioteca_especialidade_keywords_auth_all"
  ON public.biblioteca_especialidade_keywords
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER biblioteca_especialidade_keywords_set_updated_at
  BEFORE UPDATE ON public.biblioteca_especialidade_keywords
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
