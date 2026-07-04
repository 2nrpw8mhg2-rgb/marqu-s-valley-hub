ALTER TABLE public.orcamento_artigos
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_orcamento_artigos_updated_at ON public.orcamento_artigos;
CREATE TRIGGER set_orcamento_artigos_updated_at
BEFORE UPDATE ON public.orcamento_artigos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();