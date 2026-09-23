import { derivarCapitulos, type ArtigoMapa } from "./pastas";

export const SEM_CAPITULO = "__sem_capitulo__";
export const SEM_SUBCAPITULO = "__sem_subcapitulo__";

export type MapaOrdenacao = "original" | "codigo" | "unidade" | "quantidade";
export type MapaDirecao = "asc" | "desc";
export type MapaPageSize = 25 | 50 | 100;

export type MapaSearch = {
  q: string;
  capitulo: string;
  subcapitulo: string;
  ordenar: MapaOrdenacao;
  direcao: MapaDirecao;
  pagina: number;
  tamanho: MapaPageSize;
  artigo?: string;
};

export const MAPA_SEARCH_DEFAULTS: MapaSearch = {
  q: "",
  capitulo: "",
  subcapitulo: "",
  ordenar: "original",
  direcao: "asc",
  pagina: 1,
  tamanho: 25,
};

export function validarMapaSearch(input: Record<string, unknown>): MapaSearch {
  const ordenar: MapaOrdenacao = ["codigo", "unidade", "quantidade"].includes(String(input.ordenar))
    ? (input.ordenar as MapaOrdenacao)
    : "original";
  const tamanhoNumero = Number(input.tamanho);
  const tamanho: MapaPageSize = tamanhoNumero === 50 || tamanhoNumero === 100 ? tamanhoNumero : 25;
  return {
    q: typeof input.q === "string" ? input.q.slice(0, 200) : "",
    capitulo: typeof input.capitulo === "string" ? input.capitulo : "",
    subcapitulo: typeof input.subcapitulo === "string" ? input.subcapitulo : "",
    ordenar,
    direcao: input.direcao === "desc" ? "desc" : "asc",
    pagina: Math.max(1, Math.floor(Number(input.pagina) || 1)),
    tamanho,
    artigo: typeof input.artigo === "string" && input.artigo ? input.artigo : undefined,
  };
}

export type HierarquiaArtigo = {
  capituloId: string;
  capitulo: string;
  subcapituloId: string;
  subcapitulo: string;
};

export function hierarquiaArtigo(artigo: ArtigoMapa): HierarquiaArtigo {
  const codigo = (artigo.capitulo_codigo ?? "").trim();
  const descricao = (artigo.capitulo_descricao ?? "").trim();
  if (!codigo && !descricao) {
    return {
      capituloId: SEM_CAPITULO,
      capitulo: "Sem capítulo",
      subcapituloId: SEM_SUBCAPITULO,
      subcapitulo: "Sem subcapítulo",
    };
  }
  const derivado = derivarCapitulos(artigo);
  const partes = codigo.split(".").filter(Boolean);
  if (partes.length > 1) {
    return {
      capituloId: partes[0],
      capitulo: partes[0],
      subcapituloId: codigo,
      subcapitulo: derivado.subcapitulo || codigo,
    };
  }
  const capitulo = derivado.capitulo || descricao || codigo;
  return {
    capituloId: codigo || descricao,
    capitulo,
    subcapituloId: SEM_SUBCAPITULO,
    subcapitulo: "Sem subcapítulo",
  };
}

function normalizar(valor: string | null | undefined) {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-PT")
    .trim();
}

function compararTexto(a: string | null, b: string | null) {
  return (a ?? "").localeCompare(b ?? "", "pt", { numeric: true, sensitivity: "base" });
}

export function filtrarOrdenarArtigos(artigos: ArtigoMapa[], estado: MapaSearch): ArtigoMapa[] {
  const termo = normalizar(estado.q);
  const filtrados = artigos.filter((artigo) => {
    const h = hierarquiaArtigo(artigo);
    if (estado.capitulo && h.capituloId !== estado.capitulo) return false;
    if (estado.subcapitulo && h.subcapituloId !== estado.subcapitulo) return false;
    if (!termo) return true;
    return normalizar(`${artigo.codigo ?? ""} ${artigo.descricao}`).includes(termo);
  });

  const direcao = estado.direcao === "desc" ? -1 : 1;
  return [...filtrados].sort((a, b) => {
    const ha = hierarquiaArtigo(a);
    const hb = hierarquiaArtigo(b);
    const grupo = compararTexto(ha.capituloId, hb.capituloId) || compararTexto(ha.subcapituloId, hb.subcapituloId);
    if (grupo) return a.ordem - b.ordem;
    if (estado.ordenar === "codigo") return compararTexto(a.codigo, b.codigo) * direcao || a.ordem - b.ordem;
    if (estado.ordenar === "unidade") return compararTexto(a.unidade, b.unidade) * direcao || a.ordem - b.ordem;
    if (estado.ordenar === "quantidade") return (a.quantidade - b.quantidade) * direcao || a.ordem - b.ordem;
    return (a.ordem - b.ordem) * direcao;
  });
}

export type GrupoSubcapitulo = {
  id: string;
  nome: string;
  artigos: ArtigoMapa[];
  resumoQuantidade: string | null;
};

export type GrupoCapitulo = {
  id: string;
  nome: string;
  artigos: number;
  resumoQuantidade: string | null;
  subcapitulos: GrupoSubcapitulo[];
};

export function resumoQuantidade(artigos: ArtigoMapa[]): string | null {
  if (!artigos.length) return null;
  const unidades = new Set(artigos.map((a) => normalizar(a.unidade)).filter(Boolean));
  if (unidades.size !== 1) return null;
  const unidade = artigos.find((a) => a.unidade?.trim())?.unidade?.trim();
  if (!unidade) return null;
  const total = artigos.reduce((soma, artigo) => soma + artigo.quantidade, 0);
  return `${formatarQuantidade(total)} ${unidade}`;
}

export function agruparArtigos(artigos: ArtigoMapa[]): GrupoCapitulo[] {
  const capitulos = new Map<string, { nome: string; artigos: ArtigoMapa[]; subs: Map<string, { nome: string; artigos: ArtigoMapa[] }> }>();
  for (const artigo of artigos) {
    const h = hierarquiaArtigo(artigo);
    const cap = capitulos.get(h.capituloId) ?? { nome: h.capitulo, artigos: [], subs: new Map() };
    cap.artigos.push(artigo);
    const sub = cap.subs.get(h.subcapituloId) ?? { nome: h.subcapitulo, artigos: [] };
    sub.artigos.push(artigo);
    cap.subs.set(h.subcapituloId, sub);
    capitulos.set(h.capituloId, cap);
  }
  return [...capitulos.entries()].map(([id, cap]) => ({
    id,
    nome: cap.nome,
    artigos: cap.artigos.length,
    resumoQuantidade: resumoQuantidade(cap.artigos),
    subcapitulos: [...cap.subs.entries()].map(([subId, sub]) => ({
      id: `${id}::${subId}`,
      nome: sub.nome,
      artigos: sub.artigos,
      resumoQuantidade: resumoQuantidade(sub.artigos),
    })),
  }));
}

export function opcoesHierarquia(artigos: ArtigoMapa[], capitulo = "") {
  const capitulos = new Map<string, string>();
  const subcapitulos = new Map<string, string>();
  for (const artigo of artigos) {
    const h = hierarquiaArtigo(artigo);
    capitulos.set(h.capituloId, h.capitulo);
    if (!capitulo || h.capituloId === capitulo) subcapitulos.set(h.subcapituloId, h.subcapitulo);
  }
  return {
    capitulos: [...capitulos].map(([id, nome]) => ({ id, nome })),
    subcapitulos: [...subcapitulos].map(([id, nome]) => ({ id, nome })),
  };
}

export function paginarArtigos(artigos: ArtigoMapa[], pagina: number, tamanho: MapaPageSize) {
  const totalPaginas = Math.max(1, Math.ceil(artigos.length / tamanho));
  const paginaSegura = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (paginaSegura - 1) * tamanho;
  return { artigos: artigos.slice(inicio, inicio + tamanho), pagina: paginaSegura, totalPaginas };
}

export function ajustarSelecaoVisivel(selecionados: Set<string>, visiveis: ArtigoMapa[]) {
  const ids = new Set(visiveis.map((a) => a.artigo_id));
  return new Set([...selecionados].filter((id) => ids.has(id)));
}

export function formatarQuantidade(valor: number) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 6 }).format(valor);
}