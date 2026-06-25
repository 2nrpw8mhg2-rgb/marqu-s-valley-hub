## Especialidade 060 — Redes Hidráulicas e Enterradas

Seguir o mesmo padrão usado nas Especialidades 040 (Movimento de Terras) e 050 (Contenções): uma única migração SQL idempotente que popula toda a hierarquia, sem alterações de frontend (o Explorador já mostra automaticamente novas especialidades).

### O que vai ser criado

**1 Especialidade**
- `060` — Redes Hidráulicas e Enterradas (ordem 60, ativo)

**10 Subespecialidades** (`060.01` a `060.10`)
- Rede de Abastecimento de Água
- Rede de Saneamento Doméstico
- Rede de Águas Pluviais
- Drenagens
- Reservatórios e Depósitos
- Estações Elevatórias
- ETAR e Tratamento de Águas
- Ensaios e Colocação em Serviço
- Trabalhos Complementares
- Monitorização e Controlo

**~25 Categorias** com códigos sequenciais `060.XX.YY`
- 060.01: Tubagens, Acessórios, Órgãos Hidráulicos, Ligações
- 060.02: Coletores, Caixas, Ligações
- 060.03: Coletores, Captação, Descarga
- 060.04: Drenagem Periférica, Drenagem de Pavimentos
- 060.05: Reservatórios, Equipamentos
- 060.06: Obras Civis, Equipamentos
- 060.07: Tratamento, Equipamentos
- 060.08: Ensaios, Comissionamento
- 060.09: Proteção, Identificação
- 060.10: Controlo

**~95 Artigos Mestre** (todos os listados no briefing)
- `unidade_id` = unidade `vg` (vazia/genérica), `tipo='outros'`, `estado_ia='pendente'`, `ativo=true`

**Keywords da especialidade** (`biblioteca_especialidade_keywords`)
- 27 positivas (abastecimento de água, saneamento, PEAD, PVC, coletor, válvula, ETAR, etc.)
- 13 negativas (cofragem, armaduras, betão estrutural, AVAC, ITED, etc.)

### Detalhes técnicos

- Ficheiro: `src/migrations/060_populate_redes_hidraulicas.sql`
- Bloco `DO $$ ... $$` com estruturas `jsonb` para definir hierarquia
- `ON CONFLICT DO NOTHING` em todas as inserções (idempotente / re-executável)
- Sem alterações em código TS/React — a nova especialidade aparece automaticamente no Explorador da Biblioteca Mestra (Especialidade → Subespecialidade → Categoria → Artigo Mestre)
- Verificação final por contagens (subespecialidades, categorias, artigos, keywords)
