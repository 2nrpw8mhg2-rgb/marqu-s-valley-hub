import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "server_info",
  title: "Informação do servidor",
  description: "Devolve informação básica sobre este servidor MCP do MV OS (nome, versão, hora UTC atual).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const info = {
      name: "mv-os-mcp",
      version: "0.1.0",
      now: new Date().toISOString(),
      description:
        "Servidor MCP do MV OS — Plataforma interna Marquês Valley. Ferramentas autenticadas serão adicionadas em breve.",
    };
    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      structuredContent: info,
    };
  },
});
