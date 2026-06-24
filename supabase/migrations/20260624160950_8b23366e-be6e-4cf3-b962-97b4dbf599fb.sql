
CREATE TABLE public.documento_pastas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.documento_pastas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  is_root boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX documento_pastas_obra_idx ON public.documento_pastas(obra_id);
CREATE INDEX documento_pastas_parent_idx ON public.documento_pastas(parent_id);
CREATE UNIQUE INDEX documento_pastas_unique_root ON public.documento_pastas(obra_id) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX documento_pastas_unique_child ON public.documento_pastas(parent_id, lower(nome)) WHERE parent_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_pastas TO authenticated;
GRANT ALL ON public.documento_pastas TO service_role;

ALTER TABLE public.documento_pastas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documento_pastas_auth_all" ON public.documento_pastas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER documento_pastas_updated_at
  BEFORE UPDATE ON public.documento_pastas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.documentos
  ADD COLUMN pasta_id uuid REFERENCES public.documento_pastas(id) ON DELETE SET NULL;
CREATE INDEX documentos_pasta_idx ON public.documentos(pasta_id);

CREATE OR REPLACE FUNCTION public.criar_pastas_padrao_obra(_obra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _root_id uuid;
  _obra_nome text;
  _pasta text;
  _defaults text[] := ARRAY[
    'Arquitetura','Especialidades','Mapa de Quantidades','Caderno de Encargos',
    'Licenciamento','Orçamentos - Sub-empreiteiros','Procurement','Contratos',
    'Fotografias','Elementos de Concurso','Proposta de Custo','Proposta de Cliente',
    'Documentação','Elementos de Apoio','Outros'
  ];
BEGIN
  SELECT nome INTO _obra_nome FROM public.obras WHERE id = _obra_id;
  IF _obra_nome IS NULL THEN RETURN; END IF;

  SELECT id INTO _root_id FROM public.documento_pastas
    WHERE obra_id = _obra_id AND parent_id IS NULL LIMIT 1;
  IF _root_id IS NULL THEN
    INSERT INTO public.documento_pastas(obra_id, parent_id, nome, is_root, is_default)
    VALUES (_obra_id, NULL, 'Obra - ' || _obra_nome, true, true)
    RETURNING id INTO _root_id;
  END IF;

  FOREACH _pasta IN ARRAY _defaults LOOP
    INSERT INTO public.documento_pastas(obra_id, parent_id, nome, is_default)
    SELECT _obra_id, _root_id, _pasta, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.documento_pastas
      WHERE parent_id = _root_id AND lower(nome) = lower(_pasta)
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_obra_pastas_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.criar_pastas_padrao_obra(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER obras_criar_pastas_padrao
  AFTER INSERT ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.tg_obra_pastas_padrao();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.obras LOOP
    PERFORM public.criar_pastas_padrao_obra(r.id);
  END LOOP;
END $$;
