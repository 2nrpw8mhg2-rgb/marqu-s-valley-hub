## Especialidade 080 — Construção Civil

Mesmo padrão usado nas 040/050/060/070: uma única operação SQL idempotente que popula toda a hierarquia, sem alterações de frontend.

### O que vai ser criado

**1 Especialidade**
- `080` — Construção Civil (ordem 80, ativa)

**10 Subespecialidades** (`080.01` a `080.10`)
- Alvenarias, Divisórias, Rebocos, Betonilhas, Regularizações, Isolamentos Incorporados, Impermeabilizações Correntes, Chaminés e Condutas de Alvenaria, Trabalhos Complementares, Ensaios e Controlo

**21 Categorias** com códigos sequenciais `080.XX.YY`
- 080.01: Alvenarias Exteriores, Alvenarias Interiores, Alvenarias Especiais
- 080.02: Divisórias Tradicionais, Divisórias Técnicas
- 080.03: Rebocos Interiores, Rebocos Exteriores
- 080.04: Betonilhas Tradicionais, Betonilhas Especiais
- 080.05: Regularização de Pavimentos, Regularização de Paredes
- 080.06: Isolamentos Térmicos, Isolamentos Acústicos
- 080.07: Impermeabilizações Interiores, Impermeabilizações de Base
- 080.08: Condutas
- 080.09: Remates, Preparação
- 080.10: Controlo de Qualidade, Receção

**~85 Artigos Mestre** — todos os listados no briefing, com `unidade_id=vg`, `tipo='outros'`, `estado_ia='validado'`, `ativo=true`.

**Keywords** (`biblioteca_especialidade_keywords`)
- 25 positivas (alvenaria, tijolo, bloco, reboco, betonilha, regularização, autonivelante, isolamento térmico/acústico, XPS, EPS, lã mineral, cortiça, membrana cimentícia, shaft, conduta, chaminé, etc.)
- 16 negativas (cofragem, armaduras, betão estrutural, ETICS, fachada ventilada, cobertura, telha, caixilharia, carpintaria, pavimento cerâmico/madeira, pintura, AVAC, etc.)

### Execução

- Se 080 já existir, apagar subespecialidades antigas (cascade) e inserir nova estrutura.
- Bloco `DO $$ ... $$` com estruturas `jsonb`.
- Sem alterações em código TS/React — aparece automaticamente no Explorador.
- Verificação final por contagens.
