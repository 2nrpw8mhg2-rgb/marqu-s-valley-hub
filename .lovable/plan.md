
# Refinamento do Centro de Classificação Inteligente

Transformar a página `motor-classificacao.tsx` num verdadeiro ambiente colaborativo entre utilizador e IA, com explicações claras, ações rápidas e visualização rica.

## 1. Tabela — novas colunas

Substituir a tabela atual por:

| Artigo Original | Classificação (hierarquia) | Resultado IA | Confiança (barra + %) | Próxima Ação | Ações |

**Coluna "Classificação"** (substitui "Especialidade/Sub" + "Artigo Mestre"):
- Renderiza breadcrumb vertical compacto:
  ```
  070 Estruturas
   ↓ Cofragens
   ↓ Cofragem de Pilares
  ```
- Quando vazio: badge cinza "Sem destino".

**Coluna "Resultado IA"** (nova) — badge colorida derivada de `metodo_match` + `estado`:
- 🟢 Exata (`exato` com 1 match)
- 🟣 Aprendida (`aprendido`)
- 🟡 Por Regras / Keywords (`keyword_*`)
- 🔵 Por Relações (futuro — placeholder já preparado)
- ⚪ Sem Correspondência (`nenhum`)
- 🟠 Manual (`manual`)

**Coluna "Confiança"** — barra horizontal + percentagem:
```
█████████░ 92%
```
Cor: verde ≥90, âmbar 70-89, vermelho <70, cinza =0.

**Coluna "Próxima Ação"** (nova) — chip clicável calculada por regras:
- `validado` → "✓ Validado" (sem ação)
- `classificado_auto` + conf ≥90 → "Aceitar"
- `necessita_revisao` → "Corrigir"
- `sem_classificacao` com tokens existentes → "Criar Palavra-chave"
- `sem_classificacao` sem matches → "Criar Artigo Mestre"
- exatos múltiplos → "Escolher candidato"

Clicar executa diretamente a ação ou abre o painel no separador correspondente.

## 2. Painel Lateral (substitui o modal)

Substituir `ClassificacaoDetailDialog` por novo `ClassificacaoSidePanel` baseado em `Sheet` (shadcn) — abre à direita com largura ~560px, scrollável, ao clicar na linha ou na lupa.

### Estrutura do painel

**Header fixo**
- Descrição do artigo original (truncável)
- Badge de Resultado IA + barra de confiança

**Secção: Artigo Original**
- Descrição completa
- Quantidade · Unidade

**Secção: Sugestão da IA**
- Breadcrumb: Especialidade → Subespecialidade → Categoria → Artigo Mestre
- Mostrar quando vazia: "Nenhuma sugestão disponível"

**Secção: "IA Explica" (porquê?)**
Fluxo vertical com passos numerados:
1. **Normalização** — mostra `descricao_original` → versão normalizada (computar via `normalizar()`)
2. **Palavras-chave encontradas** — lista de chips (positivas e negativas) com nível e pontos
3. **Regras aplicadas** — placeholder (vazio nesta fase; arquitetura pronta)
4. **Relações construtivas** — placeholder (vazio; preparado para Fase 3)
5. **Artigos semelhantes** — lista dos `candidatos` com score
6. **Decisão final** — artigo mestre escolhido + confiança final

Se `sem_classificacao`, esta secção mostra uma checklist explicativa:
- ✗ Nenhuma palavra-chave conhecida encontrada
- ✗ Nenhuma regra corresponde
- ✗ Nenhum Artigo Mestre semelhante
- ✗ Nenhuma relação construtiva encontrada
- Com sugestão concreta de como melhorar a Biblioteca.

**Secção: Ações**
Grid de botões:
- **Aceitar** (verde) — valida com artigo atual
- **Corrigir** — abre `SearchBibliotecaDialog` por cima
- **Criar Artigo Mestre** — navega para `/biblioteca-mestra/artigos?novo=1&desc=…`
- **Adicionar Palavra-chave** — abre quick-dialog para adicionar termo à subesp/artigo selecionado
- **Criar Regra** — placeholder com toast "em breve"
- **Adicionar Relação** — navega para diálogo de relações do artigo

## 3. Cabeçalho — Botão "Reexecutar Motor IA"

- Renomear "Reprocessar classificação" → **"Reexecutar Motor IA"** com ícone `Sparkles`.
- Subtítulo do botão (tooltip): "Aplica novas palavras-chave, regras, relações e Artigos Mestre"

## 4. KPI "Aprendido" — evolução

`StatCard "Aprendido"` mostra dois valores:
- Valor grande: `+N nesta classificação` (vem do `run.auto_aprendido`)
- Sublinha menor: `N total na memória` — query `classificacao_memoria` count.

## 5. Helpers / arquivos

**Novo**: `src/components/classificacao/ClassificacaoSidePanel.tsx` — Sheet com toda a estrutura acima.

**Novo**: `src/components/classificacao/ResultadoIABadge.tsx` — badge colorida por método.

**Novo**: `src/components/classificacao/ConfiancaBar.tsx` — barra horizontal + %.

**Novo**: `src/components/classificacao/ProximaAcaoChip.tsx` — calcula e renderiza a próxima ação, recebe callbacks.

**Novo**: `src/components/classificacao/AddKeywordQuickDialog.tsx` — diálogo rápido para criar `biblioteca_subespecialidade_keywords` ou `biblioteca_artigo_keywords`.

**Editar**: `src/routes/_app/motor-classificacao.tsx`
- Substituir colunas da tabela.
- Trocar `ClassificacaoDetailDialog` por `ClassificacaoSidePanel`.
- Renomear botão.
- KPI Aprendido com total da memória.

**Manter**: `ClassificacaoDetailDialog.tsx` deixa de ser usado mas mantém-se (sem remover) caso seja reaproveitado.

**Engine**: nenhuma alteração ao `engine.ts` — toda a informação necessária já existe em `candidatos`, `motivo`, `metodo_match`.

## Out of scope (futuras fases)
- Motor de Regras formal (passo 3 do "IA Explica" fica como placeholder visível).
- IA semântica / embeddings.
- Sincronização visual com Motor de Relações além de placeholders.

## Resultado esperado
Tabela mais informativa (Classificação completa + Resultado IA + barra de confiança + Próxima Ação), painel lateral rico em vez de modal apertado, explicação transparente do raciocínio da IA, ações de aprendizagem (aceitar/corrigir/criar keyword/criar artigo mestre) acessíveis num clique a partir do mesmo painel.
