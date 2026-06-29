ALTER TYPE biblioteca_conhecimento_origem ADD VALUE IF NOT EXISTS 'orcamentos_brutos';
ALTER TYPE biblioteca_conhecimento_origem ADD VALUE IF NOT EXISTS 'artigos_vizinhos';
CREATE INDEX IF NOT EXISTS idx_orc_art_descr_trgm ON public.orcamento_artigos USING gin (descricao gin_trgm_ops);