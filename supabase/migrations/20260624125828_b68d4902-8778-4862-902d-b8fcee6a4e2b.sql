ALTER TABLE public.procurement_pacotes ADD COLUMN IF NOT EXISTS grupo_consulta text;
CREATE INDEX IF NOT EXISTS idx_procurement_pacotes_grupo ON public.procurement_pacotes(grupo_consulta);