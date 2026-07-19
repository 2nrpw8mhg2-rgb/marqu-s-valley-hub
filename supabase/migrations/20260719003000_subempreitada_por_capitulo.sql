-- Regra opcional por capítulo/subcapítulo do mapa de quantidades.
-- Só deve ser preenchida quando o capítulo é contratualmente homogéneo.
ALTER TABLE public.orcamento_capitulos
  ADD COLUMN IF NOT EXISTS subempreitada_id uuid REFERENCES public.subempreitadas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subempreitada_validada_manual boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS orcamento_capitulos_subempreitada_idx
  ON public.orcamento_capitulos(subempreitada_id);
