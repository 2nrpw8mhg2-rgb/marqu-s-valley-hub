
-- Recreate biblioteca_artigo_estado_ia with only 3 official states
CREATE TYPE public.biblioteca_artigo_estado_ia_new AS ENUM ('validado','criado_auto','obsoleto');

ALTER TABLE public.biblioteca_artigos ALTER COLUMN estado_ia DROP DEFAULT;

ALTER TABLE public.biblioteca_artigos
  ALTER COLUMN estado_ia TYPE public.biblioteca_artigo_estado_ia_new
  USING (
    CASE estado_ia::text
      WHEN 'criado_auto' THEN 'criado_auto'
      ELSE 'validado'
    END
  )::public.biblioteca_artigo_estado_ia_new;

DROP TYPE public.biblioteca_artigo_estado_ia;
ALTER TYPE public.biblioteca_artigo_estado_ia_new RENAME TO biblioteca_artigo_estado_ia;

ALTER TABLE public.biblioteca_artigos
  ALTER COLUMN estado_ia SET DEFAULT 'validado'::public.biblioteca_artigo_estado_ia;
