-- Especialidade 100 — Acabamentos Interiores
-- Populates 10 subespecialidades, ~31 user categorias (+10 auto "Por Classificar"),
-- ~115 artigos and ~52 keywords. Idempotent: cascade-deletes existing 100.* subesp.

DO $$
DECLARE
  v_esp uuid;
  v_unidade uuid;
  v_subesp uuid;
  v_cat uuid;
  v_subesp_codigo text;
  v_cat_ordem int;
  v_art_ordem int;
  subesp jsonb;
  cat jsonb;
  art text;
  kw text;
BEGIN
  SELECT id INTO v_unidade FROM public.biblioteca_unidades WHERE codigo='vg';

  INSERT INTO public.biblioteca_especialidades (codigo, nome, ordem, ativo)
  VALUES ('100','Acabamentos Interiores',100,true)
  ON CONFLICT (codigo) DO UPDATE SET nome=EXCLUDED.nome, ordem=EXCLUDED.ordem, ativo=true
  RETURNING id INTO v_esp;
  IF v_esp IS NULL THEN
    SELECT id INTO v_esp FROM public.biblioteca_especialidades WHERE codigo='100';
  END IF;

  -- cascade delete existing 100 subespecialidades
  DELETE FROM public.biblioteca_subespecialidades WHERE especialidade_id=v_esp;

  -- delete existing 100 keywords
  DELETE FROM public.biblioteca_especialidade_keywords WHERE especialidade_id=v_esp;

  FOR subesp IN SELECT * FROM jsonb_array_elements('[
    {"codigo":"100.01","nome":"Pavimentos Interiores","ordem":1,"categorias":[
      {"nome":"Pavimentos Cerâmicos","artigos":["Grés porcelânico","Mosaico cerâmico","Pavimento cerâmico retificado","Pedra cerâmica","Rodapés cerâmicos"]},
      {"nome":"Pavimentos em Madeira","artigos":["Soalho maciço","Soalho multicamada","Pavimento flutuante","Parquet","Deck interior"]},
      {"nome":"Pavimentos Vinílicos","artigos":["Pavimento LVT","Pavimento SPC","Pavimento vinílico colado","Pavimento vinílico acústico"]},
      {"nome":"Pavimentos Têxteis","artigos":["Alcatifa","Carpetes modulares","Pavimento têxtil"]},
      {"nome":"Pavimentos Técnicos","artigos":["Pavimento elevado","Pavimento técnico antiestático","Pavimento para salas técnicas"]},
      {"nome":"Pavimentos Contínuos","artigos":["Microcimento","Pavimento epóxi","Pavimento poliuretano","Resinas decorativas"]}
    ]},
    {"codigo":"100.02","nome":"Tetos","ordem":2,"categorias":[
      {"nome":"Tetos Falsos","artigos":["Teto falso em gesso cartonado","Teto falso desmontável","Teto metálico","Teto acústico","Teto em madeira"]},
      {"nome":"Tetos Decorativos","artigos":["Sancas","Tetos curvos","Painéis decorativos","Elementos ornamentais"]}
    ]},
    {"codigo":"100.03","nome":"Revestimentos de Paredes","ordem":3,"categorias":[
      {"nome":"Cerâmicos","artigos":["Azulejo","Grés porcelânico de parede","Mosaico de parede","Pedra natural de parede"]},
      {"nome":"Madeira","artigos":["Painéis MDF","Folheados","Lambris","Painéis ripados"]},
      {"nome":"Vinílicos","artigos":["Papel de parede vinílico","Revestimento PVC","Painéis decorativos vinílicos"]},
      {"nome":"Revestimentos Especiais","artigos":["Microcimento de parede","Pedra natural decorativa","Painéis compósitos","Revestimentos acústicos"]}
    ]},
    {"codigo":"100.04","nome":"Pinturas","ordem":4,"categorias":[
      {"nome":"Pinturas Interiores","artigos":["Pintura plástica","Pintura acrílica","Pintura lavável","Pintura mate","Pintura acetinada"]},
      {"nome":"Pinturas Técnicas","artigos":["Pintura epóxi","Pintura ignífuga","Pintura antibacteriana","Pintura anti-humidade"]},
      {"nome":"Tratamentos","artigos":["Primário","Selante","Barramento","Preparação de superfícies"]}
    ]},
    {"codigo":"100.05","nome":"Carpintarias Interiores","ordem":5,"categorias":[
      {"nome":"Portas","artigos":["Porta interior lacada","Porta folheada","Porta de madeira maciça","Porta corta-fogo","Porta acústica"]},
      {"nome":"Roupeiros","artigos":["Roupeiro embutido","Roupeiro por medida","Interiores de roupeiro","Portas de roupeiro"]},
      {"nome":"Rodapés e Guarnições","artigos":["Rodapé MDF","Rodapé madeira","Guarnições","Aros"]},
      {"nome":"Escadas","artigos":["Escada em madeira","Revestimento de escadas","Corrimãos de madeira","Guarda-corpos interiores"]},
      {"nome":"Mobiliário Fixo","artigos":["Bancadas","Estantes fixas","Mobiliário por medida","Painéis decorativos fixos"]}
    ]},
    {"codigo":"100.06","nome":"Serralharias Interiores","ordem":6,"categorias":[
      {"nome":"Guardas","artigos":["Guarda metálica","Guarda em vidro","Guarda inox"]},
      {"nome":"Estruturas","artigos":["Escadas metálicas","Estruturas decorativas","Corrimãos metálicos","Divisórias metálicas"]}
    ]},
    {"codigo":"100.07","nome":"Vidros e Espelhos","ordem":7,"categorias":[
      {"nome":"Vidros","artigos":["Vidro temperado","Vidro laminado","Vidro fosco","Vidro serigrafado"]},
      {"nome":"Espelhos","artigos":["Espelho simples","Espelho de segurança","Espelho decorativo","Espelho retroiluminado"]}
    ]},
    {"codigo":"100.08","nome":"Equipamentos Sanitários","ordem":8,"categorias":[
      {"nome":"Louças Sanitárias","artigos":["Sanita","Bidé","Lavatório","Urinol"]},
      {"nome":"Bases e Banheiras","artigos":["Base de duche","Banheira","Resguardo","Coluna de duche"]},
      {"nome":"Torneiras e Acessórios","artigos":["Misturadora","Torneira temporizada","Porta-toalhas","Espelho sanitário","Acessórios WC"]}
    ]},
    {"codigo":"100.09","nome":"Cozinhas e Equipamentos Fixos","ordem":9,"categorias":[
      {"nome":"Cozinhas","artigos":["Móveis de cozinha","Bancadas de cozinha","Ilhas","Rodapés de cozinha","Frentes de cozinha"]},
      {"nome":"Equipamentos","artigos":["Lava-loiça","Exaustor","Placa","Forno","Frigorífico encastrado","Máquina de lavar loiça"]}
    ]},
    {"codigo":"100.10","nome":"Limpeza e Receção Final","ordem":10,"categorias":[
      {"nome":"Limpeza","artigos":["Limpeza técnica","Limpeza final","Proteção de acabamentos","Remoção de proteções"]},
      {"nome":"Receção","artigos":["Vistoria final","Levantamento As Built","Correção de defeitos","Entrega dos acabamentos"]}
    ]}
  ]'::jsonb)
  LOOP
    v_subesp_codigo := subesp->>'codigo';
    INSERT INTO public.biblioteca_subespecialidades (especialidade_id, codigo, nome, ordem, ativa)
    VALUES (v_esp, v_subesp_codigo, subesp->>'nome', (subesp->>'ordem')::int, true)
    RETURNING id INTO v_subesp;

    v_cat_ordem := 10;
    FOR cat IN SELECT * FROM jsonb_array_elements(subesp->'categorias')
    LOOP
      INSERT INTO public.biblioteca_categorias (subespecialidade_id, nome, codigo, ordem, ativa)
      VALUES (v_subesp, cat->>'nome',
              v_subesp_codigo || '.' || lpad((v_cat_ordem/10)::text, 2, '0'),
              v_cat_ordem, true)
      RETURNING id INTO v_cat;

      v_art_ordem := 1;
      FOR art IN SELECT jsonb_array_elements_text(cat->'artigos')
      LOOP
        INSERT INTO public.biblioteca_artigos
          (subespecialidade_id, categoria_id, codigo, descricao, unidade_id, tipo, estado_ia, ativo)
        VALUES (v_subesp, v_cat,
                v_subesp_codigo || '.' || lpad((v_cat_ordem/10)::text, 2, '0') || '.' || lpad(v_art_ordem::text, 2, '0'),
                art, v_unidade, 'outros', 'validado', true);
        v_art_ordem := v_art_ordem + 1;
      END LOOP;

      v_cat_ordem := v_cat_ordem + 10;
    END LOOP;
  END LOOP;

  -- Positive keywords
  FOR kw IN SELECT unnest(ARRAY[
    'pavimento','mosaico','porcelânico','cerâmica','soalho','parquet','flutuante',
    'vinílico','SPC','LVT','microcimento','epóxi','teto falso','pladur',
    'gesso cartonado','teto desmontável','pintura','tinta','barramento','primário',
    'porta interior','aro','rodapé','roupeiro','carpintaria','serralharia','corrimão',
    'guarda','vidro','espelho','sanita','lavatório','base de duche','torneira',
    'cozinha','bancada','armário','mobiliário','azulejo'
  ])
  LOOP
    INSERT INTO public.biblioteca_especialidade_keywords (especialidade_id, termo, tipo, peso, origem)
    VALUES (v_esp, kw, 'positiva', 1.00, 'manual')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Negative keywords
  FOR kw IN SELECT unnest(ARRAY[
    'cofragem','armaduras','betão estrutural','alvenaria','reboco exterior','ETICS',
    'fachada','cobertura','impermeabilização exterior','drenagem','tubagem enterrada',
    'estrutura metálica','movimento de terras'
  ])
  LOOP
    INSERT INTO public.biblioteca_especialidade_keywords (especialidade_id, termo, tipo, peso, origem)
    VALUES (v_esp, kw, 'negativa', 1.00, 'manual')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
