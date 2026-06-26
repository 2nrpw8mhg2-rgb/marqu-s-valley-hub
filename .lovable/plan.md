
## Plano: Carregar Especialidade 110 — MEP na Biblioteca Mestra

### Estado atual
A especialidade `110 — Especialidades Técnicas (MEP)` já existe, mas tem 14 subespecialidades antigas com códigos inconsistentes (dois `110.10`, sem categorias reais nem artigos). Apenas "Por Classificar" em cada uma.

### O que vai ser feito (1 migração SQL)

**1. Limpar estrutura atual da MEP**
- Apagar as 14 subespecialidades existentes da 110 (cascade elimina as categorias "Por Classificar" automáticas e os 0 artigos).
- Não toca em mais nada da biblioteca.

**2. Criar 14 subespecialidades novas** (códigos 110.01 → 110.14) conforme a tua spec:
```
110.01 Instalações Elétricas        110.08 Segurança Eletrónica
110.02 ITED e Telecomunicações      110.09 Energias Renováveis
110.03 SCIE                          110.10 Bombas de Calor / AQS
110.04 AVAC                          110.11 Elevadores e Transporte Vertical
110.05 Redes Hidráulicas Interiores  110.12 Sistemas Especiais
110.06 Gás                           110.13 Ensaios e Comissionamento
110.07 Domótica e Automação          110.14 Gestão Técnica Centralizada (BMS)
```
(O trigger `tg_subesp_por_classificar` cria automaticamente a categoria "Por Classificar" em cada uma.)

**3. Criar ~40 categorias reais** (todas as listadas na spec — ex. "Quadros Elétricos", "Cablagem", "Tubagens e Caminhos", "Aparelhagem", "Iluminação" para 110.01, etc.).

**4. Criar ~150 artigos mestre** com:
- `descricao` = nome do artigo da spec
- `tipo` por defeito:
  - `equipamento` — quadros, luminárias, bombas, inversores, elevadores, câmaras, centrais…
  - `material` — cabos, tubagens, eletrocalhas, painéis, baterias…
  - `sistema` — KNX, DALI, BMS, SCADA, gases medicinais…
  - `servico` — ensaios, comissionamento, formação, certificação…
- `unidade` por defeito:
  - `un` para equipamentos / aparelhagem / luminárias
  - `ml` para cabos, tubagens, eletrocalhas, condutas
  - `vg` para sistemas, ensaios, comissionamento
- `estado_ia = 'validado'` (entrada manual confirmada por ti)
- `ativo = true`

**5. Adicionar keywords positivas e negativas** na tabela `biblioteca_especialidade_keywords` para a 110, exatamente as da spec, para alimentar o `suggestCategoria` e futuros classificadores.

### O que NÃO faz
- Não mexe noutras especialidades (010 a 100, 120+).
- Não toca em código frontend — a página `/biblioteca-mestra/categorias` e `/artigos` já mostram tudo automaticamente.
- Não cria pacotes de procurement nem templates de obra (fica para passo seguinte se quiseres).

### Pontos a confirmar antes de avançar
1. **Unidades por defeito** — concordas com `un` / `ml` / `vg` conforme acima, ou queres rever caso a caso (são ~150 artigos)?
2. **A 110.50 "Ventilação" antiga** desaparece (a spec mete ventilação dentro do AVAC 110.04). Confirmas?
3. **Códigos dos artigos** — gero códigos sequenciais tipo `110.01.01.001`, ou deixo `codigo = NULL` (a app não exige)?

Assim que confirmares (ou disseres "avança com os defaults"), passo a build mode e executo a migração numa única transação.
