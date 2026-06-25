# Expansão das Especialidades da Biblioteca Mestra

## Objetivo
Substituir a lista atual (6 especialidades base) por uma estrutura completa de macro-especialidades, organizada por fases de obra, alinhada com a realidade de empresas de construção em Portugal.

## Estrutura proposta (10 macro-especialidades, nível 1)

Organização por fases lógicas de obra. Cada macro-especialidade recebe um código sequencial em múltiplos de 10 (para deixar espaço a inserções futuras sem renumerar) e uma `ordem` correspondente.

| Código | Especialidade | Âmbito |
|---|---|---|
| 010 | Preparação da Obra | Estaleiro, Implantação, Trabalhos Preparatórios |
| 020 | Demolições e Gestão de Resíduos | Demolições, Remoções, Gestão e transporte de RCD |
| 030 | Movimento de Terras e Contenções | Terraplanagens, Escavações, Aterros, Contenções periféricas |
| 040 | Drenagens e Redes Enterradas | Drenagens pluviais/residuais, Redes enterradas de infraestruturas |
| 050 | Estruturas | Fundações, Cofragens, Armaduras, Betão, Estruturas metálicas, Pré-fabricados |
| 060 | Construção Civil e Envolvente | Alvenarias, Rebocos, Fachadas, ETICS, Impermeabilizações, Cobertura, Cantarias, Isolamentos |
| 070 | Acabamentos Interiores | Tetos falsos, Pladur, Revestimentos, Pavimentos, Pinturas, Carpintarias, Caixilharias, Serralharias, Espelhos |
| 080 | Especialidades Técnicas (MEP) | Eletricidade, ITED, SCIE, AVAC, Ventilação, Águas e Esgotos, Gás, Domótica, CCTV, Controlo de Acessos, Fotovoltaico, Bomba de Calor, Elevadores, Automação |
| 090 | Equipamentos | Eletrodomésticos, Equipamentos sanitários, Lavandarias, Equipamentos industriais |
| 100 | Arranjos Exteriores | Pavimentos exteriores, Muros, Jardins, Rega, Piscinas, Portões, Vedação, Iluminação exterior |
| 110 | Finalização e Entrega | Limpeza final, Ensaios, Comissionamento, Telas finais, Certificações |

(Total: 11 macro-especialidades.)

Nota: os blocos que listaste (ex.: Estaleiro, Implantação, ETICS, AVAC, ITED, Piscinas, Jardins, etc.) serão tratados como **subespecialidades** dentro das macro-especialidades acima — fica preparado para a Fase 2 (Subespecialidades), sem necessidade de mexer no código.

## Alterações técnicas

1. **Migração SQL** sobre `public.biblioteca_especialidades`:
   - Remover as 6 especialidades seed atuais que não tenham subespecialidades/artigos associados (verificar com `NOT EXISTS` em `biblioteca_subespecialidades`); manter as que tiverem dependências e renomear/recodificar via `UPDATE` quando aplicável.
   - `INSERT` das 11 macro-especialidades acima (`codigo`, `nome`, `descricao`, `ordem`, `ativo = true`).
   - Operação idempotente (`ON CONFLICT (codigo) DO UPDATE`).

2. **Sem alterações de schema** — as colunas existentes (`codigo`, `nome`, `descricao`, `ordem`, `ativo`) já cobrem tudo.

3. **Sem alterações de UI** — a página `biblioteca-mestra/especialidades.tsx` já lista, ordena e edita especialidades; passará a mostrar a nova lista automaticamente.

## Fora do âmbito (próximas fases)
- Subespecialidades (Fase 2) — entrarão os itens detalhados de cada bloco (Estaleiro, ETICS, AVAC, etc.).
- Artigos e palavras-chave (Fase 3).
