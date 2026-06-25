
-- =====================================================
-- Fase 3 — Biblioteca Mestra: Categorias
-- =====================================================

-- 1. Nova tabela biblioteca_categorias
CREATE TABLE public.biblioteca_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subespecialidade_id uuid NOT NULL REFERENCES public.biblioteca_subespecialidades(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  codigo text,
  descricao text,
  ordem integer NOT NULL DEFAULT 10,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subespecialidade_id, nome)
);

CREATE INDEX idx_biblioteca_categorias_subesp ON public.biblioteca_categorias(subespecialidade_id);
CREATE INDEX idx_biblioteca_categorias_ordem ON public.biblioteca_categorias(subespecialidade_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_categorias TO authenticated;
GRANT ALL ON public.biblioteca_categorias TO service_role;

ALTER TABLE public.biblioteca_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler categorias" ON public.biblioteca_categorias
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem criar categorias" ON public.biblioteca_categorias
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem editar categorias" ON public.biblioteca_categorias
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem eliminar categorias" ON public.biblioteca_categorias
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_biblioteca_categorias_updated_at
  BEFORE UPDATE ON public.biblioteca_categorias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Trigger que protege a categoria "Por Classificar"
CREATE OR REPLACE FUNCTION public.tg_proteger_por_classificar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.nome = 'Por Classificar' AND OLD.ordem = 0 THEN
      RAISE EXCEPTION 'A categoria "Por Classificar" não pode ser eliminada.';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.nome = 'Por Classificar' AND OLD.ordem = 0 THEN
      IF NEW.nome <> 'Por Classificar' OR NEW.subespecialidade_id <> OLD.subespecialidade_id OR NEW.ordem <> 0 THEN
        RAISE EXCEPTION 'A categoria "Por Classificar" não pode ser renomeada, movida ou reordenada.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_proteger_por_classificar
  BEFORE UPDATE OR DELETE ON public.biblioteca_categorias
  FOR EACH ROW EXECUTE FUNCTION public.tg_proteger_por_classificar();

-- 3. Auto-criar "Por Classificar" para cada nova subespecialidade
CREATE OR REPLACE FUNCTION public.tg_subesp_por_classificar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.biblioteca_categorias (subespecialidade_id, nome, codigo, descricao, ordem, ativa)
  VALUES (NEW.id, 'Por Classificar', COALESCE(NEW.codigo, '') || '.00', 'Categoria automática para artigos ainda não organizados', 0, true)
  ON CONFLICT (subespecialidade_id, nome) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subesp_por_classificar
  AFTER INSERT ON public.biblioteca_subespecialidades
  FOR EACH ROW EXECUTE FUNCTION public.tg_subesp_por_classificar();

-- 4. Seed: criar "Por Classificar" em todas as subespecialidades existentes
INSERT INTO public.biblioteca_categorias (subespecialidade_id, nome, codigo, descricao, ordem, ativa)
SELECT id, 'Por Classificar', COALESCE(codigo, '') || '.00', 'Categoria automática para artigos ainda não organizados', 0, true
FROM public.biblioteca_subespecialidades
ON CONFLICT (subespecialidade_id, nome) DO NOTHING;

-- 5. Adicionar categoria_id em biblioteca_artigos
ALTER TABLE public.biblioteca_artigos
  ADD COLUMN categoria_id uuid REFERENCES public.biblioteca_categorias(id) ON DELETE RESTRICT;

-- Backfill: mover artigos existentes para a "Por Classificar" da sua subespecialidade
UPDATE public.biblioteca_artigos a
SET categoria_id = c.id
FROM public.biblioteca_categorias c
WHERE a.categoria_id IS NULL
  AND c.subespecialidade_id = a.subespecialidade_id
  AND c.nome = 'Por Classificar'
  AND c.ordem = 0;

ALTER TABLE public.biblioteca_artigos
  ALTER COLUMN categoria_id SET NOT NULL;

CREATE INDEX idx_biblioteca_artigos_categoria ON public.biblioteca_artigos(categoria_id);

-- 6. Trigger de coerência: categoria.subespecialidade_id deve coincidir com artigo.subespecialidade_id
CREATE OR REPLACE FUNCTION public.tg_artigo_categoria_coerencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cat_subesp uuid;
BEGIN
  SELECT subespecialidade_id INTO _cat_subesp
  FROM public.biblioteca_categorias
  WHERE id = NEW.categoria_id;

  IF _cat_subesp IS NULL THEN
    RAISE EXCEPTION 'Categoria % não encontrada.', NEW.categoria_id;
  END IF;

  IF NEW.subespecialidade_id <> _cat_subesp THEN
    -- Alinhar automaticamente a subespecialidade do artigo com a da categoria
    NEW.subespecialidade_id := _cat_subesp;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_artigo_categoria_coerencia
  BEFORE INSERT OR UPDATE ON public.biblioteca_artigos
  FOR EACH ROW EXECUTE FUNCTION public.tg_artigo_categoria_coerencia();
