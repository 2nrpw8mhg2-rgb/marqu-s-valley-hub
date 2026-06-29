
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$ BEGIN
  CREATE TYPE public.biblioteca_conhecimento_tipo AS ENUM (
    'palavra_chave', 'sinonimo', 'expressao', 'material', 'termo_negativo'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.biblioteca_conhecimento_origem AS ENUM (
    'ia', 'utilizador', 'sistema', 'importacao'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.biblioteca_artigo_conhecimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artigo_mestre_id uuid NOT NULL REFERENCES public.biblioteca_artigos(id) ON DELETE CASCADE,
  tipo public.biblioteca_conhecimento_tipo NOT NULL,
  termo text NOT NULL CHECK (length(btrim(termo)) > 0),
  peso integer NOT NULL DEFAULT 10,
  origem public.biblioteca_conhecimento_origem NOT NULL DEFAULT 'utilizador',
  confianca numeric(5,2) NOT NULL DEFAULT 100 CHECK (confianca >= 0 AND confianca <= 100),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX biblioteca_artigo_conhecimento_uniq
  ON public.biblioteca_artigo_conhecimento (artigo_mestre_id, tipo, lower(termo));

CREATE INDEX biblioteca_artigo_conhecimento_artigo_idx
  ON public.biblioteca_artigo_conhecimento (artigo_mestre_id);
CREATE INDEX biblioteca_artigo_conhecimento_tipo_idx
  ON public.biblioteca_artigo_conhecimento (tipo);
CREATE INDEX biblioteca_artigo_conhecimento_ativo_idx
  ON public.biblioteca_artigo_conhecimento (ativo);
CREATE INDEX biblioteca_artigo_conhecimento_lookup_idx
  ON public.biblioteca_artigo_conhecimento (artigo_mestre_id, tipo, ativo);
CREATE INDEX biblioteca_artigo_conhecimento_termo_trgm
  ON public.biblioteca_artigo_conhecimento USING gin (lower(termo) gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_artigo_conhecimento TO authenticated;
GRANT ALL ON public.biblioteca_artigo_conhecimento TO service_role;

ALTER TABLE public.biblioteca_artigo_conhecimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biblioteca_conhecimento_auth_all"
  ON public.biblioteca_artigo_conhecimento
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER biblioteca_artigo_conhecimento_set_updated_at
  BEFORE UPDATE ON public.biblioteca_artigo_conhecimento
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
