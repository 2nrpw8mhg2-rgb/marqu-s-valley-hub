ALTER TYPE public.procurement_pacote_estado ADD VALUE IF NOT EXISTS 'em_preparacao';
ALTER TYPE public.procurement_pacote_estado ADD VALUE IF NOT EXISTS 'pronto_envio';

ALTER TABLE public.procurement_pacotes ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.procurement_pacote_ambito (
  pacote_id uuid PRIMARY KEY REFERENCES public.procurement_pacotes(id) ON DELETE CASCADE,
  ambito_geral text NOT NULL DEFAULT '',
  responsabilidades_mv text NOT NULL DEFAULT '',
  responsabilidades_subempreiteiro text NOT NULL DEFAULT '',
  inclusoes text NOT NULL DEFAULT '',
  exclusoes text NOT NULL DEFAULT '',
  alternativas text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_pacote_ambito TO authenticated;
GRANT ALL ON public.procurement_pacote_ambito TO service_role;
ALTER TABLE public.procurement_pacote_ambito ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ambito_perfil_all" ON public.procurement_pacote_ambito FOR ALL TO authenticated
  USING (private.tem_perfil(auth.uid())) WITH CHECK (private.tem_perfil(auth.uid()));
CREATE TRIGGER set_updated_at_ambito BEFORE UPDATE ON public.procurement_pacote_ambito
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.procurement_pacote_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pacote_id uuid NOT NULL REFERENCES public.procurement_pacotes(id) ON DELETE CASCADE,
  documento_id uuid NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  obrigatorio boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pacote_id, documento_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_pacote_documentos TO authenticated;
GRANT ALL ON public.procurement_pacote_documentos TO service_role;
ALTER TABLE public.procurement_pacote_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pacote_docs_perfil_all" ON public.procurement_pacote_documentos FOR ALL TO authenticated
  USING (private.tem_perfil(auth.uid())) WITH CHECK (private.tem_perfil(auth.uid()));
CREATE TRIGGER set_updated_at_pacote_docs BEFORE UPDATE ON public.procurement_pacote_documentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.procurement_pacote_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pacote_id uuid NOT NULL REFERENCES public.procurement_pacotes(id) ON DELETE CASCADE,
  subempreiteiro_id uuid NOT NULL REFERENCES public.subempreiteiros(id) ON DELETE CASCADE,
  notas text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pacote_id, subempreiteiro_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_pacote_empresas TO authenticated;
GRANT ALL ON public.procurement_pacote_empresas TO service_role;
ALTER TABLE public.procurement_pacote_empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pacote_empresas_perfil_all" ON public.procurement_pacote_empresas FOR ALL TO authenticated
  USING (private.tem_perfil(auth.uid())) WITH CHECK (private.tem_perfil(auth.uid()));
CREATE TRIGGER set_updated_at_pacote_empresas BEFORE UPDATE ON public.procurement_pacote_empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.procurement_pacote_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pacote_id uuid NOT NULL REFERENCES public.procurement_pacotes(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  mq_revisao text NOT NULL DEFAULT 'Rev. 01',
  estado text NOT NULL DEFAULT 'rascunho',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  enviado_em timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pacote_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_pacote_versoes TO authenticated;
GRANT ALL ON public.procurement_pacote_versoes TO service_role;
ALTER TABLE public.procurement_pacote_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pacote_versoes_perfil_all" ON public.procurement_pacote_versoes FOR ALL TO authenticated
  USING (private.tem_perfil(auth.uid())) WITH CHECK (private.tem_perfil(auth.uid()));
CREATE TRIGGER set_updated_at_pacote_versoes BEFORE UPDATE ON public.procurement_pacote_versoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();