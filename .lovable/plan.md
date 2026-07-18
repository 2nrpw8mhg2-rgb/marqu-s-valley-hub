## Aplicar migração `20260718213000_gerar_pacotes_por_subempreitada.sql`

Executar o SQL do ficheiro tal como está, sem alterações de código nem nova migração.

### O que a migração faz

- **Tabela `procurement_pacotes`**: adiciona os campos `subempreitada_id` (ligação à subempreitada) e `origem` (`manual` ou `classificacao_subempreitada`), com um índice por subempreitada e um índice único que garante apenas um pacote automático por orçamento + subempreitada.
- **Função `gerar_pacotes_por_subempreitada(orcamento_id)`**: gera/atualiza pacotes de consulta ao mercado a partir da classificação por subempreitada do orçamento.
  - Bloqueia se existirem artigos sem subempreitada ativa.
  - Bloqueia se existirem pacotes automáticos já em fase seguinte (obriga a criar nova versão).
  - Para cada subempreitada com artigos, cria ou atualiza o pacote e reescreve a lista de artigos do pacote a partir dos artigos do orçamento.
- **Permissões**: função executável por utilizadores autenticados (`SECURITY INVOKER` — respeita as políticas RLS do utilizador).

### Passos

1. Chamar `supabase--migration` com o conteúdo integral do ficheiro.
2. Aguardar aprovação e execução.
3. Confirmar sucesso ao utilizador.
