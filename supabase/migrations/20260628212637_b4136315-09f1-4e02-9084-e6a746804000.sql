
CREATE TYPE public.classificacao_estado AS ENUM ('classificado_auto','necessita_revisao','sem_classificacao','validado');

CREATE TABLE public.classificacao_artigos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artigo_origem_id UUID NOT NULL UNIQUE REFERENCES public.orcamento_artigos(id) ON DELETE CASCADE,
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  descricao_original TEXT NOT NULL,
  unidade_original TEXT,
  quantidade_original NUMERIC,
  especialidade_id UUID REFERENCES public.biblioteca_especialidades(id) ON DELETE SET NULL,
  subespecialidade_id UUID REFERENCES public.biblioteca_subespecialidades(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES public.biblioteca_categorias(id) ON DELETE SET NULL,
  artigo_mestre_id UUID REFERENCES public.biblioteca_artigos(id) ON DELETE SET NULL,
  confianca INT NOT NULL DEFAULT 0,
  estado public.classificacao_estado NOT NULL DEFAULT 'sem_classificacao',
  validado_por UUID,
  validado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_classificacao_orcamento ON public.classificacao_artigos(orcamento_id);
CREATE INDEX idx_classificacao_estado ON public.classificacao_artigos(estado);
CREATE INDEX idx_classificacao_artigo_mestre ON public.classificacao_artigos(artigo_mestre_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classificacao_artigos TO authenticated;
GRANT ALL ON public.classificacao_artigos TO service_role;

ALTER TABLE public.classificacao_artigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage classificacoes"
  ON public.classificacao_artigos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER set_classificacao_artigos_updated_at
  BEFORE UPDATE ON public.classificacao_artigos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create classification row when an orcamento_artigo is inserted
CREATE OR REPLACE FUNCTION public.tg_criar_classificacao_artigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _match_count INT;
  _artigo_mestre RECORD;
BEGIN
  -- Try exact case-insensitive description match against biblioteca_artigos
  SELECT COUNT(*) INTO _match_count
  FROM public.biblioteca_artigos
  WHERE lower(descricao) = lower(NEW.descricao) AND ativo = true;

  IF _match_count = 1 THEN
    SELECT id, subespecialidade_id, categoria_id INTO _artigo_mestre
    FROM public.biblioteca_artigos
    WHERE lower(descricao) = lower(NEW.descricao) AND ativo = true
    LIMIT 1;

    INSERT INTO public.classificacao_artigos (
      artigo_origem_id, orcamento_id, descricao_original, unidade_original, quantidade_original,
      artigo_mestre_id, categoria_id, subespecialidade_id, especialidade_id,
      confianca, estado
    )
    SELECT NEW.id, NEW.orcamento_id, NEW.descricao, NEW.unidade, NEW.quantidade,
           _artigo_mestre.id, _artigo_mestre.categoria_id, _artigo_mestre.subespecialidade_id,
           s.especialidade_id,
           100, 'classificado_auto'::public.classificacao_estado
    FROM public.biblioteca_subespecialidades s
    WHERE s.id = _artigo_mestre.subespecialidade_id;
  ELSE
    INSERT INTO public.classificacao_artigos (
      artigo_origem_id, orcamento_id, descricao_original, unidade_original, quantidade_original,
      confianca, estado
    ) VALUES (
      NEW.id, NEW.orcamento_id, NEW.descricao, NEW.unidade, NEW.quantidade,
      0, 'sem_classificacao'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_orcamento_artigos_classificacao
  AFTER INSERT ON public.orcamento_artigos
  FOR EACH ROW EXECUTE FUNCTION public.tg_criar_classificacao_artigo();

-- Backfill for existing artigos
INSERT INTO public.classificacao_artigos (artigo_origem_id, orcamento_id, descricao_original, unidade_original, quantidade_original, confianca, estado)
SELECT oa.id, oa.orcamento_id, oa.descricao, oa.unidade, oa.quantidade, 0, 'sem_classificacao'
FROM public.orcamento_artigos oa
LEFT JOIN public.classificacao_artigos ca ON ca.artigo_origem_id = oa.id
WHERE ca.id IS NULL;
