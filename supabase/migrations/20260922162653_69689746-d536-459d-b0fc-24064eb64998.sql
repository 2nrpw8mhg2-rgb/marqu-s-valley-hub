CREATE TABLE public.consulta_ia_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE,
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'em_curso',
  modelo text,
  total_artigos integer NOT NULL DEFAULT 0,
  processados integer NOT NULL DEFAULT 0,
  atribuidos integer NOT NULL DEFAULT 0,
  revisao integer NOT NULL DEFAULT 0,
  erro text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consulta_ia_runs TO authenticated;
GRANT ALL ON public.consulta_ia_runs TO service_role;
ALTER TABLE public.consulta_ia_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY consulta_ia_runs_auth_all ON public.consulta_ia_runs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.consulta_ia_classificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.consulta_ia_runs(id) ON DELETE SET NULL,
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  artigo_id uuid NOT NULL REFERENCES public.orcamento_artigos(id) ON DELETE CASCADE,
  subempreitada_id uuid REFERENCES public.subempreitadas(id) ON DELETE SET NULL,
  trabalho_principal text,
  confianca numeric NOT NULL DEFAULT 0,
  justificacao text,
  necessita_revisao boolean NOT NULL DEFAULT false,
  sugestao_nova_subempreitada text,
  validado_manual boolean NOT NULL DEFAULT false,
  validado_por uuid,
  validado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (orcamento_id, artigo_id)
);

CREATE INDEX idx_consulta_ia_class_orcamento ON public.consulta_ia_classificacoes(orcamento_id);
CREATE INDEX idx_consulta_ia_class_sub ON public.consulta_ia_classificacoes(subempreitada_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consulta_ia_classificacoes TO authenticated;
GRANT ALL ON public.consulta_ia_classificacoes TO service_role;
ALTER TABLE public.consulta_ia_classificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY consulta_ia_class_auth_all ON public.consulta_ia_classificacoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.consulta_ia_exemplos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  descricao_normalizada text NOT NULL,
  subempreitada_id uuid NOT NULL REFERENCES public.subempreitadas(id) ON DELETE CASCADE,
  trabalho_principal text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_consulta_ia_exemplos_sub ON public.consulta_ia_exemplos(subempreitada_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consulta_ia_exemplos TO authenticated;
GRANT ALL ON public.consulta_ia_exemplos TO service_role;
ALTER TABLE public.consulta_ia_exemplos ENABLE ROW LEVEL SECURITY;
CREATE POLICY consulta_ia_exemplos_auth_all ON public.consulta_ia_exemplos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_consulta_ia_runs_updated_at BEFORE UPDATE ON public.consulta_ia_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_consulta_ia_class_updated_at BEFORE UPDATE ON public.consulta_ia_classificacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_consulta_ia_exemplos_updated_at BEFORE UPDATE ON public.consulta_ia_exemplos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();