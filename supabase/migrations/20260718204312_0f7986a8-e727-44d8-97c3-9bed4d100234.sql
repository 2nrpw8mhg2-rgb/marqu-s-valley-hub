-- Liga os pacotes de consulta à classificação oficial dos artigos do orçamento.
ALTER TABLE public.procurement_pacotes
  ADD COLUMN IF NOT EXISTS subempreitada_id uuid REFERENCES public.subempreitadas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';

ALTER TABLE public.procurement_pacotes
  DROP CONSTRAINT IF EXISTS procurement_pacotes_origem_check;

ALTER TABLE public.procurement_pacotes
  ADD CONSTRAINT procurement_pacotes_origem_check
  CHECK (origem IN ('manual', 'classificacao_subempreitada'));

CREATE INDEX IF NOT EXISTS procurement_pacotes_subempreitada_idx
  ON public.procurement_pacotes(subempreitada_id);

CREATE UNIQUE INDEX IF NOT EXISTS procurement_pacotes_auto_sub_unique
  ON public.procurement_pacotes(orcamento_id, subempreitada_id)
  WHERE origem = 'classificacao_subempreitada' AND subempreitada_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gerar_pacotes_por_subempreitada(p_orcamento_id uuid)
RETURNS TABLE(pacotes_criados integer, pacotes_atualizados integer, artigos_incluidos integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_obra_id uuid;
  v_orcamento_nome text;
  v_obra_nome text;
  v_versao integer;
  v_grupo text;
  v_pacote_id uuid;
  v_criados integer := 0;
  v_atualizados integer := 0;
  v_artigos integer := 0;
  v_inseridos integer := 0;
  v_pendentes integer := 0;
  r record;
BEGIN
  SELECT o.obra_id, o.nome, o.versao, ob.nome
    INTO v_obra_id, v_orcamento_nome, v_versao, v_obra_nome
  FROM public.orcamentos o
  LEFT JOIN public.obras ob ON ob.id = o.obra_id
  WHERE o.id = p_orcamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;

  SELECT count(*) INTO v_pendentes
  FROM public.orcamento_artigos oa
  LEFT JOIN public.subempreitadas s ON s.id = oa.subempreitada_id AND s.ativo = true
  WHERE oa.orcamento_id = p_orcamento_id
    AND (oa.subempreitada_id IS NULL OR s.id IS NULL);

  IF v_pendentes > 0 THEN
    RAISE EXCEPTION 'Existem % artigo(s) sem uma subempreitada ativa. Valide a separação antes de gerar os pacotes.', v_pendentes;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.procurement_pacotes
    WHERE orcamento_id = p_orcamento_id
      AND origem = 'classificacao_subempreitada'
      AND estado <> 'por_preparar'
  ) THEN
    RAISE EXCEPTION 'Existem pacotes automáticos que já avançaram no processo. Crie uma nova versão da consulta em vez de os substituir.';
  END IF;

  v_grupo := 'Consulta ao Mercado — ' || COALESCE(NULLIF(v_obra_nome, ''), v_orcamento_nome) || ' — v' || COALESCE(v_versao, 1);

  FOR r IN
    SELECT s.id, s.nome
    FROM public.subempreitadas s
    WHERE s.ativo = true
      AND EXISTS (
        SELECT 1 FROM public.orcamento_artigos oa
        WHERE oa.orcamento_id = p_orcamento_id
          AND oa.subempreitada_id = s.id
      )
    ORDER BY s.ordem, s.nome
  LOOP
    SELECT id INTO v_pacote_id
    FROM public.procurement_pacotes
    WHERE orcamento_id = p_orcamento_id
      AND subempreitada_id = r.id
      AND origem = 'classificacao_subempreitada'
    LIMIT 1;

    IF v_pacote_id IS NULL THEN
      INSERT INTO public.procurement_pacotes (
        orcamento_id, obra_id, nome, especialidade, estado, grupo_consulta,
        created_by, subempreitada_id, origem
      ) VALUES (
        p_orcamento_id, v_obra_id, r.nome, r.nome, 'por_preparar', v_grupo,
        auth.uid(), r.id, 'classificacao_subempreitada'
      )
      RETURNING id INTO v_pacote_id;
      v_criados := v_criados + 1;
    ELSE
      UPDATE public.procurement_pacotes
      SET nome = r.nome,
          especialidade = r.nome,
          grupo_consulta = v_grupo,
          updated_at = now()
      WHERE id = v_pacote_id;
      v_atualizados := v_atualizados + 1;
    END IF;

    DELETE FROM public.procurement_pacote_artigos WHERE pacote_id = v_pacote_id;

    INSERT INTO public.procurement_pacote_artigos (
      pacote_id, artigo_id, codigo, descricao, unidade, quantidade,
      capitulo, subcapitulo, preco_seco_estimado, categoria_custo,
      especialidade, confianca, motivo, sinalizado_revisao
    )
    SELECT
      v_pacote_id, oa.id, oa.codigo, oa.descricao, oa.unidade, oa.quantidade,
      oc.descricao, NULL,
      COALESCE(NULLIF(oa.preco_seco, 0), oa.preco_unitario, 0), NULL,
      r.nome, oa.subempreitada_confianca, oa.subempreitada_razao, false
    FROM public.orcamento_artigos oa
    LEFT JOIN public.orcamento_capitulos oc ON oc.id = oa.capitulo_id
    WHERE oa.orcamento_id = p_orcamento_id
      AND oa.subempreitada_id = r.id
    ORDER BY oa.ordem;

    GET DIAGNOSTICS v_inseridos = ROW_COUNT;
    v_artigos := v_artigos + v_inseridos;
    v_pacote_id := NULL;
  END LOOP;

  RETURN QUERY SELECT v_criados, v_atualizados, v_artigos;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_pacotes_por_subempreitada(uuid) TO authenticated;