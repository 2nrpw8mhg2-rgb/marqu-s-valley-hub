
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;

-- Business tables: admin-only for all CRUD
DO $$
DECLARE
  t text;
  r record;
  tables text[] := ARRAY[
    'obras','orcamentos','orcamento_artigos','orcamento_capitulos',
    'orcamento_classificacao_run','orcamento_alertas_tecnicos','orcamento_artigo_fontes',
    'procurement_pacotes','procurement_pacote_artigos','documentos','documento_pastas',
    'classificacao_artigos','classificacao_cache','classificacao_memoria',
    'subempreiteiros',
    'biblioteca_artigos','biblioteca_categorias','biblioteca_especialidades',
    'biblioteca_subespecialidades','biblioteca_artigo_keywords',
    'biblioteca_especialidade_keywords','biblioteca_subespecialidade_keywords',
    'biblioteca_artigo_relacoes','biblioteca_sistema_artigos',
    'biblioteca_sistemas_construtivos','biblioteca_artigo_conhecimento',
    'biblioteca_subespecialidade_regras','biblioteca_unidades','artigos_biblioteca',
    'biblioteca_knowledge_run'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (private.has_role(auth.uid(), ''admin''))', t || '_select_admin', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), ''admin''))', t || '_insert_admin', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), ''admin'')) WITH CHECK (private.has_role(auth.uid(), ''admin''))', t || '_update_admin', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (private.has_role(auth.uid(), ''admin''))', t || '_delete_admin', t);
  END LOOP;
END $$;

-- classificacao_aprendizagem: own or admin
DROP POLICY IF EXISTS "auth read all aprendizagem" ON public.classificacao_aprendizagem;
DROP POLICY IF EXISTS "auth insert own aprendizagem" ON public.classificacao_aprendizagem;
ALTER TABLE public.classificacao_aprendizagem ENABLE ROW LEVEL SECURITY;
CREATE POLICY aprendizagem_select_own_or_admin ON public.classificacao_aprendizagem
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY aprendizagem_insert_own ON public.classificacao_aprendizagem
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY aprendizagem_update_own_or_admin ON public.classificacao_aprendizagem
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY aprendizagem_delete_own_or_admin ON public.classificacao_aprendizagem
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));

-- templates_obra
DROP POLICY IF EXISTS templates_obra_auth_all ON public.templates_obra;
CREATE POLICY templates_obra_select_auth ON public.templates_obra FOR SELECT TO authenticated USING (true);
CREATE POLICY templates_obra_insert_admin ON public.templates_obra FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY templates_obra_update_admin ON public.templates_obra FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY templates_obra_delete_admin ON public.templates_obra FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS template_obra_pacotes_auth_all ON public.template_obra_pacotes;
CREATE POLICY template_obra_pacotes_select_auth ON public.template_obra_pacotes FOR SELECT TO authenticated USING (true);
CREATE POLICY template_obra_pacotes_insert_admin ON public.template_obra_pacotes FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY template_obra_pacotes_update_admin ON public.template_obra_pacotes FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY template_obra_pacotes_delete_admin ON public.template_obra_pacotes FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- profiles + user_roles
DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
CREATE POLICY profiles_select_own_or_admin ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS roles_admin_manage ON public.user_roles;
DROP POLICY IF EXISTS roles_select_own_or_admin ON public.user_roles;
CREATE POLICY roles_select_own_or_admin ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY roles_admin_manage ON public.user_roles
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- storage.objects documentos bucket policies
DROP POLICY IF EXISTS documentos_bucket_insert_admin ON storage.objects;
DROP POLICY IF EXISTS documentos_bucket_update_admin ON storage.objects;
DROP POLICY IF EXISTS documentos_bucket_delete_admin ON storage.objects;
CREATE POLICY documentos_bucket_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY documentos_bucket_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos' AND private.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'documentos' AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY documentos_bucket_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND private.has_role(auth.uid(), 'admin'));

-- Finally remove public.has_role from the exposed API
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
