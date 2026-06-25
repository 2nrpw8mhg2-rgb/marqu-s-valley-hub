
# Especialidade 020 — Instalações Provisórias

Mesma estrutura usada na 010: criar Subespecialidades, Categorias e Artigos Mestre da especialidade já existente `020 — Instalações Provisórias` e popular as palavras-chave em `biblioteca_especialidade_keywords`.

## Subespecialidades (10)

| Código | Nome |
|---|---|
| 020.01 | Estaleiro |
| 020.02 | Tapumes e Vedação |
| 020.03 | Contentores e Instalações de Apoio |
| 020.04 | Água Provisória |
| 020.05 | Eletricidade Provisória |
| 020.06 | Comunicações |
| 020.07 | Segurança do Estaleiro |
| 020.08 | Sinalização de Obra |
| 020.09 | Equipamentos Temporários |
| 020.10 | Desmobilização |

Cada subespecialidade gera automaticamente a categoria `Por Classificar` via trigger.

## Categorias manuais

Exatamente as listadas pelo utilizador (22 no total): Implantação do Estaleiro, Infraestruturas do Estaleiro, Tapumes, Portões, Escritórios, Apoio aos Trabalhadores, Armazéns, Rede Provisória, Equipamentos (em 020.04), Alimentação, Distribuição, Telecomunicações, Controlo, Segurança Física, Equipamentos (em 020.07), Sinalização, Informação, Equipamentos (em 020.09), Apoio, Encerramento.

## Artigos Mestre

Todos os listados pelo utilizador (≈90), criados como atualmente:
- `tipo = 'outros'` (default; utilizador refina depois)
- `unidade_id` = `vg` (default global, igual à 010)
- `estado_ia = 'validado'` (artigos criados manualmente)
- `ativo = true`
- Sem código (à imagem dos da 010); o utilizador pode preencher mais tarde.

## Palavras-chave da especialidade

Inserir em `biblioteca_especialidade_keywords` para `especialidade_id = 0642a69d-…` (já existe):
- 21 positivas, 14 negativas
- `peso = 1.00`, `origem = 'manual'`, `ativo = true`

## Execução

Tudo numa única operação `INSERT` (ferramenta de dados, não migração de schema), idêntica ao padrão usado na 010. Não há alterações de schema, código frontend nem types.

## Fora de âmbito

- Códigos numéricos por artigo
- Classificação fina de `tipo` por artigo
- Templates de obra, equivalências com 110 (MEP) ou 030 (Demolições)
