
-- Add cost decomposition columns to orcamento_artigos
ALTER TABLE public.orcamento_artigos
  ADD COLUMN IF NOT EXISTS custo_mao_obra numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_tarefeiros numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_subempreitadas numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_materiais numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_equipamentos numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_transportes numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_encargos_gerais numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_outros numeric NOT NULL DEFAULT 0;

-- Sources / proposals attached to each artigo
CREATE TABLE IF NOT EXISTS public.orcamento_artigo_fontes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artigo_id uuid NOT NULL REFERENCES public.orcamento_artigos(id) ON DELETE CASCADE,
  categoria text NOT NULL CHECK (categoria IN ('mao_obra','tarefeiros','subempreitadas','materiais','equipamentos','transportes','encargos_gerais','outros')),
  subempreiteiro_id uuid REFERENCES public.subempreiteiros(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  selecionado boolean NOT NULL DEFAULT false,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_artigo_fontes TO authenticated;
GRANT ALL ON public.orcamento_artigo_fontes TO service_role;

ALTER TABLE public.orcamento_artigo_fontes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users full access to fontes"
  ON public.orcamento_artigo_fontes FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_fontes_artigo ON public.orcamento_artigo_fontes(artigo_id);

CREATE TRIGGER trg_fontes_updated_at
  BEFORE UPDATE ON public.orcamento_artigo_fontes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
