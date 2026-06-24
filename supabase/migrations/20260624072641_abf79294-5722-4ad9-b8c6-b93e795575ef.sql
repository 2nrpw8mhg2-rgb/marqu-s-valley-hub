-- ============== ENUMs ==============
CREATE TYPE public.orcamento_estado AS ENUM (
  'rascunho', 'enviado', 'adjudicado', 'perdido', 'cancelado'
);

-- ============== ORCAMENTOS ==============
CREATE TABLE public.orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  versao integer NOT NULL DEFAULT 1,
  nome text NOT NULL,
  estado public.orcamento_estado NOT NULL DEFAULT 'rascunho',
  observacoes text,
  margem_global_pct numeric(6,2) NOT NULL DEFAULT 0,
  data_envio date,
  data_decisao date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, versao)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos TO authenticated;
GRANT ALL ON public.orcamentos TO service_role;

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY orcamentos_auth_all ON public.orcamentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER orcamentos_set_updated_at
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX orcamentos_obra_idx ON public.orcamentos(obra_id);

-- ============== CAPITULOS ==============
CREATE TABLE public.orcamento_capitulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  codigo text,
  descricao text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_capitulos TO authenticated;
GRANT ALL ON public.orcamento_capitulos TO service_role;

ALTER TABLE public.orcamento_capitulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY orcamento_capitulos_auth_all ON public.orcamento_capitulos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX orcamento_capitulos_orc_idx ON public.orcamento_capitulos(orcamento_id);

-- ============== ARTIGOS ==============
CREATE TABLE public.orcamento_artigos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  capitulo_id uuid REFERENCES public.orcamento_capitulos(id) ON DELETE SET NULL,
  codigo text,
  descricao text NOT NULL,
  unidade text,
  quantidade numeric(14,4) NOT NULL DEFAULT 0,
  preco_unitario numeric(14,4) NOT NULL DEFAULT 0,
  margem_pct numeric(6,2) NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_artigos TO authenticated;
GRANT ALL ON public.orcamento_artigos TO service_role;

ALTER TABLE public.orcamento_artigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY orcamento_artigos_auth_all ON public.orcamento_artigos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX orcamento_artigos_orc_idx ON public.orcamento_artigos(orcamento_id);
CREATE INDEX orcamento_artigos_cap_idx ON public.orcamento_artigos(capitulo_id);

-- ============== BIBLIOTECA DE ARTIGOS ==============
CREATE TABLE public.artigos_biblioteca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text,
  descricao text NOT NULL,
  unidade text,
  especialidade text,
  preco_referencia numeric(14,4),
  ultima_obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  utilizacoes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artigos_biblioteca TO authenticated;
GRANT ALL ON public.artigos_biblioteca TO service_role;

ALTER TABLE public.artigos_biblioteca ENABLE ROW LEVEL SECURITY;

CREATE POLICY artigos_biblioteca_auth_all ON public.artigos_biblioteca
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER artigos_biblioteca_set_updated_at
  BEFORE UPDATE ON public.artigos_biblioteca
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX artigos_biblioteca_desc_idx ON public.artigos_biblioteca USING gin (to_tsvector('portuguese', descricao));
CREATE INDEX artigos_biblioteca_especialidade_idx ON public.artigos_biblioteca(especialidade);