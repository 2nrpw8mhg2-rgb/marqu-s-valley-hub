ALTER TABLE public.orcamento_artigos
  ADD COLUMN IF NOT EXISTS subempreitada_sugerida_id uuid REFERENCES public.subempreitadas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subempreitada_razao text,
  ADD COLUMN IF NOT EXISTS subempreitada_termos_match jsonb;

ALTER TABLE public.orcamento_artigos DROP CONSTRAINT IF EXISTS orcamento_artigos_subempreitada_origem_check;
ALTER TABLE public.orcamento_artigos
  ADD CONSTRAINT orcamento_artigos_subempreitada_origem_check
  CHECK (subempreitada_origem = ANY (ARRAY['artigo_mestre','regras','manual','ia','aprendizagem','baixa_confianca','conflito','sem_regra']));