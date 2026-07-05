-- 1) Tighten INSERT policy on biblioteca_sugestao (remove WITH CHECK true)
DROP POLICY IF EXISTS bm_sugestao_insert ON public.biblioteca_sugestao;
CREATE POLICY bm_sugestao_insert ON public.biblioteca_sugestao
  FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());

-- 2) Rewrite every policy that references has_role in any schema to use private.has_role
DO $$
DECLARE
  r record;
  qual_txt text;
  check_txt text;
  role_list text;
  sql text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, roles,
           coalesce(qual,'') AS qual, coalesce(with_check,'') AS with_check
    FROM pg_policies
    WHERE (qual ~ '(^|[^a-zA-Z0-9_.])(public\.)?has_role\('
        OR with_check ~ '(^|[^a-zA-Z0-9_.])(public\.)?has_role\(')
  LOOP
    -- Skip policies that already use private.has_role exclusively
    IF r.qual !~ '(^|[^a-zA-Z0-9_.])(public\.)?has_role\('
       AND r.with_check !~ '(^|[^a-zA-Z0-9_.])(public\.)?has_role\(' THEN
      CONTINUE;
    END IF;

    qual_txt := regexp_replace(r.qual,
      '(^|[^a-zA-Z0-9_.])(public\.)?has_role\(',
      '\1private.has_role(', 'g');
    check_txt := regexp_replace(r.with_check,
      '(^|[^a-zA-Z0-9_.])(public\.)?has_role\(',
      '\1private.has_role(', 'g');

    role_list := array_to_string(
      ARRAY(SELECT quote_ident(x) FROM unnest(r.roles) x), ',');

    EXECUTE format('DROP POLICY %I ON %I.%I',
                   r.policyname, r.schemaname, r.tablename);

    sql := format('CREATE POLICY %I ON %I.%I FOR %s TO %s',
                  r.policyname, r.schemaname, r.tablename, r.cmd, role_list);
    IF nullif(qual_txt,'') IS NOT NULL THEN
      sql := sql || format(' USING (%s)', qual_txt);
    END IF;
    IF nullif(check_txt,'') IS NOT NULL THEN
      sql := sql || format(' WITH CHECK (%s)', check_txt);
    END IF;
    EXECUTE sql;
  END LOOP;
END $$;

-- 3) Drop public.has_role now that no policy references it
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);