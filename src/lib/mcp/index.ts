import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarObras from "./tools/listar-obras";
import obterObra from "./tools/obter-obra";
import listarOrcamentos from "./tools/listar-orcamentos";
import obterOrcamento from "./tools/obter-orcamento";
import pesquisarBiblioteca from "./tools/pesquisar-biblioteca";
import listarSubempreiteiros from "./tools/listar-subempreiteiros";
import listarSubempreitadas from "./tools/listar-subempreitadas";
import resumoSubempreitadasOrcamento from "./tools/resumo-subempreitadas-orcamento";
import artigosPorSubempreitada from "./tools/artigos-por-subempreitada";
import validarSubempreitadaArtigo from "./tools/validar-subempreitada-artigo";
import separarOrcamentoPorSubempreitada from "./tools/separar-orcamento-por-subempreitada";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mv-os-mcp",
  title: "MV OS MCP",
  version: "0.3.0",
  instructions:
    "Servidor MCP do MV OS (Marquês Valley). Ferramentas de leitura e auditoria sobre obras, orçamentos, subempreitadas, biblioteca mestra e subempreiteiros. O utilizador tem de estar autenticado; o RLS aplica-se como esse utilizador.",
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
    listarSubempreitadas,
    resumoSubempreitadasOrcamento,
    artigosPorSubempreitada,
    validarSubempreitadaArtigo,
    separarOrcamentoPorSubempreitada,
  ],
});
