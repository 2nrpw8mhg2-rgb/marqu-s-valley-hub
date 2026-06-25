## Fase 2 — Subespecialidades da Biblioteca Mestra

A tabela `biblioteca_subespecialidades` já tem todas as colunas necessárias (`especialidade_id`, `nome`, `codigo`, `descricao`, `ordem`, `ativa`). **Nenhuma alteração de schema.** Foco em UX + seed.

### 1. Nova interface master/detail (substitui a tabela atual)

`src/routes/_app/biblioteca-mestra.subespecialidades.tsx` reescrito:

```text
┌────────────────────────┬─────────────────────────────────────────┐
│ Especialidades         │  [Especialidade selecionada]    [+Nova] │
│ ──────────────         │  ─────────────────────────────────────  │
│ ▸ 010 Preparação    3  │  🔍 pesquisar nome / código             │
│ ▸ 020 Inst. Prov.   7  │                                         │
│ ● 070 Estruturas    7  │  ⇅  Cód  Nome           Estado   Ações  │
│ ▸ 080 Const. Civil  3  │  ↑↓  051  Fundações     ●Ativa  ✎ ⇆ 🗑  │
│ ▸ ...                  │  ↑↓  052  Cofragens     ●Ativa  ✎ ⇆ 🗑  │
└────────────────────────┴─────────────────────────────────────────┘
```

- **Coluna esquerda (≈ 320px)**: lista das 14 especialidades, com contador de subespecialidades por especialidade; clique seleciona; estilo realçado para a ativa.
- **Coluna direita**: cabeçalho com nome da especialidade selecionada + botão "Nova subespecialidade" + pesquisa local (nome/código). Lista das subespecialidades dessa especialidade.
- **Pesquisa global** (acima das duas colunas): pesquisa por nome/código em todas; ao escrever, a coluna esquerda mostra contadores dos resultados e a direita lista todos os matches (com etiqueta da especialidade) — permite cumprir o requisito "pesquisa por especialidade/nome/código" sem perder a navegação.

### 2. Funcionalidades por subespecialidade

- **Criar / Editar** via Dialog (Nome*, Código, Descrição, Ordem, Ativa) — a Especialidade vem pré-selecionada da coluna esquerda mas pode ser alterada.
- **Eliminar** via AlertDialog. Bloqueado se existirem artigos associados (futuro — por agora apenas confirmação).
- **Reordenar** com botões ↑/↓ que trocam `ordem` com a linha vizinha (mutation batch de 2 updates).
- **Mover para outra Especialidade** com botão ⇆ que abre um pequeno Dialog com Select das especialidades.
- **Ativar/Desativar** toggle inline (Switch na linha).

### 3. Seed inicial de subespecialidades

Migração de dados (via insert tool) que popula subespecialidades padrão para cada especialidade, com `codigo` sequencial dentro da especialidade (ex.: `070.10`, `070.20`, ...) e `ordem` em múltiplos de 10:

| Especialidade | Subespecialidades |
|---|---|
| 010 Preparação da Obra | Implantação Topográfica, Sondagens, Trabalhos Preparatórios, Desmatação |
| 020 Instalações Provisórias | Estaleiro, Tapumes, Contentores, Água Provisória, Eletricidade Provisória, Sinalização de Obra, Proteções Coletivas, IS Provisórias |
| 030 Demolições e Gestão de Resíduos | Demolições Estruturais, Demolições Não-Estruturais, Remoções, Transporte e Deposição RCD |
| 040 Movimento de Terras | Escavações, Aterros, Desaterros, Compactações, Modelação de Terreno, Transporte de Terras |
| 050 Contenções | Muros de Berlim, Estacas, Microestacas, Pregagens, Cortinas de Contenção, Ancoragens |
| 060 Infraestruturas | Redes de Águas, Redes de Esgotos, Redes Pluviais, Drenagens, Caixas de Visita, Redes Enterradas, ETAR, Reservatórios, Estações Elevatórias |
| 070 Estruturas | Fundações, Cofragens, Armaduras, Betão, Estruturas Metálicas, Pré-fabricados, Reparação Estrutural |
| 080 Construção Civil | Alvenarias, Rebocos, Betonilhas |
| 090 Envolvente | ETICS, Fachadas, Cobertura, Impermeabilizações, Cantarias, Isolamentos, Claraboias |
| 100 Acabamentos Interiores | Tetos Falsos, Pladur, Revestimentos de Parede, Revestimentos de Pavimento, Pinturas, Carpintarias, Caixilharias, Serralharias, Espelhos, Louças e Torneiras |
| 110 Especialidades Técnicas (MEP) | Eletricidade, ITED, SCIE, AVAC, Ventilação, Águas e Esgotos, Gás, Domótica, CCTV, Controlo de Acessos, Fotovoltaico, Bomba de Calor, Elevadores, Automação |
| 120 Equipamentos | Eletrodomésticos, Equipamentos Sanitários, Lavandarias, Equipamentos Industriais |
| 130 Arranjos Exteriores | Pavimentos Exteriores, Muros, Jardins, Rega, Piscinas, Portões, Vedação, Iluminação Exterior |
| 140 Finalização e Entrega | Limpeza Final, Ensaios, Comissionamento, Telas Finais, Certificações |

Total: ~95 subespecialidades-base. Como ainda não há artigos associados, a inserção é segura (limpa primeiro a tabela `biblioteca_subespecialidades`).

### 4. Fora de âmbito (próximas fases)

- Artigos Mestre e ligação Subespecialidade → Artigos (Fase 3).
- Pacotes de Consulta (módulo Procurement futuro).
- Drag-and-drop de reordenação — usa-se ↑/↓ por simplicidade e consistência.
- Classificação automática / IA.

### Arquivos afetados

- **Reescrito:** `src/routes/_app/biblioteca-mestra.subespecialidades.tsx`
- **Seed de dados:** insert SQL em `public.biblioteca_subespecialidades`
- **Sem migração de schema, sem alterações noutros ficheiros.**
