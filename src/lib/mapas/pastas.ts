/**
 * Lógica pura da secção «Mapas por Subempreitada».
 *
 * As pastas são sempre derivadas em tempo real das classificações atuais do
 * Mapa de Quantidades: nunca são criadas pastas vazias a partir da Biblioteca
 * Mestra, nem se copiam dados para estruturas que possam ficar desatualizadas.
 */

export type ArtigoMapa = {
  artigo_id: string;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  ordem: number;
  capitulo_codigo: string | null;
  capitulo_descricao: string | null;
  observacoes: string | null;
  referencia_documental?: string | null;
  subempreitada_id: string | null;
  classificado: boolean;
  necessita_revisao: boolean;
  validado_manual: boolean;
  sugestao_nova_subempreitada: string | null;
  confianca: number;
  atualizado_em?: string | null;
};

export type SubempreitadaRef = { id: string; codigo: string; nome: string };

export type PastaMapa = {
  subempreitada_id: string;
  codigo: string;
  nome: string;
  /** Nome apresentado na grelha e usado nos ficheiros exportados. */
  etiqueta: string;
  artigos: ArtigoMapa[];
  total: number;
  /** Validada quando todos os artigos da pasta estão confirmados por uma pessoa. */
  validada: boolean;
  atualizado_em: string | null;
};

/** Capítulo/Subcapítulo a partir do código hierárquico do capítulo («1.2» → «1» / «1.2»). */
export function derivarCapitulos(a: ArtigoMapa): { capitulo: string; subcapitulo: string } {
  const codigo = (a.capitulo_codigo ?? "").trim();
  const descricao = (a.capitulo_descricao ?? "").trim();
  if (!codigo && !descricao) return { capitulo: "", subcapitulo: "" };
  const partes = codigo.split(".").filter(Boolean);
  if (partes.length > 1) {
    return { capitulo: partes[0], subcapitulo: `${codigo} ${descricao}`.trim() };
  }
  return { capitulo: `${codigo} ${descricao}`.trim(), subcapitulo: "" };
}

function maisRecente(valores: Array<string | null | undefined>): string | null {
  const validos = valores.filter((v): v is string => Boolean(v)).sort();
  return validos.length ? validos[validos.length - 1] : null;
}

/**
 * Deriva as pastas a partir dos artigos atuais. Só existem pastas para
 * subempreitadas com pelo menos um artigo; a ordem dos artigos dentro de cada
 * pasta é a ordem original do Mapa de Quantidades.
 */
export function derivarPastas(artigos: ArtigoMapa[], subempreitadas: SubempreitadaRef[]): PastaMapa[] {
  const ref = new Map(subempreitadas.map((s) => [s.id, s]));
  const grupos = new Map<string, ArtigoMapa[]>();

  for (const a of [...artigos].sort((x, y) => x.ordem - y.ordem)) {
    if (!a.subempreitada_id) continue;
    if (!grupos.has(a.subempreitada_id)) grupos.set(a.subempreitada_id, []);
    grupos.get(a.subempreitada_id)!.push(a);
  }

  const pastas: PastaMapa[] = [];
  for (const [id, arts] of grupos) {
    const s = ref.get(id);
    const codigo = s?.codigo ?? id.slice(0, 8);
    const nome = s?.nome ?? "Subempreitada";
    pastas.push({
      subempreitada_id: id,
      codigo,
      nome,
      etiqueta: `${codigo} · ${nome}`,
      artigos: arts,
      total: arts.length,
      validada: arts.every((a) => a.validado_manual && !a.necessita_revisao),
      atualizado_em: maisRecente(arts.map((a) => a.atualizado_em)),
    });
  }

  return ordenarPastas(pastas, "az");
}

export type OrdemPastas = "az" | "za";

export function ordenarPastas(pastas: PastaMapa[], ordem: OrdemPastas): PastaMapa[] {
  const out = [...pastas].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "pt"));
  return ordem === "za" ? out.reverse() : out;
}

function normalizar(t: string) {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function filtrarPastas(pastas: PastaMapa[], pesquisa: string, ordem: OrdemPastas = "az"): PastaMapa[] {
  const termo = normalizar(pesquisa ?? "");
  const filtradas = termo ? pastas.filter((p) => normalizar(p.etiqueta).includes(termo)) : pastas;
  return ordenarPastas(filtradas, ordem);
}

export type Reconciliacao = {
  total_mq: number;
  em_pastas: number;
  sem_classificacao: number;
  duplicados: string[];
  ok: boolean;
};

/**
 * Invariante: cada artigo aparece exatamente numa pasta ou fica sem
 * classificação. Nunca há perdas nem duplicados.
 */
export function reconciliarPastas(artigos: ArtigoMapa[], pastas: PastaMapa[]): Reconciliacao {
  const contagem = new Map<string, number>();
  for (const p of pastas) {
    for (const a of p.artigos) contagem.set(a.artigo_id, (contagem.get(a.artigo_id) ?? 0) + 1);
  }
  const duplicados = [...contagem.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  const emPastas = contagem.size;
  const semClassificacao = artigos.filter((a) => !a.subempreitada_id).length;
  return {
    total_mq: artigos.length,
    em_pastas: emPastas,
    sem_classificacao: semClassificacao,
    duplicados,
    ok: duplicados.length === 0 && emPastas + semClassificacao === artigos.length,
  };
}

export type EstadoMapas = {
  provisorio: boolean;
  motivos: string[];
};

/** As exportações são PROVISÓRIAS enquanto houver pendentes, falhados ou artigos a rever. */
export function estadoMapas(input: { pendentes: number; falhados: number; a_rever: number }): EstadoMapas {
  const motivos: string[] = [];
  if (input.pendentes > 0) motivos.push(`${input.pendentes} artigos por classificar`);
  if (input.falhados > 0) motivos.push(`${input.falhados} artigos falhados`);
  if (input.a_rever > 0) motivos.push(`${input.a_rever} artigos a rever`);
  return { provisorio: motivos.length > 0, motivos };
}

/** Nome de ficheiro seguro: sem acentos, sem separadores de caminho, comprimento limitado. */
export function sanitizarNomeFicheiro(nome: string, max = 60): string {
  const limpo = (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _-]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.-]+|[_.-]+$/g, "");
  return (limpo || "mapa").slice(0, max);
}

export function nomeFicheiroMapa(obra: string, pasta: string, ext: "xlsx" | "pdf"): string {
  return `${sanitizarNomeFicheiro(obra, 40)}_${sanitizarNomeFicheiro(pasta, 40)}.${ext}`;
}

/**
 * Proteção contra injeção de fórmulas: texto iniciado por =, +, - ou @ é
 * exportado como texto seguro.
 */
export function protegerTextoExcel(valor: string | null | undefined): string {
  const v = valor ?? "";
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export function dataPT(d: Date = new Date()): string {
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}
