CREATE UNIQUE INDEX IF NOT EXISTS procurement_pacotes_auto_uk
  ON public.procurement_pacotes (orcamento_id, subempreitada_id)
  WHERE origem = 'classificacao_subempreitada' AND subempreitada_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.procurement_reconciliar_pacotes(p_orcamento_id uuid)
RETURNS TABLE(pacotes_criados integer, pacotes_existentes integer, artigos_incluidos integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_obra_id uuid;
  v_criados integer := 0;
  v_existentes integer := 0;
  v_artigos integer := 0;
  v_inseridos integer := 0;
  v_pacote_id uuid;
  v_estado procurement_pacote_estado;
  r record;
BEGIN
  SELECT o.obra_id INTO v_obra_id FROM public.orcamentos o WHERE o.id = p_orcamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;

  FOR r IN
    SELECT s.id, s.nome
    FROM public.subempreitadas s
    WHERE s.ativo = true
      AND EXISTS (
        SELECT 1 FROM public.orcamento_artigos oa
        WHERE oa.orcamento_id = p_orcamento_id
          AND oa.subempreitada_id = s.id
          AND NOT EXISTS (
            SELECT 1 FROM public.consulta_ia_classificacoes c
            WHERE c.orcamento_id = p_orcamento_id
              AND c.artigo_id = oa.id
              AND c.necessita_revisao = true
          )
      )
    ORDER BY s.ordem, s.nome
  LOOP
    SELECT id, estado INTO v_pacote_id, v_estado
    FROM public.procurement_pacotes
    WHERE orcamento_id = p_orcamento_id
      AND subempreitada_id = r.id
      AND origem = 'classificacao_subempreitada'
    LIMIT 1;

    IF v_pacote_id IS NULL THEN
      INSERT INTO public.procurement_pacotes (
        orcamento_id, obra_id, nome, especialidade, estado, created_by, subempreitada_id, origem
      ) VALUES (
        p_orcamento_id, v_obra_id, r.nome, r.nome, 'por_preparar', auth.uid(), r.id, 'classificacao_subempreitada'
      )
      ON CONFLICT (orcamento_id, subempreitada_id) WHERE (origem = 'classificacao_subempreitada' AND subempreitada_id IS NOT NULL)
      DO NOTHING
      RETURNING id INTO v_pacote_id;

      IF v_pacote_id IS NULL THEN
        SELECT id, estado INTO v_pacote_id, v_estado
        FROM public.procurement_pacotes
        WHERE orcamento_id = p_orcamento_id AND subempreitada_id = r.id
          AND origem = 'classificacao_subempreitada'
        LIMIT 1;
        v_existentes := v_existentes + 1;
      ELSE
        v_estado := 'por_preparar';
        v_criados := v_criados + 1;
      END IF;
    ELSE
      v_existentes := v_existentes + 1;
    END IF;

    IF v_pacote_id IS NOT NULL AND v_estado IN ('por_preparar', 'em_preparacao', 'pronto_envio') THEN
      DELETE FROM public.procurement_pacote_artigos WHERE pacote_id = v_pacote_id;

      INSERT INTO public.procurement_pacote_artigos (
        pacote_id, artigo_id, codigo, descricao, unidade, quantidade,
        capitulo, subcapitulo, preco_seco_estimado, especialidade, confianca, motivo, sinalizado_revisao
      )
      SELECT
        v_pacote_id, oa.id, oa.codigo, oa.descricao, oa.unidade, oa.quantidade,
        oc.descricao, NULL, 0, r.nome, oa.subempreitada_confianca, oa.subempreitada_razao, false
      FROM public.orcamento_artigos oa
      LEFT JOIN public.orcamento_capitulos oc ON oc.id = oa.capitulo_id
      WHERE oa.orcamento_id = p_orcamento_id
        AND oa.subempreitada_id = r.id
        AND NOT EXISTS (
          SELECT 1 FROM public.consulta_ia_classificacoes c
          WHERE c.orcamento_id = p_orcamento_id AND c.artigo_id = oa.id AND c.necessita_revisao = true
        )
      ORDER BY oa.ordem;

      GET DIAGNOSTICS v_inseridos = ROW_COUNT;
      v_artigos := v_artigos + v_inseridos;
    END IF;

    v_pacote_id := NULL;
  END LOOP;

  RETURN QUERY SELECT v_criados, v_existentes, v_artigos;
END;
$$;

REVOKE ALL ON FUNCTION public.procurement_reconciliar_pacotes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.procurement_reconciliar_pacotes(uuid) TO authenticated, service_role;