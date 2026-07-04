-- =========================================================================
-- 1. PROFILES: restringir leitura ao próprio ou admin
-- =========================================================================
DROP POLICY IF EXISTS profiles_select_all_auth ON public.profiles;

CREATE POLICY profiles_select_own_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 2. Aplicar padrão "SELECT autenticado + escrita admin" às tabelas de dados
-- =========================================================================
DO $$
DECLARE
  t text;
  r record;
  tables text[] := ARRAY[
    'obras',
    'orcamentos',
    'orcamento_artigos',
    'orcamento_capitulos',
    'orcamento_classificacao_run',
    'orcamento_alertas_tecnicos',
    'orcamento_artigo_fontes',
    'procurement_pacotes',
    'procurement_pacote_artigos',
    'documentos',
    'documento_pastas',
    'classificacao_artigos',
    'classificacao_cache',
    'classificacao_memoria',
    'subempreiteiros',
    'biblioteca_artigos',
    'biblioteca_categorias',
    'biblioteca_especialidades',
    'biblioteca_subespecialidades',
    'biblioteca_artigo_keywords',
    'biblioteca_especialidade_keywords',
    'biblioteca_subespecialidade_keywords',
    'biblioteca_artigo_relacoes',
    'biblioteca_sistema_artigos',
    'biblioteca_sistemas_construtivos',
    'biblioteca_artigo_conhecimento',
    'biblioteca_subespecialidade_regras',
    'biblioteca_unidades',
    'artigos_biblioteca'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Apagar todas as políticas existentes na tabela
    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;

    -- Garantir RLS ativo
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- SELECT: qualquer utilizador autenticado
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_select_auth', t
    );

    -- INSERT: apenas admin
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), ''admin''))',
      t || '_insert_admin', t
    );

    -- UPDATE: apenas admin
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))',
      t || '_update_admin', t
    );

    -- DELETE: apenas admin
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin''))',
      t || '_delete_admin', t
    );
  END LOOP;
END $$;

-- =========================================================================
-- 3. STORAGE: bucket "documentos" com escrita restrita a admin
-- =========================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '') ILIKE '%documentos%'
        OR COALESCE(with_check, '') ILIKE '%documentos%'
        OR policyname ILIKE '%documentos%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "documentos_bucket_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos');

CREATE POLICY "documentos_bucket_insert_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "documentos_bucket_update_admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'documentos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "documentos_bucket_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 4. SECURITY DEFINER: revogar EXECUTE de anon/authenticated/public
--    (funções de trigger / utilitárias que nunca devem ser chamadas
--     diretamente pelo cliente). Mantém-se has_role executável porque é
--     usada nas políticas RLS.
-- =========================================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_obra_pastas_padrao()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_subesp_por_classificar()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_artigo_unidade_sync()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_artigo_categoria_coerencia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_orcamento_run_sync()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_sistema_artigo_sync_relacoes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_proteger_por_classificar()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_relacao_inversa()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_orc_artigo_imutavel()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.criar_pastas_padrao_obra(uuid)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- 5. Corrigir funções sem search_path fixo
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalizar_descricao(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(lower(translate(coalesce(_t,''),
    'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaaeeeeiiiiooooouuuucnAAAAAAEEEEIIIIOOOOOUUUUCN')),
    '\s+', ' ', 'g'
  );
$$;
