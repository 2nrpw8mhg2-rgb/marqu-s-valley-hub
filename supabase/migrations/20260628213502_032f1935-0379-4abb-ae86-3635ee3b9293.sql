
-- 1. Drop auto-trigger
DROP TRIGGER IF EXISTS tg_orcamento_artigos_classificacao ON public.orcamento_artigos;
DROP FUNCTION IF EXISTS public.tg_criar_classificacao_artigo();

-- 2. Cleanup orphan classifications
DELETE FROM public.classificacao_artigos
WHERE estado = 'sem_classificacao' AND artigo_mestre_id IS NULL;

-- 3. New columns on classificacao_artigos
CREATE TYPE public.classificacao_metodo AS ENUM ('exato','aprendido','keyword_artigo','keyword_subesp','keyword_esp','manual','nenhum');

ALTER TABLE public.classificacao_artigos
  ADD COLUMN IF NOT EXISTS metodo_match public.classificacao_metodo NOT NULL DEFAULT 'nenhum',
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS candidatos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 4. orcamento_classificacao_run
CREATE TYPE public.classificacao_run_estado AS ENUM ('pendente','em_curso','concluido');

CREATE TABLE public.orcamento_classificacao_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  estado public.classificacao_run_estado NOT NULL DEFAULT 'pendente',
  iniciado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  iniciado_por UUID,
  total_artigos INT NOT NULL DEFAULT 0,
  auto_exato INT NOT NULL DEFAULT 0,
  auto_aprendido INT NOT NULL DEFAULT 0,
  parcial INT NOT NULL DEFAULT 0,
  sem_classificacao INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_run_orcamento ON public.orcamento_classificacao_run(orcamento_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_classificacao_run TO authenticated;
GRANT ALL ON public.orcamento_classificacao_run TO service_role;

ALTER TABLE public.orcamento_classificacao_run ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage runs"
  ON public.orcamento_classificacao_run FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_run_updated_at
  BEFORE UPDATE ON public.orcamento_classificacao_run
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. classificacao_memoria (lookup descricao_normalizada → artigo mestre)
CREATE TABLE public.classificacao_memoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao_normalizada TEXT NOT NULL,
  artigo_mestre_id UUID NOT NULL REFERENCES public.biblioteca_artigos(id) ON DELETE CASCADE,
  ocorrencias INT NOT NULL DEFAULT 1,
  ultimo_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (descricao_normalizada)
);

CREATE INDEX idx_memoria_descricao ON public.classificacao_memoria(descricao_normalizada);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classificacao_memoria TO authenticated;
GRANT ALL ON public.classificacao_memoria TO service_role;

ALTER TABLE public.classificacao_memoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage memoria"
  ON public.classificacao_memoria FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_memoria_updated_at
  BEFORE UPDATE ON public.classificacao_memoria
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Helper function to normalize descriptions (lowercase + strip accents + collapse whitespace)
CREATE OR REPLACE FUNCTION public.normalizar_descricao(_t TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(translate(coalesce(_t,''),
    'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaaeeeeiiiiooooouuuucnAAAAAAEEEEIIIIOOOOOUUUUCN')),
    '\s+', ' ', 'g'
  );
$$;
