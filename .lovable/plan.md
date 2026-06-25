## Simplificar estados dos Artigos Mestre

Reduzir o enum `biblioteca_artigo_estado_ia` aos três estados oficiais e ajustar a UI da Biblioteca Mestra.

### 1. Migração de base de dados

Recriar o tipo `biblioteca_artigo_estado_ia` apenas com:
- `validado`
- `criado_auto`
- `obsoleto`

Passos da migração (num único bloco):
1. Criar novo tipo `biblioteca_artigo_estado_ia_new` com os três valores.
2. Em `biblioteca_artigos`: remover o `DEFAULT` antigo, mapear valores existentes (`pendente` → `validado`, `revisto` → `validado`, `criado_auto` → `criado_auto`, `validado` → `validado`), converter a coluna para o novo tipo e voltar a aplicar `DEFAULT 'validado'`.
3. `DROP TYPE` antigo e renomear o novo para `biblioteca_artigo_estado_ia`.

Resultado: o default passa a ser `validado`, eliminando o "Pendente de validação" para tudo o que é criado manualmente.

### 2. Frontend

- `src/lib/biblioteca-mestra/types.ts`
  - `ArtigoEstadoIA = "validado" | "criado_auto" | "obsoleto"`
  - `ARTIGO_ESTADOS_IA`:
    - `validado` — label "Validado", ponto verde
    - `criado_auto` — label "IA", ponto azul
    - `obsoleto` — label "Obsoleto", ponto amarelo
  - Sem entradas vermelhas / sem `pendente` / sem `revisto`.

- `src/components/biblioteca-mestra/ArtigoMestreFormDialog.tsx` e `src/routes/_app/biblioteca-mestra.artigos.tsx`
  - O seletor de estado no formulário passa a mostrar apenas os três valores acima (já lê de `ARTIGO_ESTADOS_IA`, basta a lista nova).
  - Default ao criar manualmente continua `validado` (já está).
  - O badge da coluna "Estado" nas listagens (artigos e categorias) usa automaticamente os novos labels/cores.

- `src/routes/_app/biblioteca-mestra.artigos.tsx`
  - Filtro de estado: as opções do `Select` passam a ser as três novas (sem "Pendente"/"Revisto").

### 3. Validação

- Após a migração: confirmar contagens por estado em `biblioteca_artigos`.
- Verificar no Explorador que nenhum artigo aparece com badge vermelho de "Pendente de validação".

### Notas

- Não se acrescenta agora um botão "Validar Artigo" — só fará sentido quando existirem agentes de IA a criar artigos com `criado_auto`. A infraestrutura (estado + badge azul) fica preparada.
- Eliminar artigos continua possível; "Obsoleto" é uma escolha do utilizador via edição (sem fluxo dedicado neste passo).
