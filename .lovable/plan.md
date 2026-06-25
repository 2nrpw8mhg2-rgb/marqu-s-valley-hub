# Expansão da Subespecialidade 100.05 — Carpintarias Interiores

## Objetivo

Acrescentar à Biblioteca Mestra a estrutura detalhada fornecida para **100.05 — Carpintarias Interiores**, com 6 categorias e cerca de 120 artigos mestre, sem afetar as restantes subespecialidades de `100`.

## Estrutura a inserir

Subespecialidade alvo: **100.05 — Carpintarias Interiores** (já existente).

Categorias novas (códigos sequenciais a seguir aos já existentes da subespecialidade):

1. **100.05.XX — Portas** (30 artigos)
2. **100.05.XX — Roupeiros** (17 artigos)
3. **100.05.XX — Rodapés e Guarnições** (15 artigos)
4. **100.05.XX — Escadas** (11 artigos)
5. **100.05.XX — Mobiliário Fixo** (20 artigos)
6. **100.05.XX — Revestimentos em Madeira** (13 artigos)

Total: **6 categorias novas** + **~106 artigos mestre**.

## Abordagem técnica

Uma única operação de inserção idempotente (`DO $$ ... $$`) através da ferramenta de dados:

1. Localizar o `id` da subespecialidade `100.05`.
2. Calcular o próximo `ordem` e o próximo sufixo de `codigo` (`100.05.YY`) com base nas categorias já existentes (excluindo a "Por Classificar").
3. Para cada uma das 6 categorias:
   - `INSERT ... ON CONFLICT (subespecialidade_id, nome) DO NOTHING` em `biblioteca_categorias`.
   - Inserir os artigos correspondentes em `biblioteca_artigos` com:
     - `subespecialidade_id` = 100.05
     - `categoria_id` = nova categoria
     - `unidade_id` = `un` quando aplicável (portas, roupeiros, ferragens, escadas isoladas, mobiliário por unidade); `ml` para rodapés/guarnições/perfis/corrimãos; `m2` para revestimentos/painéis/lambrins/tetos em madeira; `vg` para kits e conjuntos.
     - `tipo='outros'`, `estado_ia='validado'`, `ativo=true`
     - `ON CONFLICT (subespecialidade_id, descricao) DO NOTHING` para idempotência.

Sem alterações de schema, sem alterações de frontend (aparecem automaticamente no Explorer da Biblioteca Mestra).

## Verificação

Após a inserção, query de contagem confirmando:
- 6 novas categorias em `100.05`
- ~106 novos artigos em `100.05`
- Distribuição por categoria conforme tabela acima

## Notas

- Mantém-se a categoria automática "Por Classificar" intacta.
- Caso já existam categorias com os mesmos nomes (ex.: "Portas"), o `ON CONFLICT` impede duplicação e os artigos são associados à existente.
- Unidades atribuídas por heurística por categoria; podem ser afinadas individualmente depois.
