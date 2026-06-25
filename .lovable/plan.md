## Especialidade 050 — Contenções

Inserir a Especialidade 050 com toda a estrutura fornecida, seguindo o mesmo padrão usado para 030 e 040.

### Inserção (uma operação SQL)

1. **`biblioteca_especialidades`** — código `050`, nome `Contenções`, ordem 50.
2. **`biblioteca_subespecialidades`** — 10 subespecialidades (050.01 a 050.10): Cortinas de Contenção, Muros de Contenção, Pregagens e Ancoragens, Microestacas, Estabilização de Taludes, Betão Projetado, Drenagem de Contenções, Monitorização Geotécnica, Trabalhos Auxiliares, Contenções Temporárias. O trigger cria automaticamente a categoria "Por Classificar" em cada uma.
3. **`biblioteca_categorias`** — todas as categorias listadas (Cortinas de Estacas, Cortinas Moldadas, Muros em Betão Armado, Muros Especiais, Pregagens, Ancoragens, Microestacas Estruturais, Reforço de Fundações, Proteção Superficial, Reforço, Shotcrete, Drenagem, Alívio Hidrostático, Instrumentação, Monitorização, Perfuração, Injeções, Sistemas Temporários, Proteção de Escavações), com código `050.XX.YY`.
4. **`biblioteca_artigos`** — todos os artigos mestre listados (~85), unidade por defeito `vg` (a ajustar pelo utilizador), tipo `outros`, estado IA `pendente`.
5. **`biblioteca_especialidade_keywords`** — palavras-chave positivas (24) e negativas (12).

### Sem alterações de UI

A nova especialidade aparece automaticamente no Explorador da Biblioteca Mestra. Nenhum ficheiro de frontend é tocado.
