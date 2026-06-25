CREATE OR REPLACE FUNCTION public.tg_proteger_por_classificar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.nome = 'Por Classificar' AND OLD.ordem = 0 THEN
      -- Bloqueia eliminações diretas da categoria automática, mas permite
      -- eliminações em cascata quando a subespecialidade pai é eliminada.
      IF pg_trigger_depth() <= 1 THEN
        RAISE EXCEPTION 'A categoria "Por Classificar" não pode ser eliminada.';
      END IF;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.nome = 'Por Classificar' AND OLD.ordem = 0 THEN
      IF NEW.nome <> 'Por Classificar' OR NEW.subespecialidade_id <> OLD.subespecialidade_id OR NEW.ordem <> 0 THEN
        RAISE EXCEPTION 'A categoria "Por Classificar" não pode ser renomeada, movida ou reordenada.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;