## Norma Global de Idioma — Português de Portugal (pt-PT)

Estabelecer pt-PT como norma transversal do MV OS, com efeito imediato em todo o conteúdo gerado pela IA e em toda a UI futura.

### 1. Memória de projeto (regra permanente)

Criar duas entradas em `mem://`:

- **`mem://index.md` — Core** (sempre em contexto, aplicada a TODAS as ações):
  - "Idioma único: Português de Portugal (pt-PT). Nunca pt-BR, inglês ou mistura. Aplica-se a UI, mensagens, IA, logs, conhecimento gerado."
  - "Terminologia técnica de construção civil pt-PT: betão (não concreto), cofragem (não forma), tubagem (não tubulação), caixilharia, mapa de quantidades, dono de obra, empreitada, etc."

- **`mem://constraints/idioma-ptpt.md`** — lista detalhada de termos a usar / a evitar (Utilizar: Guardar, Eliminar, Editar, Gerar, Aprovar, Conhecimento, Ocorrências, Confiança, Peso, Estado, Fontes analisadas, Betão, Cofragem, Armadura, Tubagem, Caixilharia, Laje, Sapata, Viga, Pilar, Caleira, Impermeabilização, Gesso cartonado, etc. / Evitar: Salvar, Deletar, Excluir, Build, Update, Score, Knowledge Base, Concreto, Forma, Concretagem, Tubulação, Contrapiso, Piso cerâmico, etc.) + regra de normalização "Concreto armado → Betão armado".

### 2. Reforço no prompt do Knowledge Builder

Editar `src/lib/biblioteca-mestra/knowledge-builder.server.ts` (função `buildPrompt`):

- Adicionar bloco **REGRAS DE IDIOMA (OBRIGATÓRIO)** no início do prompt:
  - "Todo o output deve estar em **Português de Portugal (pt-PT)**. Nunca pt-BR, nunca inglês."
  - Tabela de normalização explícita: `concreto→betão`, `concreto armado→betão armado`, `forma→cofragem`, `concretagem→betonagem`, `tubulação→tubagem`, `contrapiso→camada de regularização`, `piso cerâmico→pavimento cerâmico`, `argamassa colante→cimento-cola`.
  - "Se um termo aparecer em pt-BR nas FONTES, regista o equivalente pt-PT como termo principal e o pt-BR como **sinónimo** (relação de equivalência para reconhecimento futuro)."
  - "Justificações também em pt-PT, sem anglicismos."

### 3. Auditoria leve da UI atual

Sem alterar layout, fazer varrimento e substituir ocorrências pontuais em componentes do Knowledge Builder e Biblioteca Mestra que estejam fora da norma:
- "Salvar" → "Guardar", "Deletar"/"Excluir" → "Eliminar", "Score" → "Confiança", "Update" → "Atualizar", "Knowledge Base" → "Base de Conhecimento".

Âmbito desta auditoria nesta iteração: ficheiros em `src/components/biblioteca-mestra/`, `src/routes/_app/biblioteca-mestra*`, `src/lib/biblioteca-mestra/`. Restantes módulos serão tratados à medida que forem tocados (a regra Core garante consistência futura).

### Fora do âmbito

- Sem alterações de BD, schemas ou nomes de colunas.
- Sem i18n / sistema de tradução — pt-PT é a única língua suportada.
- Sem reescrita massiva de toda a plataforma neste turno; a memória Core garante que qualquer trabalho futuro respeita a norma.
