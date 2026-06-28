
## Objetivo

Adicionar duas novas secções à sidebar `IA Explica` (`ClassificacaoSidePanel.tsx`):
1. **Como Ensinar a IA** — bloco de aprendizagem com ações rápidas (apenas para artigos sem classificação ou com confiança baixa).
2. **Biblioteca Analisada** — estatísticas reais do trabalho do motor.

Sem alterações de schema. Sem alterações ao algoritmo de classificação.

---

## 1. Secção "Como Ensinar a IA"

**Visibilidade:** apenas quando `estado === "sem_classificacao"` OU `confianca < 70`.

**Conteúdo:**
- Título + texto introdutório (português, conforme briefing).
- Grid 2 colunas com 5 botões:
  - ➕ **Criar Artigo Mestre** → navega para `/biblioteca-mestra/artigos?novo=1&desc=…`
  - 🏷 **Adicionar Palavra-chave** → abre `AddKeywordQuickDialog` (já existe)
  - 📋 **Criar Regra** → placeholder ("em breve") com toast
  - 🔗 **Criar Relação Construtiva** → navega para `/biblioteca-mestra/sistemas` (placeholder funcional)
  - ⏭ **Ignorar** → marca o registo `classificacao_artigos` com nota `ignorado` (campo `motivo` += `[ignorado]`), fecha sidebar, refresh

Nota: a maioria destes botões já existe na grid "Ações" no fundo do painel. Mantemos "Ações" e adicionamos a nova secção pedagógica **antes** das Ações, com texto explicativo + botões "Ignorar" novo. Para evitar duplicação visual, removo a grid "Ações" atual e consolido tudo em "Como Ensinar a IA" quando o artigo for não-classificado/baixa confiança. Para os restantes casos (validado/aceitar/corrigir) mantenho a grid "Ações" simplificada (Aceitar, Corrigir).

## 2. Secção "Biblioteca Analisada"

**Localização:** antes de "Ações", após o diagnóstico.

**Visibilidade:** sempre (em qualquer estado).

**Métricas reais (calculadas live no momento de abrir o painel):**

| Métrica | Fonte |
|---|---|
| Especialidades analisadas | `count(biblioteca_especialidades)` |
| Subespecialidades analisadas | `count(biblioteca_subespecialidades)` |
| Categorias analisadas | `count(biblioteca_categorias)` |
| Artigos Mestre analisados | `count(biblioteca_artigos where ativo)` |
| Palavras-chave analisadas | soma dos 3 `*_keywords` |
| Regras avaliadas | `0` por agora (motor formal não existe ainda) — mostrar "—" com tooltip "em breve" |
| Relações construtivas analisadas | `count(biblioteca_artigo_relacoes)` se a tabela existir, senão `—` |
| Artigos semelhantes comparados | `candidatos?.length ?? 0` deste artigo |
| Tempo total de análise | `run.concluido_em - run.iniciado_em` da última run carregada |

Implementação:
- Novo hook `useBibliotecaStats()` em `src/components/classificacao/useBibliotecaStats.ts` — faz `head: true, count: 'exact'` em paralelo. Cachado em React Query com `staleTime: 60s`, key `["biblioteca-stats"]`.
- Componente `BibliotecaAnalisadaSection` que renderiza grid 2 colunas com `label / valor` formatado (`toLocaleString("pt-PT")`).
- Mensagem inferior quando `sem_classificacao`:
  > "O artigo foi analisado em toda a Biblioteca Mestra. Neste momento ainda não existe conhecimento suficiente para atribuir uma classificação automática com confiança elevada."
- Após cada ação que enriquece a biblioteca (palavra-chave guardada, etc.), invalida `["biblioteca-stats"]` para refletir o novo conhecimento de imediato.

## Ficheiros

**Novos:**
- `src/components/classificacao/BibliotecaAnalisadaSection.tsx`
- `src/components/classificacao/ComoEnsinarIASection.tsx`
- `src/components/classificacao/useBibliotecaStats.ts`

**Editado:**
- `src/components/classificacao/ClassificacaoSidePanel.tsx` — inserir as duas secções; condicionar a grid "Ações" existente.

## Fora do âmbito

- Motor de regras formal (mantém placeholder).
- Tabela `biblioteca_artigo_relacoes` — só lemos se existir; valor `—` caso contrário.
- Função "Ignorar" como estado persistente formal — usamos flag no `motivo` (mudança mínima, sem migração).
