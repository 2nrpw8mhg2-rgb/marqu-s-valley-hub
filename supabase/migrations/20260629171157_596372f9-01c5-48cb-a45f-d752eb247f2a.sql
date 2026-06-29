
ALTER TYPE biblioteca_conhecimento_origem ADD VALUE IF NOT EXISTS 'mapas_quantidades';
ALTER TYPE biblioteca_conhecimento_origem ADD VALUE IF NOT EXISTS 'biblioteca_mestra';

ALTER TABLE public.biblioteca_artigo_conhecimento
  ADD COLUMN IF NOT EXISTS ocorrencias integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS justificacao text,
  ADD COLUMN IF NOT EXISTS exemplos jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.biblioteca_knowledge_run
  ADD COLUMN IF NOT EXISTS resumo jsonb;
