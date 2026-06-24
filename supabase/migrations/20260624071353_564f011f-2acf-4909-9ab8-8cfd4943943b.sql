
CREATE TYPE public.app_role AS ENUM ('admin', 'orcamentista', 'diretor_obra', 'comprador');
CREATE TYPE public.obra_estado AS ENUM ('oportunidade', 'em_curso', 'concluida', 'cancelada');
CREATE TYPE public.documento_tipo AS ENUM ('projeto', 'mq', 'caderno_encargos', 'proposta', 'outro');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email);
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE public.obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT,
  nome TEXT NOT NULL,
  cliente TEXT,
  localizacao TEXT,
  estado obra_estado NOT NULL DEFAULT 'oportunidade',
  valor_estimado NUMERIC(14,2),
  data_inicio DATE,
  data_fim_prevista DATE,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  descricao TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT ALL ON public.obras TO service_role;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "obras_auth_all" ON public.obras FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER obras_updated_at BEFORE UPDATE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo documento_tipo NOT NULL DEFAULT 'outro',
  storage_path TEXT NOT NULL,
  tamanho BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documentos_auth_all" ON public.documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.subempreiteiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  nif TEXT,
  especialidades TEXT[] NOT NULL DEFAULT '{}',
  zonas TEXT[] NOT NULL DEFAULT '{}',
  contacto_nome TEXT,
  telefone TEXT,
  email TEXT,
  avaliacao INT CHECK (avaliacao BETWEEN 0 AND 5),
  notas TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subempreiteiros TO authenticated;
GRANT ALL ON public.subempreiteiros TO service_role;
ALTER TABLE public.subempreiteiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_auth_all" ON public.subempreiteiros FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER subs_updated_at BEFORE UPDATE ON public.subempreiteiros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "docs_storage_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos');
CREATE POLICY "docs_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos');
CREATE POLICY "docs_storage_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos');
CREATE POLICY "docs_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos');
