
CREATE TYPE public.procurement_pacote_estado AS ENUM ('por_preparar','preparado','enviado','em_analise','adjudicado','cancelado');

CREATE TABLE public.procurement_pacotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  nome text NOT NULL,
  especialidade text NOT NULL,
  estado public.procurement_pacote_estado NOT NULL DEFAULT 'por_preparar',
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_pacotes TO authenticated;
GRANT ALL ON public.procurement_pacotes TO service_role;

ALTER TABLE public.procurement_pacotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "procurement_pacotes_auth_all"
ON public.procurement_pacotes FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX procurement_pacotes_orc_idx ON public.procurement_pacotes(orcamento_id);
CREATE INDEX procurement_pacotes_obra_idx ON public.procurement_pacotes(obra_id);

CREATE TRIGGER procurement_pacotes_set_updated_at
BEFORE UPDATE ON public.procurement_pacotes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.procurement_pacote_artigos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pacote_id uuid NOT NULL REFERENCES public.procurement_pacotes(id) ON DELETE CASCADE,
  artigo_id uuid REFERENCES public.orcamento_artigos(id) ON DELETE SET NULL,
  codigo text,
  descricao text NOT NULL,
  unidade text,
  quantidade numeric(14,4) NOT NULL DEFAULT 0,
  capitulo text,
  subcapitulo text,
  preco_seco_estimado numeric(14,4) NOT NULL DEFAULT 0,
  categoria_custo text,
  especialidade text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_pacote_artigos TO authenticated;
GRANT ALL ON public.procurement_pacote_artigos TO service_role;

ALTER TABLE public.procurement_pacote_artigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "procurement_pacote_artigos_auth_all"
ON public.procurement_pacote_artigos FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX procurement_pacote_artigos_pac_idx ON public.procurement_pacote_artigos(pacote_id);
CREATE INDEX procurement_pacote_artigos_art_idx ON public.procurement_pacote_artigos(artigo_id);
