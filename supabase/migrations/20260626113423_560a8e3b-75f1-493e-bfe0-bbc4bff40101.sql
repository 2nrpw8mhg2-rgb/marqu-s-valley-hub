
-- ============== PASSO 1: Flags estruturais ==============
ALTER TABLE public.biblioteca_especialidades
  ADD COLUMN IF NOT EXISTS subesp_como_disciplina boolean NOT NULL DEFAULT false;

UPDATE public.biblioteca_especialidades SET subesp_como_disciplina = true WHERE codigo = '110';

ALTER TABLE public.biblioteca_subespecialidades
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS cor text,
  ADD COLUMN IF NOT EXISTS sequencia_construtiva jsonb,
  ADD COLUMN IF NOT EXISTS pastas_padrao text[] NOT NULL DEFAULT '{}'::text[];

CREATE UNIQUE INDEX IF NOT EXISTS biblioteca_subespecialidades_esp_slug_uidx
  ON public.biblioteca_subespecialidades (especialidade_id, slug) WHERE slug IS NOT NULL;

-- Preencher slug + cor + pastas-tipo + sequência das 14 disciplinas da 110
DO $$
DECLARE
  esp110 uuid;
  rec record;
  defaults jsonb := '[
    {"codigo":"110.01","slug":"eletricidade","cor":"#F5A524","pastas":["Projeto","Telas Finais","Certificados","Ensaios","Manuais"],"seq":["Tubagens e caminhos","Cablagem","Quadros e aparelhagem","Iluminação","Ensaios","Comissionamento"]},
    {"codigo":"110.02","slug":"ited","cor":"#8B5CF6","pastas":["Projeto","Telas Finais","Certificação ITED","Ensaios"],"seq":["Infraestrutura","Cablagem","Equipamento ativo","Certificação"]},
    {"codigo":"110.03","slug":"scie","cor":"#EF4444","pastas":["Projeto","Telas Finais","Certificados","Ensaios","Medidas Autoproteção"],"seq":["Tubagens e calhas","Equipamentos","Sinalética","Ensaios","Certificação ANEPC"]},
    {"codigo":"110.04","slug":"avac","cor":"#3B82F6","pastas":["Projeto","Telas Finais","Balanceamento","Ensaios","Manuais"],"seq":["Condutas","Equipamentos","Tubagens","Balanceamento","Ensaios","Comissionamento"]},
    {"codigo":"110.05","slug":"hidraulicas","cor":"#06B6D4","pastas":["Projeto","Telas Finais","Ensaios","Manuais"],"seq":["Tubagens","Equipamentos","Aparelhagem","Ensaios de pressão"]},
    {"codigo":"110.06","slug":"gas","cor":"#F59E0B","pastas":["Projeto","Telas Finais","Certificação","Ensaios"],"seq":["Tubagens","Equipamentos","Ensaios de estanquidade","Certificação"]},
    {"codigo":"110.07","slug":"domotica","cor":"#A855F7","pastas":["Projeto","Programação","Manuais","Ensaios"],"seq":["Infraestrutura","Cablagem bus","Programação","Comissionamento"]},
    {"codigo":"110.08","slug":"seguranca","cor":"#DC2626","pastas":["Projeto","Telas Finais","Programação","Ensaios"],"seq":["Cablagem","Equipamentos","Programação","Ensaios"]},
    {"codigo":"110.09","slug":"renovaveis","cor":"#10B981","pastas":["Projeto","Telas Finais","Certificados","Monitorização"],"seq":["Estrutura","Painéis","Inversores","Cablagem","Ensaios","Ligação à rede"]},
    {"codigo":"110.10","slug":"aqs","cor":"#0EA5E9","pastas":["Projeto","Telas Finais","Ensaios","Manuais"],"seq":["Equipamentos","Tubagens","Ensaios","Balanceamento"]},
    {"codigo":"110.11","slug":"elevadores","cor":"#6366F1","pastas":["Projeto","Telas Finais","Certificação","Manutenção"],"seq":["Estrutura","Equipamento","Cablagem","Ensaios","Certificação"]},
    {"codigo":"110.12","slug":"especiais","cor":"#EC4899","pastas":["Projeto","Telas Finais","Ensaios","Manuais"],"seq":["Infraestrutura","Equipamentos","Programação","Ensaios"]},
    {"codigo":"110.13","slug":"comissionamento","cor":"#14B8A6","pastas":["Plano","Relatórios","Ensaios","Certificados"],"seq":["Plano","Pré-ensaios","Ensaios","Relatório final"]},
    {"codigo":"110.14","slug":"bms","cor":"#0F766E","pastas":["Projeto","Programação","Manuais","Ensaios"],"seq":["Arquitetura","Cablagem","Controladores","Programação","Integração","Comissionamento"]}
  ]'::jsonb;
BEGIN
  SELECT id INTO esp110 FROM public.biblioteca_especialidades WHERE codigo = '110';
  IF esp110 IS NULL THEN RETURN; END IF;
  FOR rec IN SELECT * FROM jsonb_to_recordset(defaults) AS x(codigo text, slug text, cor text, pastas text[], seq jsonb)
  LOOP
    UPDATE public.biblioteca_subespecialidades
       SET slug = rec.slug,
           cor = rec.cor,
           pastas_padrao = rec.pastas,
           sequencia_construtiva = rec.seq
     WHERE especialidade_id = esp110 AND codigo = rec.codigo;
  END LOOP;
END $$;

-- ============== PASSO 2: Keywords e Regras por subespecialidade ==============
CREATE TABLE IF NOT EXISTS public.biblioteca_subespecialidade_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subespecialidade_id uuid NOT NULL REFERENCES public.biblioteca_subespecialidades(id) ON DELETE CASCADE,
  termo text NOT NULL,
  tipo public.biblioteca_keyword_tipo NOT NULL DEFAULT 'positiva',
  peso numeric(5,2) NOT NULL DEFAULT 1.00,
  origem public.biblioteca_keyword_origem NOT NULL DEFAULT 'manual',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_subespecialidade_keywords TO authenticated;
GRANT ALL ON public.biblioteca_subespecialidade_keywords TO service_role;

ALTER TABLE public.biblioteca_subespecialidade_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm_subesp_kw_auth_all" ON public.biblioteca_subespecialidade_keywords
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS biblioteca_subesp_kw_uniq
  ON public.biblioteca_subespecialidade_keywords (subespecialidade_id, lower(termo), tipo);
CREATE INDEX IF NOT EXISTS biblioteca_subesp_kw_termo_idx
  ON public.biblioteca_subespecialidade_keywords (lower(termo));

CREATE TRIGGER bm_subesp_kw_set_updated_at
  BEFORE UPDATE ON public.biblioteca_subespecialidade_keywords
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.biblioteca_subespecialidade_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subespecialidade_id uuid NOT NULL REFERENCES public.biblioteca_subespecialidades(id) ON DELETE CASCADE,
  categoria_id uuid REFERENCES public.biblioteca_categorias(id) ON DELETE SET NULL,
  padrao text NOT NULL,
  descricao text,
  prioridade integer NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_subespecialidade_regras TO authenticated;
GRANT ALL ON public.biblioteca_subespecialidade_regras TO service_role;

ALTER TABLE public.biblioteca_subespecialidade_regras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm_subesp_regras_auth_all" ON public.biblioteca_subespecialidade_regras
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS biblioteca_subesp_regras_sub_idx
  ON public.biblioteca_subespecialidade_regras (subespecialidade_id);

CREATE TRIGGER bm_subesp_regras_set_updated_at
  BEFORE UPDATE ON public.biblioteca_subespecialidade_regras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Popular keywords iniciais (positivas) por disciplina
DO $$
DECLARE
  esp110 uuid;
  rec record;
  termo text;
  pos jsonb := '{
    "eletricidade": ["quadro elétrico","quadro parcial","tomada","interruptor","cabo XV","cabo H07","barramento","ups","sai","disjuntor","diferencial","aparelhagem","caixa de derivação","eletrocalha","tubo vd","esteira","disjuntor diferencial","aterramento"],
    "ited": ["ati","rj45","fibra ótica","fibra otica","patch panel","rack","catv","cabo par entrançado","coaxial","tomada rj","bastidor","ftp","utp","cat6","cat6a","cat7"],
    "scie": ["sinalização emergência","detetor de fumo","central de incêndio","sprinkler","extintor","boca de incêndio","carretel","hidrante","sinalética scie","detetor","central scie","cdi"],
    "avac": ["conduta","vrv","split","chiller","unidade interior","unidade exterior","recuperador","ventilação","vmc","ventiloconvector","fancoil","grelha","difusor","comporta","unidade tratamento de ar","uta","vrf","exaustor"],
    "hidraulicas": ["tubagem água","ppr","multicamada","torneira","misturadora","autoclismo","lavatório","sanita","poliban","esgoto","queda","sifão","cofre de água","grupo de pressão","contador"],
    "gas": ["gás natural","propano","butano","queimador","redutor gás","tubagem gás","contador gás","caldeira a gás","esquentador a gás","detetor gás","válvula corte gás"],
    "domotica": ["knx","dali","modbus","bus","scenário","scene","loxone","control4","crestron","velbus","programação domótica","z-wave","zigbee"],
    "seguranca": ["cctv","câmara ip","nvr","dvr","controlo de acessos","leitor cartão","biométrico","intrusão","alarme","central intrusão","ptz","domo"],
    "renovaveis": ["painel fotovoltaico","inversor","fotovoltaico","autoconsumo","upac","bateria solar","string","mppt","microinversor","painel solar térmico","monitorização solar"],
    "aqs": ["bomba calor","termoacumulador","aqs","depósito inércia","cilindro","heat pump","sistema híbrido"],
    "elevadores": ["elevador","monta cargas","plataforma elevatória","cabine elevador","cabos elevador","guias elevador","central elevador","limitador velocidade","poço elevador"],
    "especiais": ["gases medicinais","ar comprimido medicinal","vácuo medicinal","piscina","sauna","jacuzzi","sistema audio profissional","sonorização"],
    "comissionamento": ["comissionamento","ensaio","ensaios","testes funcionais","handover","pré-ensaios","relatório ensaio","tab"],
    "bms": ["bms","gtc","scada","gestão técnica","integração protocolos","bacnet","controlador dpc","controlador ddc","supervisão"]
  }'::jsonb;
BEGIN
  SELECT id INTO esp110 FROM public.biblioteca_especialidades WHERE codigo = '110';
  IF esp110 IS NULL THEN RETURN; END IF;
  FOR rec IN
    SELECT s.id AS sub_id, s.slug
      FROM public.biblioteca_subespecialidades s
     WHERE s.especialidade_id = esp110 AND s.slug IS NOT NULL
  LOOP
    IF pos ? rec.slug THEN
      FOR termo IN SELECT jsonb_array_elements_text(pos -> rec.slug)
      LOOP
        INSERT INTO public.biblioteca_subespecialidade_keywords (subespecialidade_id, termo, tipo, peso, origem)
        VALUES (rec.sub_id, termo, 'positiva', 1.00, 'manual')
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ============== PASSO 3: Procurement por disciplina + subempreiteiros ==============
ALTER TABLE public.procurement_pacotes
  ADD COLUMN IF NOT EXISTS subespecialidade_id uuid REFERENCES public.biblioteca_subespecialidades(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS procurement_pacotes_subesp_idx
  ON public.procurement_pacotes (subespecialidade_id);

ALTER TABLE public.subempreiteiros
  ADD COLUMN IF NOT EXISTS subespecialidades text[] NOT NULL DEFAULT '{}'::text[];

-- Migrar arrays existentes: passar AVAC/Eletricidade/ITED/Gás/SCIE de `especialidades` para `subespecialidades` quando aplicável
UPDATE public.subempreiteiros
   SET subespecialidades = ARRAY(
     SELECT DISTINCT lower(e)
       FROM unnest(especialidades) AS e
      WHERE lower(e) = ANY (ARRAY['avac','eletricidade','ited','gás','gas','scie','canalizações','canalizacoes'])
   )
 WHERE cardinality(subespecialidades) = 0
   AND EXISTS (
     SELECT 1 FROM unnest(especialidades) AS e
      WHERE lower(e) = ANY (ARRAY['avac','eletricidade','ited','gás','gas','scie','canalizações','canalizacoes'])
   );
