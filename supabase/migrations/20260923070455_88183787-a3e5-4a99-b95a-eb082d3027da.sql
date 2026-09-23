
-- 1) Normalização determinística de nomes de subempreitada
CREATE OR REPLACE FUNCTION public.normalizar_nome_subempreitada(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(btrim(regexp_replace(
    translate(coalesce(_t, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
    '\s+', ' ', 'g')));
$$;

-- 2) Proveniência
ALTER TABLE public.subempreitadas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES auth.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS subempreitadas_nome_norm_uk
  ON public.subempreitadas (public.normalizar_nome_subempreitada(nome));

-- 3) Criar ou reutilizar subempreitada (transacional e idempotente)
CREATE OR REPLACE FUNCTION public.criar_ou_obter_subempreitada(
  _nome text,
  _codigo text DEFAULT NULL,
  _origem text DEFAULT 'sugestao_ia_validada'
)
RETURNS TABLE (id uuid, codigo text, nome text, criada boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text := btrim(coalesce(_nome, ''));
  v_norm text;
  v_base text;
  v_codigo text;
  v_id uuid;
  v_i int := 0;
  v_ordem int;
BEGIN
  IF auth.uid() IS NULL OR NOT private.tem_perfil(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para criar subempreitadas.';
  END IF;
  IF v_nome = '' THEN
    RAISE EXCEPTION 'O nome da subempreitada é obrigatório.';
  END IF;

  v_norm := public.normalizar_nome_subempreitada(v_nome);

  SELECT s.id INTO v_id FROM public.subempreitadas s
   WHERE public.normalizar_nome_subempreitada(s.nome) = v_norm
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT s.id, s.codigo, s.nome, false FROM public.subempreitadas s WHERE s.id = v_id;
    RETURN;
  END IF;

  v_base := upper(regexp_replace(public.normalizar_nome_subempreitada(coalesce(nullif(btrim(coalesce(_codigo,'')), ''), v_nome)), '[^a-z0-9]', '', 'g'));
  v_base := nullif(left(v_base, 8), '');
  IF v_base IS NULL THEN v_base := 'SUB'; END IF;
  v_codigo := v_base;
  WHILE EXISTS (SELECT 1 FROM public.subempreitadas s WHERE s.codigo = v_codigo) LOOP
    v_i := v_i + 1;
    v_codigo := left(v_base, 6) || v_i::text;
  END LOOP;

  SELECT coalesce(max(s.ordem), 0) + 1 INTO v_ordem FROM public.subempreitadas s;

  BEGIN
    INSERT INTO public.subempreitadas (codigo, nome, ordem, ativo, origem, criado_por)
    VALUES (v_codigo, v_nome, v_ordem, true, coalesce(_origem, 'sugestao_ia_validada'), auth.uid())
    RETURNING public.subempreitadas.id INTO v_id;
    RETURN QUERY SELECT s.id, s.codigo, s.nome, true FROM public.subempreitadas s WHERE s.id = v_id;
  EXCEPTION WHEN unique_violation THEN
    -- corrida: outro pedido criou a mesma subempreitada entretanto
    SELECT s.id INTO v_id FROM public.subempreitadas s
     WHERE public.normalizar_nome_subempreitada(s.nome) = v_norm
     LIMIT 1;
    IF v_id IS NULL THEN RAISE; END IF;
    RETURN QUERY SELECT s.id, s.codigo, s.nome, false FROM public.subempreitadas s WHERE s.id = v_id;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_ou_obter_subempreitada(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_ou_obter_subempreitada(text, text, text) TO authenticated, service_role;

-- 4) Registo de sugestões rejeitadas
CREATE TABLE IF NOT EXISTS public.consulta_ia_sugestoes_rejeitadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  artigo_id uuid NOT NULL REFERENCES public.orcamento_artigos(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.consulta_ia_runs(id) ON DELETE SET NULL,
  sugestao text,
  subempreitada_ia_id uuid REFERENCES public.subempreitadas(id),
  confianca_ia numeric,
  alternativa_id uuid REFERENCES public.subempreitadas(id),
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consulta_ia_sugestoes_rejeitadas TO authenticated;
GRANT ALL ON public.consulta_ia_sugestoes_rejeitadas TO service_role;

ALTER TABLE public.consulta_ia_sugestoes_rejeitadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sugestoes_rejeitadas_select" ON public.consulta_ia_sugestoes_rejeitadas
  FOR SELECT TO authenticated USING (private.tem_perfil(auth.uid()));
CREATE POLICY "sugestoes_rejeitadas_insert" ON public.consulta_ia_sugestoes_rejeitadas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sugestoes_rejeitadas_update" ON public.consulta_ia_sugestoes_rejeitadas
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sugestoes_rejeitadas_delete" ON public.consulta_ia_sugestoes_rejeitadas
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_sugestoes_rejeitadas
  BEFORE UPDATE ON public.consulta_ia_sugestoes_rejeitadas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_sug_rejeitadas_orcamento ON public.consulta_ia_sugestoes_rejeitadas (orcamento_id, artigo_id);
