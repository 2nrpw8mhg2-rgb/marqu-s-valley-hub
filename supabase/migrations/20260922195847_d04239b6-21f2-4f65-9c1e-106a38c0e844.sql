CREATE TABLE IF NOT EXISTS public.consulta_ia_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.consulta_ia_runs(id) ON DELETE CASCADE,
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  indice integer NOT NULL,
  artigo_ids uuid[] NOT NULL DEFAULT '{}',
  estado text NOT NULL DEFAULT 'pendente',
  tentativas integer NOT NULL DEFAULT 0,
  erro text,
  classificados integer NOT NULL DEFAULT 0,
  ausentes integer NOT NULL DEFAULT 0,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consulta_ia_lotes_estado_chk CHECK (estado IN ('pendente','em_execucao','concluido','falhado')),
  CONSTRAINT consulta_ia_lotes_run_indice_uk UNIQUE (run_id, indice)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consulta_ia_lotes TO authenticated;
GRANT ALL ON public.consulta_ia_lotes TO service_role;

ALTER TABLE public.consulta_ia_lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consulta_ia_lotes_auth_all ON public.consulta_ia_lotes;
CREATE POLICY consulta_ia_lotes_auth_all ON public.consulta_ia_lotes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_consulta_ia_lotes_updated_at ON public.consulta_ia_lotes;
CREATE TRIGGER update_consulta_ia_lotes_updated_at
  BEFORE UPDATE ON public.consulta_ia_lotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS consulta_ia_lotes_run_estado_idx ON public.consulta_ia_lotes (run_id, estado);

CREATE UNIQUE INDEX IF NOT EXISTS consulta_ia_class_orc_artigo_uk
  ON public.consulta_ia_classificacoes (orcamento_id, artigo_id);