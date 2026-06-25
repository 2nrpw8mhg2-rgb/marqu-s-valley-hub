# Especialidade 100 — Acabamentos Interiores

Populate the master library with Especialidade 100, following the exact same pattern as 070/080/090.

## Single SQL migration

File: `src/migrations/100_populate_acabamentos_interiores.sql` (idempotent `DO $$ ... $$` block).

1. Upsert `biblioteca_especialidades` row: `codigo='100'`, `nome='Acabamentos Interiores'`, `ordem=100`, `ativo=true`.
2. Cascade delete any existing subespecialidades of 100, then insert the 10 new subespecialidades (100.01–100.10):
   - Pavimentos Interiores, Tetos, Revestimentos de Paredes, Pinturas, Carpintarias Interiores, Serralharias Interiores, Vidros e Espelhos, Equipamentos Sanitários, Cozinhas e Equipamentos Fixos, Limpeza e Receção Final.
3. Insert ~26 user-defined `biblioteca_categorias` (Pavimentos Cerâmicos, Madeira, Vinílicos, Têxteis, Técnicos, Contínuos, Tetos Falsos, Tetos Decorativos, Cerâmicos, Madeira, Vinílicos, Especiais, Pinturas Interiores, Pinturas Técnicas, Tratamentos, Portas, Roupeiros, Rodapés e Guarnições, Escadas, Mobiliário Fixo, Guardas, Estruturas, Vidros, Espelhos, Louças Sanitárias, Bases e Banheiras, Torneiras e Acessórios, Cozinhas, Equipamentos, Limpeza, Receção). Plus the 10 auto "Por Classificar" inserted by the existing trigger. Sequential codes `100.XX.YY`.
4. Insert ~115 `biblioteca_artigos` (all master items listed) with `unidade_id` for `vg`, `tipo='outros'`, `estado_ia='validado'`, `ativo=true`, linked to their categoria + subespecialidade.
5. Insert keywords into `biblioteca_especialidade_keywords`: ~39 positive (pavimento, mosaico, porcelânico, cerâmica, soalho, parquet, flutuante, vinílico, SPC, LVT, microcimento, epóxi, teto falso, pladur, gesso cartonado, teto desmontável, pintura, tinta, barramento, primário, porta interior, aro, rodapé, roupeiro, carpintaria, serralharia, corrimão, guarda, vidro, espelho, sanita, lavatório, base de duche, torneira, cozinha, bancada, armário, mobiliário) + 13 negative (cofragem, armaduras, betão estrutural, alvenaria, reboco exterior, ETICS, fachada, cobertura, impermeabilização exterior, drenagem, tubagem enterrada, estrutura metálica, movimento de terras).

## Verification

Query DB to confirm: 1 especialidade `100`, 10 subespecialidades, ~36 categorias (26 + 10 auto), ~115 artigos, ~52 keywords.

## No frontend changes

Especialidade 100 appears automatically in the Explorer.
