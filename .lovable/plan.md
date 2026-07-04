# Servidor MCP com OAuth Supabase

Já existe o esqueleto MCP montado (`src/lib/mcp/`, `mcpPlugin()` no `vite.config.ts`, rota `/mcp`). Falta ligar a autenticação OAuth do Supabase e trocar as ferramentas demo por ferramentas úteis para o ChatGPT.

## O que vai ser feito

1. **Ativar o servidor OAuth do Supabase**
   Chamar `supabase--configure_oauth_server` (sem parâmetros). Isto ativa o OAuth 2.1 e o registo dinâmico de clientes para o ChatGPT/Claude se registarem sozinhos.

2. **Criar a página de consentimento**
   Novo ficheiro `src/routes/[.]lovable.oauth.consent.tsx`. É para onde o Supabase manda o utilizador aprovar a ligação do ChatGPT. Mostra "Ligar ChatGPT a MV OS" com botões Aprovar / Recusar. Se o utilizador não estiver autenticado, redireciona para `/auth` e volta ao consentimento depois de entrar.

3. **Atualizar `src/routes/auth.tsx`** para preservar o parâmetro `next` (URL da página de consentimento) em:
   - login com email/password
   - registo (via `emailRedirectTo`)
   - (se existir botão Google, também no `redirect_uri`)

4. **Ativar OAuth no `defineMcp`**
   Em `src/lib/mcp/index.ts`, acrescentar `auth: auth.oauth.issuer({ issuer: https://<project-ref>.supabase.co/auth/v1, acceptedAudiences: "authenticated" })` usando `import.meta.env.VITE_SUPABASE_PROJECT_ID`.

5. **Substituir as ferramentas demo por ferramentas reais**
   Remover `echo` e `server_info` e criar em `src/lib/mcp/tools/`:

   - `listar_obras` — lista as obras do utilizador (nome, estado, cliente)
   - `obter_obra` — detalhes de uma obra por id
   - `listar_orcamentos` — orçamentos (opcionalmente filtrados por obra)
   - `obter_orcamento` — capítulos e artigos de um orçamento
   - `pesquisar_biblioteca` — pesquisa por texto na biblioteca mestra (especialidade, categoria, artigo)
   - `listar_subempreiteiros` — nome, especialidade, rating

   Todas as ferramentas:
   - Recebem o token OAuth do `ToolContext` e criam um cliente Supabase por utilizador (`Authorization: Bearer <token>`), para o RLS ser aplicado como esse utilizador.
   - Marcadas como `readOnlyHint: true` (só leitura nesta primeira fase).
   - Nunca retornam o token nem escrevem nos dados.

6. **Regenerar o manifesto** com `app_mcp_server--extract_mcp_manifest` para o painel de "Agent integrations" mostrar as novas ferramentas.

## Impacto no RLS

Nesta app **só administradores** podem ler as tabelas de negócio (correção de segurança recente). Portanto: só o utilizador com role `admin` consegue realmente listar obras/orçamentos pelo ChatGPT. Isto é o comportamento correto face às políticas atuais.

Se quiseres que utilizadores normais também possam consultar via ChatGPT, tenho de acrescentar depois um role intermédio (ex.: `member`) e ajustar as políticas — mas isso é um passo separado.

## Como usar depois (do teu lado)

1. Aprovas este plano → eu implemento tudo.
2. Publicas de novo a app (para aplicar as novas rotas MCP + consentimento).
3. No ChatGPT (Pro): Settings → Connectors → **Add custom connector** → cola `https://<teu-dominio>.lovable.app/mcp`.
4. O ChatGPT abre o Supabase para autenticar → aterras na página de consentimento da app → aprovas.
5. A partir daí: "lista as minhas obras", "mostra o orçamento X", etc.

## Confirmações antes de implementar

- Confirmas o conjunto inicial de 6 ferramentas listadas em cima? Se quiseres começar mais estreito (só obras + orçamentos), diz.
- Só leitura nesta primeira versão — depois acrescentamos escrita se fizer sentido. Ok?
