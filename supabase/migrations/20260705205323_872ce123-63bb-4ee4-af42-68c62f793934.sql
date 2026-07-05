
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE TABLE IF NOT EXISTS public.biblioteca_artigo_qualidade (
  artigo_id uuid PRIMARY KEY REFERENCES public.biblioteca_artigos(id) ON DELETE CASCADE,
  score_qualidade numeric NOT NULL DEFAULT 0,
  completude numeric NOT NULL DEFAULT 0,
  n_palavras_chave integer NOT NULL DEFAULT 0,
  n_sinonimos integer NOT NULL DEFAULT 0,
  n_expressoes integer NOT NULL DEFAULT 0,
  n_materiais integer NOT NULL DEFAULT 0,
  n_negativos integer NOT NULL DEFAULT 0,
  n_exemplos integer NOT NULL DEFAULT 0,
  n_relacoes integer NOT NULL DEFAULT 0,
  n_utilizacoes integer NOT NULL DEFAULT 0,
  n_classif_auto integer NOT NULL DEFAULT 0,
  n_validacoes_humanas integer NOT NULL DEFAULT 0,
  ultima_auditoria timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_artigo_qualidade TO authenticated;
GRANT ALL ON public.biblioteca_artigo_qualidade TO service_role;
ALTER TABLE public.biblioteca_artigo_qualidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm_qualidade_read" ON public.biblioteca_artigo_qualidade FOR SELECT TO authenticated USING (true);
CREATE POLICY "bm_qualidade_write" ON public.biblioteca_artigo_qualidade FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.biblioteca_auditoria_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciado_por uuid REFERENCES auth.users(id),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  estado text NOT NULL DEFAULT 'em_curso' CHECK (estado IN ('em_curso','concluido','erro')),
  ambito jsonb NOT NULL DEFAULT '{}'::jsonb,
  resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  erro_msg text
);
GRANT SELECT, INSERT, UPDATE ON public.biblioteca_auditoria_run TO authenticated;
GRANT ALL ON public.biblioteca_auditoria_run TO service_role;
ALTER TABLE public.biblioteca_auditoria_run ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm_audit_read" ON public.biblioteca_auditoria_run FOR SELECT TO authenticated USING (true);
CREATE POLICY "bm_audit_write" ON public.biblioteca_auditoria_run FOR INSERT TO authenticated WITH CHECK (auth.uid() = iniciado_por);
CREATE POLICY "bm_audit_update" ON public.biblioteca_auditoria_run FOR UPDATE TO authenticated USING (auth.uid() = iniciado_por);

CREATE TABLE IF NOT EXISTS public.biblioteca_sugestao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artigo_id uuid REFERENCES public.biblioteca_artigos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('reclassificar','fundir','renomear','nova_relacao','novo_conhecimento','remover')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  justificacao text,
  confianca numeric,
  origem text NOT NULL DEFAULT 'ia' CHECK (origem IN ('ia','regra','utilizador','auditoria')),
  estado text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','aceite','rejeitada','expirada')),
  criado_por uuid REFERENCES auth.users(id),
  revisto_por uuid REFERENCES auth.users(id),
  revisto_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bm_sugestao_estado ON public.biblioteca_sugestao(estado);
CREATE INDEX IF NOT EXISTS idx_bm_sugestao_artigo ON public.biblioteca_sugestao(artigo_id);
GRANT SELECT, INSERT, UPDATE ON public.biblioteca_sugestao TO authenticated;
GRANT ALL ON public.biblioteca_sugestao TO service_role;
ALTER TABLE public.biblioteca_sugestao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm_sugestao_read" ON public.biblioteca_sugestao FOR SELECT TO authenticated USING (true);
CREATE POLICY "bm_sugestao_insert" ON public.biblioteca_sugestao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bm_sugestao_update" ON public.biblioteca_sugestao FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_bm_sugestao_updated BEFORE UPDATE ON public.biblioteca_sugestao FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.biblioteca_aprendizagem_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artigo_id uuid REFERENCES public.biblioteca_artigos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  origem text NOT NULL DEFAULT 'utilizador',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  autor uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bm_aprendizagem_artigo ON public.biblioteca_aprendizagem_evento(artigo_id);
GRANT SELECT, INSERT ON public.biblioteca_aprendizagem_evento TO authenticated;
GRANT ALL ON public.biblioteca_aprendizagem_evento TO service_role;
ALTER TABLE public.biblioteca_aprendizagem_evento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm_aprend_read" ON public.biblioteca_aprendizagem_evento FOR SELECT TO authenticated USING (true);
CREATE POLICY "bm_aprend_insert" ON public.biblioteca_aprendizagem_evento FOR INSERT TO authenticated WITH CHECK (auth.uid() = autor);

CREATE INDEX IF NOT EXISTS idx_bm_conhecimento_tipo ON public.biblioteca_artigo_conhecimento(tipo);
CREATE INDEX IF NOT EXISTS idx_bm_conhecimento_origem ON public.biblioteca_artigo_conhecimento(origem);
