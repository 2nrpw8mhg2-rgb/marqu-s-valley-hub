import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarObras from "./tools/listar-obras";
import obterObra from "./tools/obter-obra";
import listarOrcamentos from "./tools/listar-orcamentos";
import obterOrcamento from "./tools/obter-orcamento";
import pesquisarBiblioteca from "./tools/pesquisar-biblioteca";
import listarSubempreiteiros from "./tools/listar-subempreiteiros";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mv-os-mcp",
  title: "MV OS MCP",
  version: "0.2.0",
  instructions:
    "Servidor MCP do MV OS (Marquês Valley). Ferramentas de leitura sobre obras, orçamentos, biblioteca mestra e subempreiteiros. O utilizador tem de estar autenticado; o RLS aplica-se como esse utilizador.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listarObras,
    obterObra,
    listarOrcamentos,
    obterOrcamento,
    pesquisarBiblioteca,
    listarSubempreiteiros,
  ],
});
