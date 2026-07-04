import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "echo",
  title: "Echo",
  description: "Devolve o texto recebido. Útil para verificar a ligação ao MCP do MV OS.",
  inputSchema: {
    text: z.string().min(1).describe("Texto a devolver tal como recebido."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ text }) => ({ content: [{ type: "text", text }] }),
});
