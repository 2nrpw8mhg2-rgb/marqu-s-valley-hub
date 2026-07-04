import { defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import serverInfoTool from "./tools/server-info";

export default defineMcp({
  name: "mv-os-mcp",
  title: "MV OS MCP",
  version: "0.1.0",
  instructions:
    "Servidor MCP do MV OS (Marquês Valley). Usa `echo` para verificar a ligação e `server_info` para obter metadados do servidor.",
  tools: [echoTool, serverInfoTool],
});
