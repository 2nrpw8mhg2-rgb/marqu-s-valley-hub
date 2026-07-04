## Diagnóstico já confirmado

- O ficheiro principal `src/lib/mcp/index.ts` já regista as 5 tools novas.
- O manifesto local `.lovable/mcp/manifest.json` já está em `version: 0.3.0`, path `/mcp`, com 11 tools no total.
- As tools novas aparecem no manifesto local:
  - `listar_subempreitadas`
  - `obter_resumo_subempreitadas_orcamento`
  - `obter_artigos_por_subempreitada`
  - `separar_orcamento_por_subempreitada`
  - `validar_subempreitada_artigo`
- O plugin MCP está ativo em `vite.config.ts` com `mcpPlugin()`, portanto o endpoint gerado continua a ser `/mcp`.

## Hipótese principal

O ChatGPT continua ligado a uma versão publicada anterior, ou tem a lista de tools em cache. Localmente o MCP já expõe as tools, mas a produção precisa de receber a versão atual e o conector no ChatGPT precisa de reconectar/atualizar tools.

## Plano de ação

1. **Validar novamente o manifesto MCP**
   - Executar o extrator oficial do manifesto MCP.
   - Confirmar que o manifesto gerado continua com as 11 tools e sem erros.

2. **Publicar a versão atual**
   - Antes de publicar, verificar se existe algum bloqueio crítico de segurança.
   - Publicar a app para que o endpoint de produção `/mcp` passe a servir a versão `0.3.0`.

3. **Confirmar o endpoint correto para o ChatGPT**
   - Endpoint esperado: `https://marquis-opus-pro.lovable.app/mcp`.
   - URL estável alternativa de produção: `https://project--039d4604-74b9-4371-9e62-78d763dd48e6.lovable.app/mcp`.
   - Se o ChatGPT estiver ligado a outro domínio, preview URL, URL antiga ou endpoint diferente, tem de ser removido e adicionado novamente com o endpoint correto.

4. **Pós-publicação**
   - No ChatGPT, remover/reconectar o conector MCP ou usar “Refresh tools / Reconnect”.
   - Confirmar que o `list_tools` passa a mostrar as 5 tools novas.

## Resultado esperado

Após publicação e reconexão no ChatGPT, o MCP deve expor 11 tools, incluindo todas as tools de Subempreitadas, mantendo autenticação e permissões existentes.