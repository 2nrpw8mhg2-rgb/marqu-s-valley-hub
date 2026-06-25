# Especialidade 090 — Envolvente

Popular a Biblioteca Mestra com a Especialidade 090, seguindo exatamente o mesmo padrão usado nas Especialidades 070 e 080.

## O que será criado

**1 Migration SQL** (`src/migrations/090_populate_envolvente.sql`), idempotente, num bloco `DO $$ ... $$`:

1. **Especialidade**
   - `090` — "Envolvente", `ordem=90`, `ativo=true`

2. **10 Subespecialidades** (`090.01` → `090.10`)
   - Coberturas, Impermeabilizações, ETICS, Fachadas Ventiladas, Revestimentos Exteriores, Cantarias, Caixilharias Exteriores, Serralharias Exteriores, Isolamentos Exteriores, Ensaios e Controlo

3. **Categorias** (~24 user-defined + 10 "Por Classificar" automáticas via trigger)
   - Códigos sequenciais `090.XX.YY` conforme estrutura enviada

4. **Artigos Mestre** (~110 artigos) com:
   - `unidade_id` = unidade `vg` (igual a 070/080)
   - `tipo='outros'`
   - `estado_ia='validado'` (oficial — segundo a regra recentemente aplicada à Biblioteca Mestra)
   - `ativo=true`

5. **Keywords** (`biblioteca_especialidade_keywords`)
   - 36 positivas + 13 negativas conforme listas enviadas

## Comportamento

- Se a Especialidade `090` já existir, as subespecialidades existentes são removidas em cascata e reinseridas (mesma estratégia das 070/080).
- A categoria "Por Classificar" é criada automaticamente pelo trigger `tg_subesp_por_classificar` em cada subespecialidade.
- Sem alterações de frontend — a nova especialidade aparece automaticamente no Explorer da Biblioteca Mestra.

## Ficheiros afetados

- `src/migrations/090_populate_envolvente.sql` (criado)

## Verificação pós-execução

Confirmar via `read_query`:
- 1 especialidade `090`
- 10 subespecialidades
- ~34 categorias (24 + 10 automáticas)
- ~110 artigos
- 49 keywords
