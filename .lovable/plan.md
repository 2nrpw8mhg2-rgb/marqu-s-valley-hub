## Especialidade 040 — Movimento de Terras

Inserir na Biblioteca Mestra a Especialidade 040 com toda a estrutura hierárquica fornecida (subespecialidades, categorias, artigos mestre e palavras-chave), seguindo exatamente o mesmo padrão da Especialidade 030.

### Migração SQL (uma só)

Numa única migração idempotente (`ON CONFLICT DO NOTHING` nas chaves naturais), inserir em ordem:

1. **`biblioteca_especialidades`** — código `040`, nome `Movimento de Terras`, ativa.
2. **`biblioteca_subespecialidades`** — 10 registos (040.01 a 040.10):
   - 040.01 Preparação do Terreno
   - 040.02 Escavações
   - 040.03 Desaterros
   - 040.04 Transporte de Terras
   - 040.05 Aterros
   - 040.06 Compactação
   - 040.07 Regularização e Modelação
   - 040.08 Drenagens Provisórias
   - 040.09 Controlo Geotécnico
   - 040.10 Trabalhos Complementares
   
   O trigger `tg_subesp_por_classificar` cria automaticamente a categoria "Por Classificar" em cada uma.
3. **`biblioteca_categorias`** — todas as categorias listadas (ex.: Limpeza e Desmatação, Decapagem, Escavações Gerais, Escavações para Fundações, Escavações em Vala, Escavações Especiais, Remoção de Terras, Gestão de Material Escavado, Carga, Transporte, Descarga, Aterros Gerais, Reaterros, Enchimentos, Compactação Geral, Controlo de Compactação, Regularização, Modelação, Controlo de Água, Ensaios, Proteção, Limpeza Final), ligadas à respetiva subespecialidade, com código sequencial `040.XX.YY`.
4. **`biblioteca_artigos`** — todos os Artigos Mestre listados (≈90), associados à categoria correta. Campos preenchidos: `nome` (= texto fornecido), `descricao` igual ao nome, `unidade_id` deixada nula (a definir depois pelo utilizador), `tipo` default, `ativo = true`. Coerência subespecialidade/categoria é garantida pelo trigger `tg_artigo_categoria_coerencia`.
5. **`biblioteca_especialidade_keywords`** — palavras‑chave positivas e negativas da lista (tipo `positiva`/`negativa`) associadas à Especialidade 040.

### Sem alterações de UI

A nova especialidade aparece automaticamente no Explorador da Biblioteca Mestra (Especialidade → Subespecialidade → Categoria → Artigo Mestre) sem necessidade de alterar componentes. Nenhum código frontend é tocado.

### Notas

- Os artigos ficam sem unidade definida; podem ser editados depois para atribuir a unidade correta (m³, m², un, etc.).
- A migração é segura para reexecução (idempotente).
