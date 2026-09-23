/**
 * Lógica pura da primeira fase do módulo operacional «Procurement».
 *
 * Nada aqui escreve na base de dados: as funções derivam, filtram e comparam
 * dados já existentes (Mapas por Subempreitada, pacotes, documentos, empresas).
 * Enquanto não existir uma versão enviada, o pacote acompanha dinamicamente as
 * classificações atuais — não há cópias desatualizáveis.
 */
import type { ArtigoMapa, SubempreitadaRef } from "@/lib/mapas/pastas";

/** Estados com ações reais nesta fase. Os restantes chegam com o envio/propostas. */
export const ESTADOS_FASE1 = [
  "por_preparar",
  "em_preparacao",
  "pronto_envio",
  "cancelado",
] as const;
export type EstadoPacoteFase1 = (typeof ESTADOS_FASE1)[number];

/** Estados previstos para fases seguintes (ainda sem ações que os produzam). */
export const ESTADOS_FUTUROS = [
  "enviado",
  "em_analise",
  "adjudicado",
] as const;

export const ROTULO_ESTADO: Record<string, string> = {
  por_preparar: "Por preparar",
  em_preparacao: "Em preparação",
  pronto_envio: "Pronto para envio",
  enviado: "Em consulta",
  em_analise: "Em comparação",
  adjudicado: "Adjudicado",
  cancelado: "Cancelado",
};

export function rotuloEstado(estado: string): string {
  return ROTULO_ESTADO[estado] ?? estado;
}

/**
 * Um artigo só é elegível para consulta quando tem exatamente uma subempreitada
 * atribuída e não está pendente, falhado nem a rever.
 */
export function artigoElegivel(a: ArtigoMapa): boolean {
  return Boolean(a.classificado && a.subempreitada_id && !a.necessita_revisao);
}

export type PacoteEsperado = {
  subempreitada_id: string;
  codigo: string;
  nome: string;
  artigos: ArtigoMapa[];
  total: number;
};

/**
 * Pacotes que devem existir na obra: exatamente um por subempreitada com pelo
 * menos um artigo elegível. Nunca gera pacotes vazios.
 */
export function pacotesEsperados(
  artigos: ArtigoMapa[],
  subempreitadas: SubempreitadaRef[],
): PacoteEsperado[] {
  const ref = new Map(subempreitadas.map((s) => [s.id, s]));
  const grupos = new Map<string, ArtigoMapa[]>();
  for (const a of [...artigos].sort((x, y) => x.ordem - y.ordem)) {
    if (!artigoElegivel(a)) continue;
    const id = a.subempreitada_id as string;
    if (!grupos.has(id)) grupos.set(id, []);
    grupos.get(id)!.push(a);
  }
  return [...grupos.entries()]
    .map(([id, arts]) => ({
      subempreitada_id: id,
      codigo: ref.get(id)?.codigo ?? id.slice(0, 8),
      nome: ref.get(id)?.nome ?? "Subempreitada",
      artigos: arts,
      total: arts.length,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}

export type LinhaPacote = {
  id: string;
  nome: string;
  subempreitada_id: string | null;
  estado: string;
  origem: string;
  responsavel_id: string | null;
  artigos: number;
  mq_revisao: string;
  empresas: number;
  consultas_enviadas: number;
  respostas: number;
  atualizado_em: string | null;
  alertas: string[];
};

export type MetricasProcurement = {
  total: number;
  por_preparar: number;
  em_preparacao: number;
  consultas_enviadas: number;
  propostas_recebidas: number;
  em_comparacao: number;
  adjudicadas: number;
  alertas: number;
};

/** Métricas reais. Sem dados, tudo fica a zero — nunca há valores ilustrativos. */
export function metricasProcurement(linhas: LinhaPacote[]): MetricasProcurement {
  return {
    total: linhas.length,
    por_preparar: linhas.filter((l) => l.estado === "por_preparar").length,
    em_preparacao: linhas.filter((l) => l.estado === "em_preparacao" || l.estado === "pronto_envio").length,
    consultas_enviadas: linhas.reduce((n, l) => n + l.consultas_enviadas, 0),
    propostas_recebidas: linhas.reduce((n, l) => n + l.respostas, 0),
    em_comparacao: linhas.filter((l) => l.estado === "em_analise").length,
    adjudicadas: linhas.filter((l) => l.estado === "adjudicado").length,
    alertas: linhas.reduce((n, l) => n + l.alertas.length, 0),
  };
}

function normalizar(t: string) {
  return (t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type FiltrosPacotes = {
  q?: string;
  estado?: string;
  responsavel?: string;
  ordenar?: "nome" | "artigos" | "estado" | "atualizacao";
  direcao?: "asc" | "desc";
};

export function filtrarOrdenarPacotes(linhas: LinhaPacote[], f: FiltrosPacotes): LinhaPacote[] {
  const termo = normalizar(f.q ?? "");
  const out = linhas
    .filter((l) => (termo ? normalizar(l.nome).includes(termo) : true))
    .filter((l) => (f.estado && f.estado !== "todos" ? l.estado === f.estado : true))
    .filter((l) =>
      f.responsavel && f.responsavel !== "todos"
        ? (f.responsavel === "sem" ? !l.responsavel_id : l.responsavel_id === f.responsavel)
        : true,
    );
  const ordenar = f.ordenar ?? "nome";
  out.sort((a, b) => {
    if (ordenar === "artigos") return a.artigos - b.artigos;
    if (ordenar === "estado") return a.estado.localeCompare(b.estado);
    if (ordenar === "atualizacao") return (a.atualizado_em ?? "").localeCompare(b.atualizado_em ?? "");
    return a.nome.localeCompare(b.nome, "pt");
  });
  return f.direcao === "desc" ? out.reverse() : out;
}

/** Pendências visíveis no pacote (independentes do estado). */
export function alertasPacote(input: {
  artigos: number;
  empresas: number;
  documentos: number;
  ambito_preenchido: boolean;
  mq_alterado?: boolean;
}): string[] {
  const alertas: string[] = [];
  if (input.mq_alterado) alertas.push("MQ alterado");
  if (input.artigos === 0) alertas.push("Sem artigos elegíveis");
  if (input.empresas === 0) alertas.push("Sem empresas selecionadas");
  if (input.documentos === 0) alertas.push("Documentação em falta");
  if (!input.ambito_preenchido) alertas.push("Âmbito por definir");
  return alertas;
}

/** Estado derivado da preparação real do pacote (só transições suportadas). */
export function estadoSugerido(input: {
  estado: string;
  empresas: number;
  documentos: number;
  ambito_preenchido: boolean;
}): EstadoPacoteFase1 | null {
  if (input.estado !== "por_preparar" && input.estado !== "em_preparacao") return null;
  const pronto = input.empresas > 0 && input.documentos > 0 && input.ambito_preenchido;
  if (pronto) return "pronto_envio";
  const iniciado = input.empresas > 0 || input.documentos > 0 || input.ambito_preenchido;
  return iniciado ? "em_preparacao" : "por_preparar";
}

export type ArtigoVersao = { artigo_id: string; quantidade: number; descricao: string };

export type DiffVersao = {
  alterado: boolean;
  adicionados: string[];
  removidos: string[];
  quantidades_alteradas: Array<{ artigo_id: string; antes: number; depois: number }>;
  descricoes_alteradas: string[];
};

/**
 * Compara uma versão congelada (snapshot) com o estado atual do MQ. O snapshot
 * nunca é modificado: serve apenas para detetar que houve alterações.
 */
export function diffVersaoMQ(snapshot: ArtigoVersao[], atuais: ArtigoVersao[]): DiffVersao {
  const antes = new Map(snapshot.map((a) => [a.artigo_id, a]));
  const depois = new Map(atuais.map((a) => [a.artigo_id, a]));
  const adicionados = [...depois.keys()].filter((id) => !antes.has(id));
  const removidos = [...antes.keys()].filter((id) => !depois.has(id));
  const quantidades_alteradas: DiffVersao["quantidades_alteradas"] = [];
  const descricoes_alteradas: string[] = [];
  for (const [id, a] of antes) {
    const d = depois.get(id);
    if (!d) continue;
    if (d.quantidade !== a.quantidade) {
      quantidades_alteradas.push({ artigo_id: id, antes: a.quantidade, depois: d.quantidade });
    }
    if (d.descricao !== a.descricao) descricoes_alteradas.push(id);
  }
  return {
    alterado:
      adicionados.length > 0 ||
      removidos.length > 0 ||
      quantidades_alteradas.length > 0 ||
      descricoes_alteradas.length > 0,
    adicionados,
    removidos,
    quantidades_alteradas,
    descricoes_alteradas,
  };
}

export type Ambito = {
  ambito_geral: string;
  responsabilidades_mv: string;
  responsabilidades_subempreiteiro: string;
  inclusoes: string;
  exclusoes: string;
  alternativas: string;
  observacoes: string;
};

export const AMBITO_VAZIO: Ambito = {
  ambito_geral: "",
  responsabilidades_mv: "",
  responsabilidades_subempreiteiro: "",
  inclusoes: "",
  exclusoes: "",
  alternativas: "",
  observacoes: "",
};

export function ambitoPreenchido(a: Ambito | null | undefined): boolean {
  if (!a) return false;
  return Object.values(a).some((v) => (v ?? "").trim().length > 0);
}

/** Etiqueta de versão da consulta e da revisão do MQ («Consulta 01 / MQ Rev. 01»). */
export function etiquetaVersao(numeroConsulta: number, revisaoMQ: number): string {
  const p = (n: number) => String(Math.max(1, n)).padStart(2, "0");
  return `Consulta ${p(numeroConsulta)} / MQ Rev. ${p(revisaoMQ)}`;
}
