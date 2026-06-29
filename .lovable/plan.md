## Problema

Na Fase 1 adicionei a aba **"Conhecimento IA"** ao componente `ArtigoMestreFormDialog.tsx`, mas a página **"Pesquisa de Artigos"** (`/biblioteca-mestra/artigos`) **não usa esse componente** — tem um `Dialog` inline próprio com o mesmo formulário duplicado. Resultado: as abas existem no código mas nunca aparecem ao utilizador.

## Solução

Adicionar as abas ao diálogo inline da rota `src/routes/_app/biblioteca-mestra.artigos.tsx`, sem refactor maior (mantém compatibilidade total).

### Alterações

**Ficheiro único: `src/routes/_app/biblioteca-mestra.artigos.tsx`**

1. Importar:
   - `Tabs, TabsContent, TabsList, TabsTrigger` de `@/components/ui/tabs`
   - `ArtigoConhecimentoTab` de `@/components/biblioteca-mestra/ArtigoConhecimentoTab`

2. Dentro do `<DialogContent>` (linha ~438), envolver o formulário existente num `<Tabs defaultValue="geral">`:
   - **Aba "Geral"** — todo o formulário atual (subespecialidade, categoria, código, unidade, tipo, estado IA, descrição, observações, ativo, keywords positivas/negativas) sem qualquer alteração.
   - **Aba "Conhecimento IA"** — renderiza `<ArtigoConhecimentoTab artigoId={editing?.id ?? null} />`. Se o artigo ainda não foi guardado, o próprio componente já mostra a mensagem "Guarda o artigo primeiro…".

3. Ajustar `max-w-2xl` → `max-w-3xl` no `DialogContent` para a tabela de conhecimento respirar.

4. Adicionar `max-h-[70vh] overflow-y-auto` ao `TabsContent` da aba Geral para manter o comportamento atual de scroll.

### Não alterado

- `ArtigoMestreFormDialog.tsx` permanece (continua correto, mas atualmente não usado por esta rota — fica disponível caso seja reutilizado noutro sítio).
- `ArtigoConhecimentoTab.tsx` — sem alterações.
- Motor de classificação, migração, tipos, RLS — **nada muda**.

### Validação

1. Abrir **Biblioteca Mestra → Pesquisa de Artigos** → editar um artigo existente.
2. Confirmar que aparecem as duas abas **Geral** | **Conhecimento IA** no topo do diálogo.
3. Geral continua a funcionar exatamente como antes (guardar, keywords, etc.).
4. Conhecimento IA carrega a tabela vazia + botão "Adicionar"; adicionar/editar/desativar/remover um registo persiste.
5. Criar artigo novo → aba Conhecimento IA mostra a mensagem "Guarda o artigo primeiro…".
