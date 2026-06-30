
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS mq_documento_id uuid REFERENCES public.documentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mq_revisao text,
  ADD COLUMN IF NOT EXISTS wizard_passo smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'rascunho_tecnico';

ALTER TABLE public.orcamento_artigos
  ADD COLUMN IF NOT EXISTS unidade_normalizada text;

CREATE OR REPLACE FUNCTION public.tg_orc_artigo_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tipo text;
BEGIN
  SELECT tipo INTO _tipo FROM public.orcamentos WHERE id = OLD.orcamento_id;
  IF _tipo = 'rascunho_tecnico' THEN
    IF NEW.codigo IS DISTINCT FROM OLD.codigo
       OR NEW.descricao IS DISTINCT FROM OLD.descricao
       OR NEW.unidade IS DISTINCT FROM OLD.unidade
       OR NEW.quantidade IS DISTINCT FROM OLD.quantidade
       OR NEW.notas IS DISTINCT FROM OLD.notas THEN
      RAISE EXCEPTION 'Os campos codigo, descricao, unidade, quantidade e notas do MQT original não podem ser alterados num rascunho técnico.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orcamento_artigos_imutavel ON public.orcamento_artigos;
CREATE TRIGGER orcamento_artigos_imutavel
  BEFORE UPDATE ON public.orcamento_artigos
  FOR EACH ROW EXECUTE FUNCTION public.tg_orc_artigo_imutavel();
