CREATE OR REPLACE FUNCTION private.tem_perfil(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) $$;

REVOKE EXECUTE ON FUNCTION private.tem_perfil(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.tem_perfil(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "bm_qualidade_read" ON public.biblioteca_artigo_qualidade;
CREATE POLICY "bm_qualidade_read" ON public.biblioteca_artigo_qualidade FOR SELECT TO authenticated USING (private.tem_perfil(auth.uid()));

DROP POLICY IF EXISTS "bm_audit_read" ON public.biblioteca_auditoria_run;
CREATE POLICY "bm_audit_read" ON public.biblioteca_auditoria_run FOR SELECT TO authenticated USING (private.tem_perfil(auth.uid()));

DROP POLICY IF EXISTS "bm_aprend_read" ON public.biblioteca_aprendizagem_evento;
CREATE POLICY "bm_aprend_read" ON public.biblioteca_aprendizagem_evento FOR SELECT TO authenticated USING (private.tem_perfil(auth.uid()));

DROP POLICY IF EXISTS "bm_sugestao_read" ON public.biblioteca_sugestao;
CREATE POLICY "bm_sugestao_read" ON public.biblioteca_sugestao FOR SELECT TO authenticated USING (private.tem_perfil(auth.uid()));

DROP POLICY IF EXISTS "sub_aprend_select_auth" ON public.subempreitada_aprendizagem;
CREATE POLICY "sub_aprend_select_auth" ON public.subempreitada_aprendizagem FOR SELECT TO authenticated USING (private.tem_perfil(auth.uid()));

DROP POLICY IF EXISTS "subempreitadas_select_auth" ON public.subempreitadas;
CREATE POLICY "subempreitadas_select_auth" ON public.subempreitadas FOR SELECT TO authenticated USING (private.tem_perfil(auth.uid()));

DROP POLICY IF EXISTS "templates_obra_select_auth" ON public.templates_obra;
CREATE POLICY "templates_obra_select_auth" ON public.templates_obra FOR SELECT TO authenticated USING (private.tem_perfil(auth.uid()));

DROP POLICY IF EXISTS "template_obra_pacotes_select_auth" ON public.template_obra_pacotes;
CREATE POLICY "template_obra_pacotes_select_auth" ON public.template_obra_pacotes FOR SELECT TO authenticated USING (private.tem_perfil(auth.uid()));