## Especialidade 030 — Demolições e Gestão de Resíduos

Popular a Biblioteca Mestra com a estrutura completa da Especialidade 030, seguindo o mesmo padrão usado para a Especialidade 020.

### 1. Subespecialidades (10 novas)

Inserir em `biblioteca_subespecialidades` (especialidade 030):

- 030.01 — Demolições Gerais
- 030.02 — Demolições Estruturais
- 030.03 — Demolições Não Estruturais
- 030.04 — Desmontagens Técnicas
- 030.05 — Desmontagem de Instalações Técnicas
- 030.06 — Separação e Triagem de Resíduos
- 030.07 — Transporte e Gestão de RCD
- 030.08 — Resíduos Especiais
- 030.09 — Limpeza Pós-Demolição
- 030.10 — Monitorização e Controlo

Se já existirem subespecialidades vazias na 030 com nomes conflituantes, renomear com sufixo "(antigo)" antes da inserção (mesma estratégia da 020).

O trigger `tg_subesp_por_classificar` cria automaticamente a categoria "Por Classificar" em cada nova subespecialidade.

### 2. Categorias manuais (20 no total)

Inserir em `biblioteca_categorias`, distribuídas pelas subespecialidades acima:

- 030.01: Demolições Totais, Demolições Parciais
- 030.02: Betão, Estruturas Metálicas
- 030.03: Alvenarias, Acabamentos
- 030.04: Carpintarias, Caixilharias
- 030.05: Instalações
- 030.06: Separação, Triagem
- 030.07: Transporte, Gestão
- 030.08: Resíduos Perigosos, Resíduos Especiais
- 030.09: Limpeza, Preparação
- 030.10: Controlo

### 3. Artigos Mestre (~85 artigos)

Inserir em `biblioteca_artigos` todos os artigos listados no pedido, com:

- `unidade_id` correspondente a `vg` (mesma convenção da 020)
- `tipo = 'outros'`
- `estado_ia = 'validado'`
- `ativo = true`

### 4. Palavras-chave da Especialidade

Inserir em `biblioteca_especialidade_keywords` para a especialidade 030:

- 16 positivas (demolição, desmontagem, remoção, picagem, corte, desmantelamento, entulho, resíduos, RCD, triagem, separação, operador licenciado, guia de resíduos, amianto, fibrocimento, limpeza pós-demolição)
- 10 negativas (fundação, cofragem, armadura, betão novo, reboco novo, pintura nova, instalação nova, pavimento novo, cobertura nova, fornecimento) — nota: "execução" é demasiado genérica, será omitida ou marcada com peso reduzido para evitar falsos negativos

### Notas técnicas

- Operação puramente de dados (INSERT/UPDATE), sem migrações de schema nem alterações de frontend.
- Verificação final por SQL: contagem de subespecialidades, categorias, artigos e keywords inseridas.
- Caso encontre conflitos de código/nome na 030, aplica-se o mesmo padrão de "(antigo)" usado na 020.
