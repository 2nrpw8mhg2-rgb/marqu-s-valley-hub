
-- Enums
CREATE TYPE public.biblioteca_artigo_tipo AS ENUM ('servico','material','equipamento','sistema','mao_obra','transporte','taxa_licenca','outros');
CREATE TYPE public.biblioteca_artigo_estado_ia AS ENUM ('validado','revisto','criado_auto','pendente');

-- Tabela de unidades
CREATE TABLE public.biblioteca_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  simbolo text NOT NULL,
  nome text NOT NULL,
  categoria text,
  ordem int NOT NULL DEFAULT 100,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.biblioteca_unidades TO authenticated;
GRANT ALL ON public.biblioteca_unidades TO service_role;

ALTER TABLE public.biblioteca_unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unidades_read_authenticated"
  ON public.biblioteca_unidades FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "unidades_admin_write"
  ON public.biblioteca_unidades FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER biblioteca_unidades_set_updated_at
  BEFORE UPDATE ON public.biblioteca_unidades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed de unidades
INSERT INTO public.biblioteca_unidades (codigo, simbolo, nome, categoria, ordem) VALUES
  ('un','un','Unidade','global',10),
  ('vg','vg','Valor global','global',20),
  ('lote','lote','Lote','global',30),
  ('cj','cj','Conjunto','global',40),
  ('par','par','Par','global',50),
  ('m','m','Metro','comprimento',60),
  ('ml','ml','Metro linear','comprimento',70),
  ('km','km','Quilómetro','comprimento',80),
  ('m2','m²','Metro quadrado','área',90),
  ('m3','m³','Metro cúbico','volume',100),
  ('l','l','Litro','volume',110),
  ('kg','kg','Quilograma','massa',120),
  ('t','t','Tonelada','massa',130),
  ('h','h','Hora','tempo',140),
  ('dia','dia','Dia','tempo',150),
  ('mes','mês','Mês','tempo',160);

-- Novas colunas em biblioteca_artigos
ALTER TABLE public.biblioteca_artigos
  ADD COLUMN tipo public.biblioteca_artigo_tipo NOT NULL DEFAULT 'outros',
  ADD COLUMN estado_ia public.biblioteca_artigo_estado_ia NOT NULL DEFAULT 'pendente',
  ADD COLUMN unidade_id uuid REFERENCES public.biblioteca_unidades(id) ON DELETE RESTRICT;

CREATE INDEX biblioteca_artigos_tipo_idx ON public.biblioteca_artigos(tipo);
CREATE INDEX biblioteca_artigos_estado_ia_idx ON public.biblioteca_artigos(estado_ia);
CREATE INDEX biblioteca_artigos_unidade_id_idx ON public.biblioteca_artigos(unidade_id);

-- Backfill: artigos atuais (criados manualmente) → estado_ia validado
UPDATE public.biblioteca_artigos SET estado_ia = 'validado';

-- Backfill unidade_id a partir do texto livre existente
UPDATE public.biblioteca_artigos a
SET unidade_id = u.id
FROM public.biblioteca_unidades u
WHERE a.unidade IS NOT NULL
  AND (lower(trim(a.unidade)) = lower(u.codigo) OR trim(a.unidade) = u.simbolo);

-- Para qualquer artigo ainda sem unidade_id, atribuir 'vg' (default histórico)
UPDATE public.biblioteca_artigos
SET unidade_id = (SELECT id FROM public.biblioteca_unidades WHERE codigo = 'vg')
WHERE unidade_id IS NULL;

ALTER TABLE public.biblioteca_artigos ALTER COLUMN unidade_id SET NOT NULL;

-- Trigger para manter a coluna 'unidade' (texto) em sincronia com unidade_id
CREATE OR REPLACE FUNCTION public.tg_artigo_unidade_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT codigo INTO NEW.unidade FROM public.biblioteca_unidades WHERE id = NEW.unidade_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_artigo_unidade_sync
  BEFORE INSERT OR UPDATE OF unidade_id ON public.biblioteca_artigos
  FOR EACH ROW EXECUTE FUNCTION public.tg_artigo_unidade_sync();

-- Reaplicar sync no histórico
UPDATE public.biblioteca_artigos SET unidade_id = unidade_id;
