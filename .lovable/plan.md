## Especialidade 070 — Estruturas

Mesmo padrão usado nas 040/050/060: uma única operação SQL idempotente que popula toda a hierarquia, sem alterações de frontend.

### O que vai ser criado

**1 Especialidade**
- `070` — Estruturas (ordem 70, ativa)

**10 Subespecialidades** (`070.01` a `070.10`)
- Fundações, Cofragens, Armaduras, Betão, Estruturas Metálicas, Estruturas de Madeira, Pré-fabricados, Estruturas Mistas, Reforço Estrutural, Ensaios e Controlo Estrutural

**24 Categorias** com códigos sequenciais `070.XX.YY`
- 070.01: Fundações Diretas, Fundações Profundas, Blocos de Fundação
- 070.02: Cofragens Horizontais, Cofragens Verticais, Sistemas de Cofragem, Escoramentos
- 070.03: Aço em Varão, Malhas, Armaduras Especiais
- 070.04: Betão Estrutural, Betonagem, Tratamentos
- 070.05: Perfis, Montagem
- 070.06: Madeira Estrutural, Ligações
- 070.07: Betão Pré-fabricado, Elementos Especiais
- 070.08: Betão + Aço, Betão + Madeira
- 070.09: Reforço em Betão, Reforço Metálico, Reforço com Compósitos
- 070.10: Controlo de Qualidade, Monitorização

**~110 Artigos Mestre** — todos os listados no briefing, com `unidade_id`=`vg`, `tipo='outros'`, `estado_ia='validado'`, `ativo=true`.

**Keywords** (`biblioteca_especialidade_keywords`)
- 34 positivas (fundação, sapata, estaca, cofragem, armadura, betão, betonagem, estrutura metálica, CLT, CFRP, etc.)
- 14 negativas (reboco, pintura, cerâmica, cobertura, impermeabilização, ETICS, caixilharia, AVAC, etc.)

### Execução

- Se a especialidade `070` já existir vazia, apagar as suas subespecialidades antigas (cascade) e inserir a nova estrutura — tal como foi feito para 060.
- Bloco `DO $$ ... $$` com estruturas `jsonb`.
- Sem alterações em código TS/React — aparece automaticamente no Explorador.
- Verificação final por contagens (subespecialidades, categorias, artigos, keywords).
