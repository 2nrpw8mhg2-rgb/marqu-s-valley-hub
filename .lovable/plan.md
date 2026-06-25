## Reestruturação das Especialidades da Biblioteca Mestra

Aplicar 4 ajustes solicitados, mantendo numeração sequencial em múltiplos de 10. Resultado: **14 macro-especialidades**.

### Nova estrutura

| Código | Especialidade | Origem / Notas |
|---|---|---|
| 010 | Preparação da Obra | mantém |
| 020 | **Instalações Provisórias** | NOVA (Estaleiro, Tapumes, Contentores, Água/Eletricidade provisórias, Sinalização, Proteções Coletivas, IS provisórias) |
| 030 | Demolições e Gestão de Resíduos | renumerada (era 020) |
| 040 | **Movimento de Terras** | divisão de "Movimento de Terras e Contenções" |
| 050 | **Contenções** | divisão de "Movimento de Terras e Contenções" |
| 060 | **Infraestruturas** | NOVA — absorve "Drenagens e Redes Enterradas" (Águas, Esgotos, Pluviais, Drenagens, Caixas de Visita, ETAR, Reservatórios, Estações Elevatórias) |
| 070 | Estruturas | renumerada (era 050) |
| 080 | **Construção Civil** | divisão (Alvenarias, Rebocos, Betonilhas) |
| 090 | **Envolvente** | divisão (ETICS, Fachadas, Cobertura, Impermeabilizações, Cantarias, Isolamentos) |
| 100 | Acabamentos Interiores | renumerada (era 070) |
| 110 | Especialidades Técnicas (MEP) | renumerada (era 080) |
| 120 | Equipamentos | renumerada (era 090) |
| 130 | Arranjos Exteriores | renumerada (era 100) |
| 140 | Finalização e Entrega | renumerada (era 110) |

### Abordagem técnica

Uma migração SQL única em `public.biblioteca_especialidades`:

1. `DELETE` das 11 especialidades atuais que não tenham subespecialidades nem artigos associados (verificar `biblioteca_subespecialidades` e `biblioteca_artigos`). Como ainda não foram criadas subespecialidades/artigos, a tabela pode ser limpa em segurança.
2. `INSERT` das 14 novas especialidades com os códigos, nomes, descrições breves e `ordem` correspondente (10, 20, …, 140).
3. Sem alterações de schema — colunas existentes (`codigo`, `nome`, `descricao`, `ordem`, `ativo`) cobrem tudo.
4. Sem alterações de UI — a página `especialidades.tsx` lê dinamicamente a tabela.

### Fora de âmbito (próximas fases)

- Subespecialidades listadas (Alvenarias, ETICS, Escavações, Muros Berlim, Estaleiro, etc.) → Fase 2.
- Artigos e palavras-chave → Fase 3.
- Lógica de classificação automática e Pacotes de Consulta → módulos seguintes.
