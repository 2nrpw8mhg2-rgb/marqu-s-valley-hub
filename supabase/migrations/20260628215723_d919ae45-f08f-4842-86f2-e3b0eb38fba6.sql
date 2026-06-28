
-- Enum estado_mq
DO $$ BEGIN
  CREATE TYPE public.estado_mq AS ENUM (
    'importado','em_classificacao','aguardando_validacao','validado','convertido_pacotes'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Colunas
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS estado_mq public.estado_mq NOT NULL DEFAULT 'importado',
  ADD COLUMN IF NOT EXISTS versao_label text NOT NULL DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS orcamentos_obra_versao_idx ON public.orcamentos(obra_id, versao);

-- Trigger: ao concluir um run, atualiza estado_mq do orçamento
CREATE OR REPLACE FUNCTION public.tg_orcamento_run_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'em_curso' THEN
    UPDATE public.orcamentos SET estado_mq = 'em_classificacao' WHERE id = NEW.orcamento_id;
  ELSIF NEW.estado = 'concluido' THEN
    IF COALESCE(NEW.parcial,0) + COALESCE(NEW.sem_classificacao,0) = 0 THEN
      UPDATE public.orcamentos SET estado_mq = 'validado' WHERE id = NEW.orcamento_id;
    ELSE
      UPDATE public.orcamentos SET estado_mq = 'aguardando_validacao' WHERE id = NEW.orcamento_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orcamento_run_sync ON public.orcamento_classificacao_run;
CREATE TRIGGER trg_orcamento_run_sync
AFTER INSERT OR UPDATE OF estado ON public.orcamento_classificacao_run
FOR EACH ROW EXECUTE FUNCTION public.tg_orcamento_run_sync();
