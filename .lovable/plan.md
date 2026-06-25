# Fase 1 — Biblioteca Mestra do MV OS

## Objetivo
Construir o núcleo de conhecimento da aplicação. Toda a informação técnica passa a viver aqui e alimenta os restantes módulos (Orçamentação, Procurement, Financeira, IA).

Nesta fase **não** existe IA. Apenas a base sólida, editável e escalável.

---

## Nova arquitetura

```text
Especialidade
   └── Subespecialidade
          └── Artigo Mestre
                 ├── Palavras-chave (positivas / negativas)
                 ├── Observações
                 └── Unidade / Código / Estado
```

Os **Pacotes de Consulta** deixam de pertencer à Biblioteca. Continuam a existir no módulo **Procurement** como agrupamentos livres de artigos (cross-subespecialidade).

Os **Templates de Obra** definem que Pacotes de Consulta tipicamente se usam por tipo de obra (Reabilitação, Moradia, Edifício, Construção Nova) — **não** contêm artigos.

---

## Base de dados (novas tabelas)

Migração única, com GRANTs e RLS (acesso a utilizadores autenticados):

- `biblioteca_especialidades` — `nome`, `codigo`, `descricao`, `ordem`, `ativa`
- `biblioteca_subespecialidades` — `especialidade_id`, `nome`, `codigo`, `descricao`, `ordem`, `ativa`
- `biblioteca_artigos` — `subespecialidade_id`, `codigo`, `descricao`, `unidade`, `observacoes`, `ativo`
- `biblioteca_artigo_keywords` — `artigo_id`, `termo`, `tipo` ('positiva' | 'negativa')
- `templates_obra` — `nome`, `descricao`, `ativa`
- `template_obra_pacotes` — `template_id`, `pacote_id` (FK para `procurement_pacotes`)

Índices em FKs e em `lower(nome)` / `lower(termo)` para pesquisa global.

A tabela existente `artigos_biblioteca` (histórico de preços alimentado pelos orçamentos) **mantém-se intacta** — é outro conceito (preços de referência). Será apenas renomeada visualmente no menu para evitar confusão.

---

## Estrutura de navegação

Novo grupo no sidebar **"Biblioteca Mestra"**, substituindo o atual item "Biblioteca de Artigos":

```text
Biblioteca Mestra
 ├── Especialidades
 ├── Subespecialidades
 ├── Artigos Mestre
 ├── Palavras-chave
 └── Templates de Obra
```

Rotas TanStack (todas sob `_app/`):

- `biblioteca-mestra.tsx` — layout com `<Outlet />` + browser tipo Explorador
- `biblioteca-mestra.index.tsx` — vista raiz (explorador)
- `biblioteca-mestra.especialidades.tsx`
- `biblioteca-mestra.subespecialidades.tsx`
- `biblioteca-mestra.artigos.tsx`
- `biblioteca-mestra.keywords.tsx`
- `biblioteca-mestra.templates.tsx`

O item antigo "Biblioteca de Artigos" é renomeado para **"Histórico de Preços"** (mesma página, mesma tabela) — para não perder a informação já existente nem confundir conceitos.

Os Pacotes de Consulta permanecem em **Procurement → Pacotes de Consulta** (sem mudança nesta fase).

---

## Interface — Explorador de Conhecimento

Vista principal em duas colunas, semelhante ao Explorador do Windows:

```text
┌─────────────────────┬─────────────────────────────────┐
│ ▸ Estruturas        │  Subespecialidades de Estruturas│
│   ▾ Envolvente      │  ─────────────────────────────  │
│      • Fachadas     │  Nome      Código   Nº Artigos │
│      • ETICS        │  Fachadas  ENV-FAC      12     │
│   ▸ Acabamentos     │  ETICS     ENV-ETI       8     │
│   ▸ Especialidades  │  ...                            │
│   ▸ Arranjos Ext.   │                                 │
│   ▸ Finalização     │                                 │
└─────────────────────┴─────────────────────────────────┘
```

- Clique numa especialidade → painel direito lista subespecialidades
- Clique numa subespecialidade → lista artigos
- Clique num artigo → painel de detalhe (descrição, palavras-chave +/−, observações, estado)
- Toolbar superior com **pesquisa global** (nome, código, descrição, especialidade, subespecialidade, palavras-chave) e botões **+ Novo** contextuais
- Drag-and-drop / botões ↑↓ para reordenar especialidades
- Ações CRUD inline (editar, eliminar, ativar/desativar)

Componentes a criar em `src/components/biblioteca-mestra/`:
- `KnowledgeExplorer.tsx` (árvore + painel direito)
- `EspecialidadeForm.tsx`, `SubespecialidadeForm.tsx`, `ArtigoMestreForm.tsx`
- `KeywordEditor.tsx` (tags +/− por artigo)
- `TemplateObraForm.tsx`
- `GlobalSearch.tsx`

---

## Seed inicial (via migração)

**Especialidades:** Estruturas, Envolvente, Acabamentos, Especialidades Técnicas, Arranjos Exteriores, Finalização.

**Templates de Obra (vazios de pacotes):** Reabilitação, Moradia, Edifício, Construção Nova.

Subespecialidades e artigos serão criados pelo utilizador (ou importados posteriormente). Não migro automaticamente o catálogo hard-coded em `src/lib/procurement/especialidades.ts` — esse continua a alimentar o classificador legacy do Procurement até a Biblioteca Mestra estar populada.

---

## Fora do âmbito desta fase

- Qualquer funcionalidade de IA (sugestão de template, auto-classificação)
- Refactor do Procurement / Orçamentação para consumir a Biblioteca Mestra (será fase seguinte)
- Importação massiva de artigos a partir de mapas existentes

---

## Resumo da entrega

1. Migração SQL (6 tabelas + GRANTs + RLS + seed de especialidades e templates)
2. Novo grupo "Biblioteca Mestra" no sidebar; renomear "Biblioteca de Artigos" → "Histórico de Preços"
3. 6 rotas novas em `src/routes/_app/biblioteca-mestra.*`
4. Componentes do Explorador + formulários CRUD + pesquisa global
5. Sem alterações ao Procurement nem ao Orçamento nesta fase
