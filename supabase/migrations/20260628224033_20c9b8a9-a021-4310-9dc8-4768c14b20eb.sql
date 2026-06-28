
-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE public.tipo_relacao AS ENUM (
  'complementa', 'depende_de', 'antecede', 'substitui', 'incompativel', 'opcional',
  'requerido_por', 'precede', 'substituido_por', 'opcional_em'
);

CREATE TYPE public.obrigatoriedade_relacao AS ENUM (
  'obrigatorio', 'muito_frequente', 'frequente', 'opcional', 'raro'
);

CREATE TYPE public.papel_sistema AS ENUM (
  'principal', 'fixacao', 'isolamento', 'impermeabilizacao', 'acabamento',
  'acessorio', 'remate', 'drenagem', 'ventilacao', 'ensaio', 'outro'
);

CREATE TYPE public.categoria_sistema AS ENUM (
  'cobertura', 'fachada', 'pavimento', 'estrutura', 'impermeabilizacao',
  'redes', 'acabamentos', 'outros'
);

CREATE TYPE public.origem_relacao AS ENUM (
  'manual', 'sistema', 'auto_inverso', 'ia', 'aprendizagem'
);

CREATE TYPE public.severidade_alerta AS ENUM ('critico', 'aviso', 'info');

CREATE TYPE public.estado_alerta AS ENUM (
  'aberto', 'aceite_omissao', 'justificado', 'ignorado', 'resolvido'
);

-- ============================================================
-- biblioteca_sistemas_construtivos
-- ============================================================
CREATE TABLE public.biblioteca_sistemas_construtivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text,
  nome text NOT NULL,
  descricao text,
  categoria_sistema public.categoria_sistema NOT NULL DEFAULT 'outros',
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bsc_categoria_idx ON public.biblioteca_sistemas_construtivos(categoria_sistema);
CREATE UNIQUE INDEX bsc_nome_unq ON public.biblioteca_sistemas_construtivos(lower(nome));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_sistemas_construtivos TO authenticated;
GRANT ALL ON public.biblioteca_sistemas_construtivos TO service_role;
ALTER TABLE public.biblioteca_sistemas_construtivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY bsc_auth_all ON public.biblioteca_sistemas_construtivos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER bsc_set_updated_at BEFORE UPDATE ON public.biblioteca_sistemas_construtivos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- biblioteca_sistema_artigos
-- ============================================================
CREATE TABLE public.biblioteca_sistema_artigos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sistema_id uuid NOT NULL REFERENCES public.biblioteca_sistemas_construtivos(id) ON DELETE CASCADE,
  artigo_id uuid NOT NULL REFERENCES public.biblioteca_artigos(id) ON DELETE CASCADE,
  papel public.papel_sistema NOT NULL DEFAULT 'outro',
  obrigatoriedade public.obrigatoriedade_relacao NOT NULL DEFAULT 'frequente',
  ordem_execucao int NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sistema_id, artigo_id)
);
CREATE INDEX bsa_sistema_idx ON public.biblioteca_sistema_artigos(sistema_id);
CREATE INDEX bsa_artigo_idx ON public.biblioteca_sistema_artigos(artigo_id);
CREATE UNIQUE INDEX bsa_principal_unq ON public.biblioteca_sistema_artigos(sistema_id) WHERE papel = 'principal';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_sistema_artigos TO authenticated;
GRANT ALL ON public.biblioteca_sistema_artigos TO service_role;
ALTER TABLE public.biblioteca_sistema_artigos ENABLE ROW LEVEL SECURITY;
CREATE POLICY bsa_auth_all ON public.biblioteca_sistema_artigos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER bsa_set_updated_at BEFORE UPDATE ON public.biblioteca_sistema_artigos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- biblioteca_artigo_relacoes
-- ============================================================
CREATE TABLE public.biblioteca_artigo_relacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artigo_origem_id uuid NOT NULL REFERENCES public.biblioteca_artigos(id) ON DELETE CASCADE,
  artigo_destino_id uuid NOT NULL REFERENCES public.biblioteca_artigos(id) ON DELETE CASCADE,
  tipo_relacao public.tipo_relacao NOT NULL,
  obrigatoriedade public.obrigatoriedade_relacao NOT NULL DEFAULT 'frequente',
  confianca numeric(3,2) NOT NULL DEFAULT 1.00,
  sistema_id uuid REFERENCES public.biblioteca_sistemas_construtivos(id) ON DELETE CASCADE,
  origem public.origem_relacao NOT NULL DEFAULT 'manual',
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (artigo_origem_id <> artigo_destino_id),
  UNIQUE (artigo_origem_id, artigo_destino_id, tipo_relacao)
);
CREATE INDEX bar_origem_idx ON public.biblioteca_artigo_relacoes(artigo_origem_id);
CREATE INDEX bar_destino_idx ON public.biblioteca_artigo_relacoes(artigo_destino_id);
CREATE INDEX bar_sistema_idx ON public.biblioteca_artigo_relacoes(sistema_id);
CREATE INDEX bar_tipo_idx ON public.biblioteca_artigo_relacoes(tipo_relacao);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_artigo_relacoes TO authenticated;
GRANT ALL ON public.biblioteca_artigo_relacoes TO service_role;
ALTER TABLE public.biblioteca_artigo_relacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY bar_auth_all ON public.biblioteca_artigo_relacoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER bar_set_updated_at BEFORE UPDATE ON public.biblioteca_artigo_relacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Trigger: inverso automático
-- Mantém uma linha-espelho com origem='auto_inverso' para cada
-- relação não-inversa criada/alterada/removida.
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_relacao_inversa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.tipo_relacao;
BEGIN
  -- Só processa relações canónicas (não as inversas auto-geradas)
  IF (TG_OP = 'DELETE') THEN
    IF OLD.origem = 'auto_inverso' THEN RETURN OLD; END IF;
    _inv := CASE OLD.tipo_relacao
      WHEN 'complementa' THEN 'complementa'::tipo_relacao
      WHEN 'depende_de' THEN 'requerido_por'::tipo_relacao
      WHEN 'antecede' THEN 'precede'::tipo_relacao
      WHEN 'substitui' THEN 'substituido_por'::tipo_relacao
      WHEN 'incompativel' THEN 'incompativel'::tipo_relacao
      WHEN 'opcional' THEN 'opcional_em'::tipo_relacao
      ELSE NULL
    END;
    IF _inv IS NOT NULL THEN
      DELETE FROM public.biblioteca_artigo_relacoes
        WHERE artigo_origem_id = OLD.artigo_destino_id
          AND artigo_destino_id = OLD.artigo_origem_id
          AND tipo_relacao = _inv
          AND origem = 'auto_inverso';
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT/UPDATE
  IF NEW.origem = 'auto_inverso' THEN RETURN NEW; END IF;

  _inv := CASE NEW.tipo_relacao
    WHEN 'complementa' THEN 'complementa'::tipo_relacao
    WHEN 'depende_de' THEN 'requerido_por'::tipo_relacao
    WHEN 'antecede' THEN 'precede'::tipo_relacao
    WHEN 'substitui' THEN 'substituido_por'::tipo_relacao
    WHEN 'incompativel' THEN 'incompativel'::tipo_relacao
    WHEN 'opcional' THEN 'opcional_em'::tipo_relacao
    ELSE NULL
  END;

  IF _inv IS NULL THEN RETURN NEW; END IF;

  IF (TG_OP = 'UPDATE') THEN
    -- Apaga eventual inverso anterior se a relação canónica mudou de chave
    IF OLD.artigo_origem_id <> NEW.artigo_origem_id
       OR OLD.artigo_destino_id <> NEW.artigo_destino_id
       OR OLD.tipo_relacao <> NEW.tipo_relacao THEN
      DELETE FROM public.biblioteca_artigo_relacoes
        WHERE artigo_origem_id = OLD.artigo_destino_id
          AND artigo_destino_id = OLD.artigo_origem_id
          AND origem = 'auto_inverso'
          AND tipo_relacao = CASE OLD.tipo_relacao
            WHEN 'complementa' THEN 'complementa'::tipo_relacao
            WHEN 'depende_de' THEN 'requerido_por'::tipo_relacao
            WHEN 'antecede' THEN 'precede'::tipo_relacao
            WHEN 'substitui' THEN 'substituido_por'::tipo_relacao
            WHEN 'incompativel' THEN 'incompativel'::tipo_relacao
            WHEN 'opcional' THEN 'opcional_em'::tipo_relacao
          END;
    END IF;
  END IF;

  INSERT INTO public.biblioteca_artigo_relacoes
    (artigo_origem_id, artigo_destino_id, tipo_relacao, obrigatoriedade,
     confianca, sistema_id, origem, observacoes)
  VALUES
    (NEW.artigo_destino_id, NEW.artigo_origem_id, _inv, NEW.obrigatoriedade,
     NEW.confianca, NEW.sistema_id, 'auto_inverso', NEW.observacoes)
  ON CONFLICT (artigo_origem_id, artigo_destino_id, tipo_relacao) DO UPDATE
    SET obrigatoriedade = EXCLUDED.obrigatoriedade,
        confianca = EXCLUDED.confianca,
        sistema_id = EXCLUDED.sistema_id,
        observacoes = EXCLUDED.observacoes,
        updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_relacao_inversa
  AFTER INSERT OR UPDATE OR DELETE ON public.biblioteca_artigo_relacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_relacao_inversa();

-- ============================================================
-- Trigger: sistema → relações derivadas (complementa)
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_sistema_artigo_sync_relacoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _principal_id uuid;
  _other_id uuid;
  _r record;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    -- Apagar relações derivadas relativas a este artigo neste sistema
    DELETE FROM public.biblioteca_artigo_relacoes
      WHERE sistema_id = OLD.sistema_id
        AND origem = 'sistema'
        AND (artigo_origem_id = OLD.artigo_id OR artigo_destino_id = OLD.artigo_id);
    RETURN OLD;
  END IF;

  -- INSERT/UPDATE — recalcular para este sistema
  SELECT artigo_id INTO _principal_id
    FROM public.biblioteca_sistema_artigos
   WHERE sistema_id = NEW.sistema_id AND papel = 'principal'
   LIMIT 1;

  IF _principal_id IS NULL THEN RETURN NEW; END IF;

  -- Para o artigo afetado: cria/atualiza relação principal <-> membro
  IF NEW.artigo_id = _principal_id THEN
    -- O alterado é o principal: regenerar relações com todos os outros membros
    FOR _r IN SELECT artigo_id, obrigatoriedade FROM public.biblioteca_sistema_artigos
              WHERE sistema_id = NEW.sistema_id AND artigo_id <> _principal_id LOOP
      INSERT INTO public.biblioteca_artigo_relacoes
        (artigo_origem_id, artigo_destino_id, tipo_relacao, obrigatoriedade,
         sistema_id, origem)
      VALUES (_principal_id, _r.artigo_id, 'complementa', _r.obrigatoriedade,
              NEW.sistema_id, 'sistema')
      ON CONFLICT (artigo_origem_id, artigo_destino_id, tipo_relacao) DO UPDATE
        SET obrigatoriedade = EXCLUDED.obrigatoriedade,
            sistema_id = EXCLUDED.sistema_id,
            origem = 'sistema',
            updated_at = now();
    END LOOP;
  ELSE
    INSERT INTO public.biblioteca_artigo_relacoes
      (artigo_origem_id, artigo_destino_id, tipo_relacao, obrigatoriedade,
       sistema_id, origem)
    VALUES (_principal_id, NEW.artigo_id, 'complementa', NEW.obrigatoriedade,
            NEW.sistema_id, 'sistema')
    ON CONFLICT (artigo_origem_id, artigo_destino_id, tipo_relacao) DO UPDATE
      SET obrigatoriedade = EXCLUDED.obrigatoriedade,
          sistema_id = EXCLUDED.sistema_id,
          origem = 'sistema',
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sistema_artigo_sync_relacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.biblioteca_sistema_artigos
  FOR EACH ROW EXECUTE FUNCTION public.tg_sistema_artigo_sync_relacoes();

-- ============================================================
-- orcamento_alertas_tecnicos
-- ============================================================
CREATE TABLE public.orcamento_alertas_tecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  artigo_mq_id uuid REFERENCES public.orcamento_artigos(id) ON DELETE CASCADE,
  artigo_mestre_origem_id uuid REFERENCES public.biblioteca_artigos(id) ON DELETE CASCADE,
  artigo_mestre_esperado_id uuid NOT NULL REFERENCES public.biblioteca_artigos(id) ON DELETE CASCADE,
  sistema_id uuid REFERENCES public.biblioteca_sistemas_construtivos(id) ON DELETE SET NULL,
  tipo_relacao public.tipo_relacao NOT NULL,
  obrigatoriedade public.obrigatoriedade_relacao NOT NULL,
  severidade public.severidade_alerta NOT NULL DEFAULT 'aviso',
  estado public.estado_alerta NOT NULL DEFAULT 'aberto',
  justificacao text,
  resolvido_por uuid,
  resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (orcamento_id, artigo_mq_id, artigo_mestre_esperado_id, tipo_relacao)
);
CREATE INDEX oat_orcamento_idx ON public.orcamento_alertas_tecnicos(orcamento_id);
CREATE INDEX oat_estado_idx ON public.orcamento_alertas_tecnicos(estado);
CREATE INDEX oat_severidade_idx ON public.orcamento_alertas_tecnicos(severidade);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_alertas_tecnicos TO authenticated;
GRANT ALL ON public.orcamento_alertas_tecnicos TO service_role;
ALTER TABLE public.orcamento_alertas_tecnicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY oat_auth_all ON public.orcamento_alertas_tecnicos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER oat_set_updated_at BEFORE UPDATE ON public.orcamento_alertas_tecnicos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
