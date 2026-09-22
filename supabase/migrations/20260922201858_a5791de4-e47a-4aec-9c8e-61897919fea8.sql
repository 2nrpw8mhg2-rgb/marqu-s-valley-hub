ALTER TABLE public.consulta_ia_classificacoes
  ADD COLUMN IF NOT EXISTS subempreitada_ia_id uuid REFERENCES public.subempreitadas(id),
  ADD COLUMN IF NOT EXISTS confianca_ia numeric;

UPDATE public.consulta_ia_classificacoes
SET subempreitada_ia_id = COALESCE(subempreitada_ia_id, subempreitada_id),
    confianca_ia = COALESCE(confianca_ia, confianca)
WHERE subempreitada_ia_id IS NULL OR confianca_ia IS NULL;

CREATE TABLE IF NOT EXISTS public.consulta_ia_revisao_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL,
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.consulta_ia_runs(id) ON DELETE SET NULL,
  artigo_id uuid NOT NULL REFERENCES public.orcamento_artigos(id) ON DELETE CASCADE,
  codigo_original text,
  descricao_original text NOT NULL,
  subempreitada_ia_id uuid REFERENCES public.subempreitadas(id),
  sugestao_nova_subempreitada text,
  confianca_ia numeric,
  subempreitada_atribuida_id uuid NOT NULL REFERENCES public.subempreitadas(id),
  estado_anterior jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (operacao_id, artigo_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consulta_ia_revisao_auditoria TO authenticated;
GRANT ALL ON public.consulta_ia_revisao_auditoria TO service_role;

ALTER TABLE public.consulta_ia_revisao_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_consulta_ia_revisao_auditoria"
ON public.consulta_ia_revisao_auditoria FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_revisao_auditoria_orcamento ON public.consulta_ia_revisao_auditoria(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_revisao_auditoria_operacao ON public.consulta_ia_revisao_auditoria(operacao_id);

CREATE TRIGGER set_updated_at_consulta_ia_revisao_auditoria
BEFORE UPDATE ON public.consulta_ia_revisao_auditoria
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();