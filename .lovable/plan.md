## Alteração da Especialidade 120

Renomear a Especialidade com código `120` de **"Equipamentos"** para **"Equipamentos e Instalações Especiais"**.

### Alterações

1. **Base de dados** (migration — UPDATE numa tabela existente, sem alteração de esquema):
   - `UPDATE public.biblioteca_especialidades SET nome = 'Equipamentos e Instalações Especiais', updated_at = now() WHERE codigo = '120';`
   - Mantém-se o `id`, o `codigo = 120` e todas as relações com Subespecialidades, Categorias e Artigos Mestre.

2. **Seeds / referências no código**:
   - Procurar (`rg "Equipamentos"`) em `src/` e `supabase/migrations/` por referências literais ao nome antigo da especialidade 120 (seeds iniciais, listas hardcoded, textos de UI, comentários).
   - Atualizar apenas as ocorrências que se referem à Especialidade 120 (não tocar em "Equipamentos Hospitalares", "Equipamentos Desportivos", etc., que serão futuras Subespecialidades).

3. **UI**: nenhuma alteração estrutural — as páginas da Biblioteca Mestra (`biblioteca-mestra.index.tsx`, `biblioteca-mestra.especialidades.tsx`, `biblioteca-mestra.subespecialidades.tsx`, `biblioteca-mestra.categorias.tsx`, `biblioteca-mestra.artigos.tsx`) lêem o nome da BD e refletem automaticamente a alteração.

### Fora de âmbito

- Criação das novas Subespecialidades listadas (Cozinhas Industriais, Equipamentos Hospitalares, etc.) — fica para fase seguinte, a fazer pela UI de Subespecialidades ou em plano dedicado.
- Qualquer alteração à Especialidade 110 (MEP).

### Ficheiros afetados

- Nova migration SQL com o `UPDATE` acima.
- Eventuais ficheiros em `src/` / `supabase/migrations/` com o nome antigo hardcoded (a confirmar em build mode com `rg`).
