
-- Índice único para evitar termos duplicados por artigo+tipo
CREATE UNIQUE INDEX IF NOT EXISTS biblioteca_artigo_conhecimento_uniq
  ON public.biblioteca_artigo_conhecimento (artigo_mestre_id, tipo, lower(termo));

-- Tabela de runs
CREATE TABLE IF NOT EXISTS public.biblioteca_knowledge_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_tipo text NOT NULL CHECK (scope_tipo IN ('especialidade','subespecialidade','artigo')),
  scope_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  modo text NOT NULL CHECK (modo IN ('manter','novos','regenerar')),
  estado text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','em_curso','concluido','cancelado','erro')),
  total_artigos integer NOT NULL DEFAULT 0,
  processados integer NOT NULL DEFAULT 0,
  saltados integer NOT NULL DEFAULT 0,
  falhados integer NOT NULL DEFAULT 0,
  counts jsonb NOT NULL DEFAULT '{"palavra_chave":0,"sinonimo":0,"expressao":0,"material":0,"termo_negativo":0}'::jsonb,
  ultimo_artigo text,
  log jsonb NOT NULL DEFAULT '[]'::jsonb,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  iniciado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  erro_msg text,
  cancelar boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.biblioteca_knowledge_run TO authenticated;
GRANT ALL ON public.biblioteca_knowledge_run TO service_role;

ALTER TABLE public.biblioteca_knowledge_run ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_run_select_owner_or_admin" ON public.biblioteca_knowledge_run
  FOR SELECT TO authenticated
  USING (iniciado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kb_run_insert_self" ON public.biblioteca_knowledge_run
  FOR INSERT TO authenticated
  WITH CHECK (iniciado_por = auth.uid());

CREATE POLICY "kb_run_update_owner_or_admin" ON public.biblioteca_knowledge_run
  FOR UPDATE TO authenticated
  USING (iniciado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (iniciado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_biblioteca_knowledge_run_updated_at
  BEFORE UPDATE ON public.biblioteca_knowledge_run
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS biblioteca_knowledge_run_iniciado_por_idx
  ON public.biblioteca_knowledge_run (iniciado_por, created_at DESC);
