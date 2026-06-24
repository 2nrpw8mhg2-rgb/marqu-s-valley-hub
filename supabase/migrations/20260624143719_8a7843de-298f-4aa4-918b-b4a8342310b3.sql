
CREATE TABLE public.classificacao_aprendizagem (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao_original TEXT NOT NULL,
  descricao_normalizada TEXT NOT NULL,
  codigo_artigo TEXT,
  capitulo TEXT,
  subcapitulo TEXT,
  especialidade_sugerida TEXT,
  especialidade_final TEXT NOT NULL,
  confianca_sugerida NUMERIC,
  obra_id UUID,
  acao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_aprend_desc_norm ON public.classificacao_aprendizagem(descricao_normalizada);
CREATE INDEX idx_aprend_esp_final ON public.classificacao_aprendizagem(especialidade_final);
GRANT SELECT, INSERT ON public.classificacao_aprendizagem TO authenticated;
GRANT ALL ON public.classificacao_aprendizagem TO service_role;
ALTER TABLE public.classificacao_aprendizagem ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read all aprendizagem" ON public.classificacao_aprendizagem FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert own aprendizagem" ON public.classificacao_aprendizagem FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.classificacao_cache (
  hash TEXT NOT NULL PRIMARY KEY,
  resultado JSONB NOT NULL,
  modelo TEXT NOT NULL DEFAULT 'regras',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classificacao_cache TO authenticated;
GRANT ALL ON public.classificacao_cache TO service_role;
ALTER TABLE public.classificacao_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage cache" ON public.classificacao_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.procurement_pacote_artigos
  ADD COLUMN IF NOT EXISTS confianca NUMERIC,
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS sinalizado_revisao BOOLEAN NOT NULL DEFAULT false;
