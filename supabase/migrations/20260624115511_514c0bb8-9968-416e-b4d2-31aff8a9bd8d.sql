
ALTER TABLE public.subempreiteiros
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS distrito text,
  ADD COLUMN IF NOT EXISTS concelho text,
  ADD COLUMN IF NOT EXISTS emails text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS telefones text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS alvara_valido_ate date,
  ADD COLUMN IF NOT EXISTS seguro_valido_ate date;

CREATE UNIQUE INDEX IF NOT EXISTS subempreiteiros_nif_unique
  ON public.subempreiteiros (nif) WHERE nif IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subempreiteiros_email_unique
  ON public.subempreiteiros (lower(email)) WHERE email IS NOT NULL;
