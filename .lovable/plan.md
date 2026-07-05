# Corrigir publicação das ferramentas da Biblioteca Mestra

## Diagnóstico

- `src/lib/mcp/index.ts` (v0.4.0) já regista corretamente as 25 ferramentas (11 existentes + 14 novas da Biblioteca Mestra).
- `.lovable/mcp/manifest.json` está **vazio/inválido** (`name: null`, `tools: []`). O extractor falhou silenciosamente no último commit, portanto o catálogo público não anuncia as novas ferramentas.
- O endpoint `/mcp` em `https://marquis-opus-pro.lovable.app/mcp` é o correto — o problema é apenas manifesto desatualizado + servidor a servir build anterior.

## Passos

1. **Regenerar o manifesto** com `app_mcp_server--extract_mcp_manifest`. Se falhar, ler o erro exato e corrigir o `defineMcp`/tool afetado (imports em falta, top-level env reads, schemas Zod inválidos, etc.) até o extractor listar as 25 ferramentas.
2. **Verificar** o `.lovable/mcp/manifest.json` resultante: `version: 0.4.0`, `name: mv-os-mcp`, `tools.length === 25`, com as 14 novas presentes (`listar_biblioteca_completa`, `obter_artigo_mestre`, `criar_artigo_mestre`, `editar_artigo_mestre`, `enriquecer_artigo_com_ia`, `adicionar_conhecimento_artigo`, `criar_relacao_artigo`, `auditar_biblioteca`, `detetar_duplicados`, `detetar_lacunas`, `sugerir_reclassificacao`, `aprovar_sugestao`, `listar_sugestoes`, `dashboard_biblioteca_qualidade`).
3. **Republicar** com `preview_ui--publish` para o Worker servir a nova versão do endpoint `/mcp` (o servidor MCP é regenerado no deploy).
4. **No ChatGPT**: no conector MV OC, fazer **Refresh tools / Reconnect** (o cliente cacheia o manifesto — sem refresh continua a ver a lista antiga mesmo com o servidor atualizado).
5. **Validação end-to-end**: pedir ao ChatGPT `dashboard_biblioteca_qualidade` e `listar_biblioteca_completa` para confirmar que respondem.

## Notas técnicas

- O extractor avalia `src/lib/mcp/index.ts` num contexto sem env — se algum tool novo fizer `process.env.X!` no top-level ou lançar no import, o manifesto fica vazio (é o sintoma atual). A correção nesse caso é mover leituras de env para dentro do `handler`.
- Não editar `src/routes/mcp.ts` nem ficheiros auto-gerados; toda a lógica fica em `src/lib/mcp/`.
