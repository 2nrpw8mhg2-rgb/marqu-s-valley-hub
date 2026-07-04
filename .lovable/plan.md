Este plano é um **guia de instalação**, não uma alteração de código. Vais fazer os passos no ChatGPT; eu apoio-te em direto.

## Pré-requisito (fazes tu)
Carregar em **Publish** no canto superior direito do editor e esperar até ficar "Published" a verde. Depois avisa-me — eu confirmo o URL exato do teu `/mcp`.

## Passo 1 — Verificar plano do ChatGPT
1. Abre https://chatgpt.com e faz login.
2. Canto inferior esquerdo → clica no teu nome → **My plan**.
3. Deves ver **Plus**, **Pro**, **Business** ou **Enterprise**. Se disser "Free", tens de fazer upgrade para continuar.

## Passo 2 — Ativar Developer Mode
1. **Settings** (⚙️ canto superior direito) → **Connectors**.
2. Separador **Advanced** (em cima) → ativa **Developer mode**.
3. Aceita a caixa de aviso que aparece.

## Passo 3 — Criar o connector MV OS
1. Volta a **Settings → Connectors → Connectors**.
2. Canto superior direito → botão **Create** (ou "New connector").
3. Preenche:
   - **Name:** `MV OS`
   - **Description:** `Plataforma interna Marquês Valley` (opcional)
   - **MCP Server URL:** `https://<URL-que-te-vou-dar>/mcp`
   - **Authentication:** escolhe **No authentication**
4. Marca a caixa **"I trust this application"**.
5. Clica **Create**.
6. Deves ver **2 tools disponíveis**: `echo` e `server_info`.

## Passo 4 — Usar numa conversa
1. Abre uma **conversa nova** no ChatGPT.
2. Em baixo, ao lado do campo de escrita, clica no ícone **+** (mais) → **Developer mode / Connectors**.
3. Ativa o toggle do **MV OS**.
4. Escreve: `Chama a ferramenta echo do MV OS com o texto "olá do ChatGPT".`
5. O ChatGPT vai pedir autorização (uma vez) → aprova → deves receber "olá do ChatGPT" de volta.
6. Testa também: `Usa server_info do MV OS.` → deve devolver nome, versão e hora.

## Se algo correr mal
Diz-me exatamente o que vês (mensagem de erro, ecrã em branco, opção que não aparece) e eu ajusto. Pontos habituais:
- **"Create" não aparece** → Developer mode não está ativo, ou plano não permite.
- **Erro 404 no URL** → publicação ainda não terminou, esperar 1 minuto.
- **Connector cria mas não mostra tools** → dizer-me para eu verificar o `/mcp`.

## Próximo passo (depois disto correr)
Ativar OAuth para o ChatGPT agir como tu e expor ferramentas úteis (listar obras, orçamentos, etc.). Nessa altura crio um plano separado.
