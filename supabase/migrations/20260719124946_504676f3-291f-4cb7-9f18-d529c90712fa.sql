-- Associa Estaleiro aos Artigos Mestres de preparação da obra e instalações
-- provisórias. Abrange os dois níveis da Biblioteca Mestra porque estes nomes
-- podem existir como especialidade ou como subespecialidade.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.subempreitadas WHERE codigo = 'ESTAL') THEN
    RAISE EXCEPTION 'A subempreitada ESTAL (Estaleiro) não existe.';
  END IF;
END $$;

UPDATE public.biblioteca_artigos AS a
SET
  subempreitada_principal_id = estaleiro.id,
  confianca_subempreitada = 1,
  origem_classificacao_subempreitada = 'regras',
  updated_at = now()
FROM public.biblioteca_subespecialidades AS se
JOIN public.biblioteca_especialidades AS e
  ON e.id = se.especialidade_id
CROSS JOIN public.subempreitadas AS estaleiro
WHERE a.subespecialidade_id = se.id
  AND estaleiro.codigo = 'ESTAL'
  AND (
    translate(lower(trim(e.nome)), 'áàãâéêíóôõúç', 'aaaaeeiooouc') IN (
      'preparacao de obra',
      'instalacoes provisorias'
    )
    OR translate(lower(trim(se.nome)), 'áàãâéêíóôõúç', 'aaaaeeiooouc') IN (
      'preparacao de obra',
      'instalacoes provisorias'
    )
  );