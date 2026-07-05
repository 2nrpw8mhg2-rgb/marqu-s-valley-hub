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

// Módulo Biblioteca Mestra (Knowledge Engine)
import bmListar from "./tools/biblioteca/listar-biblioteca-completa";
import bmObter from "./tools/biblioteca/obter-artigo-mestre";
import bmCriar from "./tools/biblioteca/criar-artigo-mestre";
import bmEditar from "./tools/biblioteca/editar-artigo-mestre";
import bmEnriquecer from "./tools/biblioteca/enriquecer-artigo-com-ia";
import bmEnriquecerSubesp from "./tools/biblioteca/enriquecer-subespecialidade-com-ia";
import bmAddConhecimento from "./tools/biblioteca/adicionar-conhecimento";
import bmCriarRelacao from "./tools/biblioteca/criar-relacao";
import bmAuditar from "./tools/biblioteca/auditar-biblioteca";
import bmDuplicados from "./tools/biblioteca/detetar-duplicados";
import bmLacunas from "./tools/biblioteca/detetar-lacunas";
import bmSugerirRecl from "./tools/biblioteca/sugerir-reclassificacao";
import bmAprovar from "./tools/biblioteca/aprovar-sugestao";
import bmListSug from "./tools/biblioteca/listar-sugestoes";
import bmDashboard from "./tools/biblioteca/dashboard-qualidade";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mv-os-mcp",
  title: "MV OS MCP",
  version: "0.4.0",
  instructions:
    "Servidor MCP do MV OS (Marquês Valley). Módulos: (1) Obras/Orçamentos/Subempreitadas — leitura e classificação. (2) Biblioteca Mestra — cérebro técnico do sistema: leitura completa, criação, edição, enriquecimento por IA, deteção de duplicados/lacunas, sugestões de reclassificação e aprendizagem contínua. Todos os textos em Português de Portugal. O utilizador tem de estar autenticado; o RLS aplica-se como esse utilizador.",
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
    // Biblioteca Mestra
    bmListar,
    bmObter,
    bmCriar,
    bmEditar,
    bmEnriquecer,
    bmAddConhecimento,
    bmCriarRelacao,
    bmAuditar,
    bmDuplicados,
    bmLacunas,
    bmSugerirRecl,
    bmAprovar,
    bmListSug,
    bmDashboard,
  ],
});
