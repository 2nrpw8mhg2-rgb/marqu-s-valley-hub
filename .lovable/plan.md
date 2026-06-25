## Objetivo

Transformar a página **Categorias** num verdadeiro **Explorador da Biblioteca Mestra**, permitindo navegar até ao último nível (Artigos Mestre) sem mudar de página, e reposicionar o menu "Artigos Mestre" como pesquisa global.

---

## 1. Expansão de Categorias → Artigos Mestre (na página Categorias)

Na coluna direita de `biblioteca-mestra.categorias.tsx`, cada linha de categoria passa a ser **expansível** (estilo explorador de ficheiros):

- Adicionar uma seta `▶ / ▼` (ícones `ChevronRight` / `ChevronDown`) no início de cada linha.
- Toda a linha (ou o badge "N artigos") fica clicável para alternar expansão.
- Estado local: `Set<string>` com os IDs de categorias expandidas.
- Ao expandir pela primeira vez, fazer fetch dos artigos dessa categoria (`useQuery` por `categoria_id`, cacheado em `["bm-art-by-cat", categoria_id]`).
- Lista de artigos renderizada **indentada** por baixo da categoria, com:
  - Código (`codigo`)
  - Descrição
  - Unidade (`unidade`)
  - Tipo (Badge: Serviço/Material/Equipamento/Sistema/Outros)
  - Estado IA (Badge: validado / sugerido / por_classificar)
  - Nº de keywords (contagem a partir de `biblioteca_artigo_keywords`)
  - Estado Ativo/Inativo (Switch pequeno ou Badge)
- Ações por artigo (ícones à direita): **Editar**, **Duplicar**, **Mover**, **Eliminar**.
  - Para edição completa abre-se um **Dialog reaproveitando o formulário já existente** em `biblioteca-mestra.artigos.tsx` (extraído para um componente partilhado `ArtigoMestreFormDialog` em `src/components/biblioteca-mestra/`).
- Estado vazio: "Sem artigos nesta categoria — clique para adicionar".
- Botão **"+ Novo artigo"** dentro da categoria expandida, pré-preenchendo `especialidade_id / subespecialidade_id / categoria_id`.

Mantêm-se intactas as funcionalidades atuais de Categorias (criar/editar/eliminar/mover/reordenar).

## 2. Componente partilhado de Artigo Mestre

Extrair do ficheiro `biblioteca-mestra.artigos.tsx` (≈625 linhas) a UI do **Dialog de edição de Artigo** e a UI da **linha/card de artigo** para componentes reutilizáveis:

- `src/components/biblioteca-mestra/ArtigoMestreFormDialog.tsx` — criar/editar artigo (com keywords pos/neg, sugestão IA, etc.).
- `src/components/biblioteca-mestra/ArtigoMestreRow.tsx` — linha compacta com metadados e ações.

Ambos passam a ser usados tanto pelo Explorador (Categorias) como pela pesquisa global (página Artigos).

## 3. Renomear "Artigos Mestre" → "Pesquisa Global de Artigos"

- Em `src/components/AppSidebar.tsx`: renomear o item `"Artigos Mestre"` para `"Pesquisa de Artigos"` (mantendo a rota `/biblioteca-mestra/artigos`).
- A página `biblioteca-mestra.artigos.tsx` mantém-se como pesquisa transversal a toda a Biblioteca (filtros por especialidade/subesp/categoria/tipo/estado já existentes).
- Atualizar `PageHeader` para "Pesquisa Global de Artigos".

> Decisão: **não eliminamos** o menu — apenas o reposicionamos como pesquisa global, conforme sugerido. Se preferir eliminar por completo, dizei e removo o item da sidebar.

## 4. Detalhes técnicos

- Sem alterações de BD nem migrations — toda a informação necessária já existe (`biblioteca_artigos`, `biblioteca_artigo_keywords`).
- Queries novas:
  - `["bm-art-by-cat", catId]` — `select * from biblioteca_artigos where categoria_id = ?`
  - Contagem de keywords por artigo: aproveitar `["bm-kw"]` já existente (carrega todas) ou criar agregação por artigo.
- Invalidações: ao criar/editar/eliminar/mover artigo, invalidar `["bm-art"]`, `["bm-art-by-cat", *]` e `["bm-art-cat-counts"]`.
- Acessibilidade: setas de expandir com `aria-expanded` e `aria-controls`.

## 5. Fora de scope (para confirmar)

- "Ver relações com outros artigos" e "Ver histórico de preços" — funcionalidades novas que ainda não existem no projeto. **Proponho deixar fora desta entrega** e tratar em iteração separada quando definirmos a fonte de dados.

---

### Ficheiros afetados

- `src/routes/_app/biblioteca-mestra.categorias.tsx` (principal — adicionar expansão e lista de artigos)
- `src/routes/_app/biblioteca-mestra.artigos.tsx` (passa a usar componentes partilhados; título alterado)
- `src/components/biblioteca-mestra/ArtigoMestreFormDialog.tsx` (novo)
- `src/components/biblioteca-mestra/ArtigoMestreRow.tsx` (novo)
- `src/components/AppSidebar.tsx` (renomear label)
