// Classificador inteligente de pacotes de consulta.
// Análise contextual baseada em: descrição + capítulo + vizinhos + aprendizagem.
// Devolve scores por especialidade (multi-pacote) com justificação.

import { ESPECIALIDADES, type Especialidade, isBetaoArtigo } from "./especialidades";

export type ArtigoCtx = {
  id?: string;
  codigo?: string | null;
  descricao?: string | null;
  capituloCodigo?: string | null;
  capitulo?: string | null;
  subcapitulo?: string | null;
};

export type ArtigoComVizinhos = ArtigoCtx & {
  vizinhosAntes?: ArtigoCtx[];
  vizinhosDepois?: ArtigoCtx[];
  capituloEspecialidadeDominante?: Especialidade | null;
};

export type ScoreMap = Partial<Record<Especialidade, number>>;

export type ResultadoClassificacao = {
  especialidade: Especialidade;
  confianca: number; // 0..1
  motivo: string;
  scores: ScoreMap;
  alternativas: Array<{ especialidade: Especialidade; confianca: number }>;
};

export function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Palavras-chave fortes (peso 30) e fracas (peso 12) por especialidade.
// Exclusões duras (peso -100) eliminam o pacote da hipótese.
type Regras = {
  fortes: RegExp[];
  fracas: RegExp[];
  exclusoes?: RegExp[];
};

const REGRAS: Record<Especialidade, Regras> = {
  "Demolições": {
    fortes: [/\bdemoli/i, /\bpicag/i, /\barrombam/i, /\bdesmant/i, /\bdesmontag/i],
    fracas: [/\bremo[çc][ãa]o\s+(de\s+)?(parede|teto|pavimento|reboco|tela)/i, /\blevantamento\s+de\s+pavimento/i],
  },
  "Terraplanagens": {
    fortes: [/\bterraplan/i, /\bterraplen/i, /\bmovimento\s+de\s+terras/i, /\baterro/i, /\bdesaterro/i, /\bescava[çc]/i, /\benrocamento/i, /\btout[-\s]?venant/i, /\bdesmatag/i, /\bdecapag/i],
    fracas: [/\bvala\b/i, /\bcompacta[çc]/i, /\bdrenagem\s+(do\s+)?terreno/i],
    exclusoes: [/\bcobertura/i, /\btelhad/i],
  },
  "Estruturas": {
    fortes: [/\bbet[ãa]o\s+armado/i, /\bsapatas?\b/i, /\bvigas?\b/i, /\bpilares?\b/i, /\blajes?\b/i, /\bensoleiramento/i, /\bmicro\s*estacas?/i, /\bcofrag/i, /\barmaduras?/i, /\bmalha\s+electrossoldada/i, /\bmuros?\s+de\s+suporte/i, /\bfunda[çc][õo]es?/i],
    fracas: [/\bbet[ãa]o\b/i, /\bestrutura/i, /\ba[çc]o\s+a\s*\d/i],
  },
  "Alvenarias": {
    fortes: [/\balvenaria/i, /\btijolo/i, /\bbloco\s+(de\s+)?(bet[ãa]o|t[ée]rmico|cer[âa]mic)/i, /\breboco/i, /\bestuque/i, /\bgesso\s*cart/i, /\bpladur/i, /\bparede\s+divis/i],
    fracas: [/\bteto\s+falso/i, /\btecto\s+falso/i],
    exclusoes: [/\bcobertura/i],
  },
  "Cobertura": {
    fortes: [/\bcobertura/i, /\btelhad/i, /\btelhas?\b/i, /\bsubtelha/i, /\bcumeeira/i, /\bbeirado/i, /\bcaleira/i, /\brufos?\b/i, /\balgeroz/i, /\bclarab[oó]ia/i, /\bplatibanda/i, /\bfibrocimento/i, /\bonduline/i, /\bpainel\s+sandu/i, /\bbarreira\s+para-?vapor/i],
    fracas: [/\bremate\s+(de\s+)?cobertura/i, /\bchapa\s+sandu/i, /\btubo\s+de\s+queda\s+(da\s+)?cobertura/i],
    exclusoes: [
      /\bterraplan/i, /\baterro/i, /\bescava[çc]/i, /\bfunda[çc][õo]es?\s+(em|de)\s+bet/i,
      /\bsapatas?\b/i, /\bdemoli[çc][ãa]o\s+de\s+/i, /\bpavimento\s+t[ée]rreo/i,
      /\bmuro\s+(de\s+suporte|exterior)/i, /\bbase\s+de\s+pavimento/i,
    ],
  },
  "Caixilharias": {
    fortes: [/\bcaixilh/i, /\bjanelas?\b/i, /\bporta\s+(de\s+)?alum[íi]nio/i, /\bv[ãa]os?\s+exteriores?/i, /\bvidros?\s+(duplo|simples|laminad|temperad)/i, /\bestor/i, /\bpersian/i, /\bportad/i],
    fracas: [/\balum[íi]nio/i, /\bpvc\b/i],
  },
  "Eletricidade/ITED": {
    fortes: [/\beletricidade/i, /\belectricidade/i, /\binstala[çc][ãa]o\s+el[ée]ctric/i, /\bquadro\s+el[ée]ctr/i, /\bited\b/i, /\bcctv/i, /\bdom[óo]tica/i, /\bfotovoltaic/i, /\bcablagem/i],
    fracas: [/\btomadas?/i, /\binterruptor/i, /\bilumina[çc][ãa]o/i, /\blumin[áa]ria/i, /\bel[ée]tric/i],
  },
  "AVAC": {
    fortes: [/\bavac\b/i, /\bar\s*condicionado/i, /\bclimatiza[çc]/i, /\bventila[çc]/i, /\bvrv\b/i, /\bvrf\b/i, /\bchiller/i, /\bbomba\s+de\s+calor/i, /\bcondutas?\s+de\s+ar/i],
    fracas: [/\bextra[çc][ãa]o/i, /\bgrelhas?\s+de\s+ar/i, /\bpiso\s+radiante/i],
  },
  "Canalizações": {
    fortes: [/\bcanaliza[çc]/i, /\babastecimento\s+de\s+[áa]guas?/i, /\brede\s+de\s+esgotos?/i, /\b[áa]guas?\s+residuais?/i, /\bfossa\s+s[ée]ptica/i, /\bautoclism/i, /\bsanit[áa]rios?/i],
    fracas: [/\blavat[óo]rio/i, /\bbid[ée]/i, /\bchuveir/i, /\bbanheira/i, /\bsif[ãa]o/i, /\bppr\b/i, /\bpex\b/i, /\b[áa]gua\s+(fria|quente)/i],
    exclusoes: [/\btubo\s+de\s+queda\s+(da\s+)?cobertura/i],
  },
  "Carpintarias": {
    fortes: [/\bcarpintar/i, /\broupeir/i, /\barm[áa]rios?\s+de\s+(cozinha|casa)/i, /\bportas?\s+interiores?/i, /\bsob[ãa]do/i, /\bdeck\b/i, /\bpavimento\s+(em\s+)?madeira/i],
    fracas: [/\bmadeira/i, /\bmobili[áa]rio/i, /\bprateleir/i],
  },
  "Pinturas": {
    fortes: [/\bpinturas?\b/i, /\btintas?\b/i, /\bvernizes?/i, /\bdem[ãa]os?\s+de/i],
    fracas: [/\bprim[áa]rios?/i, /\bbarramentos?/i, /\bmassa\s+areada/i],
  },
  "Arranjos Exteriores": {
    fortes: [/\barranjos?\s+exteriores?/i, /\bpavimentos?\s+exteriores?/i, /\bcal[çc]ada/i, /\blancis?/i, /\bjardins?/i, /\brelvad/i, /\bpavimento\s+pedonal/i],
    fracas: [/\bmuros?\s+exteriores?/i],
    exclusoes: [/\bcobertura/i, /\btelhad/i],
  },
  "Betão": {
    // Betão é um agregador transversal — usa isBetaoArtigo dedicado.
    fortes: [],
    fracas: [],
  },
  "Outros": {
    fortes: [],
    fracas: [],
  },
};

// Hints por código de capítulo (estrutural, sobrepõe-se a palavras soltas).
function especialidadeDeCodigoCapitulo(codigo: string): Especialidade | null {
  const c = codigo.split(".")[0];
  switch (c) {
    case "3": return "Demolições";
    case "4": return "Terraplanagens";
    case "5": case "6": case "7": return "Estruturas";
    case "8": return "Alvenarias";
    case "12": return "Cobertura";
    case "13": return "Caixilharias";
    case "16": return "Eletricidade/ITED";
    case "17": return "AVAC";
    case "15": return "Canalizações";
    case "19": return "Pinturas";
    case "20": case "21": return "Arranjos Exteriores";
    default: return null;
  }
}

// Calcula a especialidade dominante de um conjunto de artigos do mesmo capítulo
// para usar como reforço contextual.
export function especialidadeDominante(artigos: ArtigoCtx[]): Especialidade | null {
  const contagens = new Map<Especialidade, number>();
  for (const a of artigos) {
    const r = pontuar(a, []);
    if (r.especialidade !== "Outros" && r.confianca >= 0.6) {
      contagens.set(r.especialidade, (contagens.get(r.especialidade) ?? 0) + 1);
    }
  }
  let top: Especialidade | null = null;
  let max = 0;
  for (const [esp, n] of contagens) {
    if (n > max) { max = n; top = esp; }
  }
  return top;
}

function aplicarRegras(hay: string, scores: Map<Especialidade, number>) {
  for (const esp of ESPECIALIDADES) {
    if (esp === "Betão" || esp === "Outros") continue;
    const r = REGRAS[esp];
    let s = 0;
    for (const rx of r.fortes) if (rx.test(hay)) s += 30;
    for (const rx of r.fracas) if (rx.test(hay)) s += 12;
    if (r.exclusoes) for (const rx of r.exclusoes) if (rx.test(hay)) s -= 100;
    if (s !== 0) scores.set(esp, (scores.get(esp) ?? 0) + s);
  }
}

function pontuar(a: ArtigoCtx, vizinhos: ArtigoCtx[]): ResultadoClassificacao {
  const desc = a.descricao ?? "";
  const chap = `${a.capitulo ?? ""} ${a.subcapitulo ?? ""}`;
  const hay = `${desc} ${chap}`;

  const scores = new Map<Especialidade, number>();

  // Camada 1: regras na descrição
  aplicarRegras(desc, scores);
  // Camada 2: regras no capítulo (pesa menos por já estar incluído via hay)
  const scoresCap = new Map<Especialidade, number>();
  aplicarRegras(chap, scoresCap);
  for (const [k, v] of scoresCap) {
    scores.set(k, (scores.get(k) ?? 0) + Math.round(v * 0.6));
  }

  // Camada 3: código do capítulo (estrutural, +40)
  const codCap = (a.capituloCodigo ?? a.codigo ?? "").trim();
  if (codCap) {
    const espCap = especialidadeDeCodigoCapitulo(codCap);
    if (espCap) scores.set(espCap, (scores.get(espCap) ?? 0) + 40);
  }

  // Camada 4: vizinhos imediatos consistentes (+15 cada, máx +30)
  let reforcoVizinhos = 0;
  const vizinhosEsp: Especialidade[] = [];
  for (const v of vizinhos) {
    const vHay = `${v.descricao ?? ""} ${v.capitulo ?? ""}`;
    const tmp = new Map<Especialidade, number>();
    aplicarRegras(vHay, tmp);
    const top = [...tmp.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 20) vizinhosEsp.push(top[0]);
  }
  const contagem = new Map<Especialidade, number>();
  for (const e of vizinhosEsp) contagem.set(e, (contagem.get(e) ?? 0) + 1);
  for (const [esp, n] of contagem) {
    if (n >= 2) {
      const bonus = Math.min(30, n * 15);
      scores.set(esp, (scores.get(esp) ?? 0) + bonus);
      reforcoVizinhos = Math.max(reforcoVizinhos, bonus);
    }
  }

  // Betão é um agregador paralelo — só decide o pacote se isBetaoArtigo passar.
  // Para a classificação primária, mantemos o caminho normal e devolvemos
  // "Betão" como alternativa quando aplicável.
  const ehBetao = isBetaoArtigo(a);

  if (scores.size === 0) {
    return {
      especialidade: ehBetao ? "Betão" : "Outros",
      confianca: ehBetao ? 0.85 : 0.1,
      motivo: ehBetao ? "Reconhecido como trabalho de betão" : "Sem sinais reconhecidos",
      scores: ehBetao ? { "Betão": 80 } : {},
      alternativas: [],
    };
  }

  const ordenados = [...scores.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  if (ordenados.length === 0) {
    return {
      especialidade: "Outros",
      confianca: 0.15,
      motivo: "Exclusões anularam todos os pacotes",
      scores: Object.fromEntries(scores) as ScoreMap,
      alternativas: [],
    };
  }

  const [topEsp, topScore] = ordenados[0];
  const segundo = ordenados[1]?.[1] ?? 0;
  const margem = topScore - segundo;
  // Confiança: top score normalizado + bónus de margem.
  const confianca = Math.min(0.99, 0.4 + Math.min(0.45, topScore / 120) + Math.min(0.15, margem / 80));

  const scoresObj: ScoreMap = {};
  for (const [k, v] of ordenados) scoresObj[k] = v;
  if (ehBetao && !scoresObj["Betão"]) scoresObj["Betão"] = 75;

  const alternativas = ordenados.slice(1, 4).map(([e, v]) => ({
    especialidade: e,
    confianca: Math.min(0.99, 0.4 + v / 120),
  }));

  return {
    especialidade: topEsp,
    confianca,
    motivo: `Score ${topScore} · margem +${margem}${reforcoVizinhos ? ` · vizinhos +${reforcoVizinhos}` : ""}`,
    scores: scoresObj,
    alternativas,
  };
}

export function classificarComContexto(a: ArtigoComVizinhos): ResultadoClassificacao {
  const vizinhos = [...(a.vizinhosAntes ?? []), ...(a.vizinhosDepois ?? [])];
  const r = pontuar(a, vizinhos);

  // Reforço por especialidade dominante do capítulo (+25, sem ultrapassar exclusão)
  if (a.capituloEspecialidadeDominante && a.capituloEspecialidadeDominante !== r.especialidade) {
    const score = r.scores[a.capituloEspecialidadeDominante] ?? 0;
    if (score > 0 && score + 25 > (r.scores[r.especialidade] ?? 0)) {
      const novo = pontuar(a, vizinhos);
      const novoScores = { ...novo.scores, [a.capituloEspecialidadeDominante]: score + 25 };
      const ord = (Object.entries(novoScores) as Array<[Especialidade, number]>).sort((a, b) => b[1] - a[1]);
      const [esp, s] = ord[0];
      return {
        especialidade: esp,
        confianca: Math.min(0.99, novo.confianca + 0.05),
        motivo: `${novo.motivo} · capítulo dominante ${a.capituloEspecialidadeDominante}`,
        scores: novoScores,
        alternativas: ord.slice(1, 4).map(([e, v]) => ({ especialidade: e, confianca: Math.min(0.99, 0.4 + v / 120) })),
      };
    }
  }

  return r;
}

// Valida se um artigo pertence a um pacote de uma dada especialidade.
// Para o pacote "Betão", usa o matcher dedicado (isBetaoArtigo).
export function pertenceAoPacote(
  artigo: ArtigoComVizinhos,
  especialidadePacote: string,
): { pertence: boolean; confianca: number; motivo: string; sugestao: Especialidade | null } {
  if (especialidadePacote === "Betão") {
    const ok = isBetaoArtigo(artigo);
    return {
      pertence: ok,
      confianca: ok ? 0.9 : 0.1,
      motivo: ok ? "Trabalho de betão estrutural" : "Não corresponde a trabalho de betão",
      sugestao: ok ? null : classificarComContexto(artigo).especialidade,
    };
  }

  const r = classificarComContexto(artigo);
  if (r.especialidade === especialidadePacote && r.confianca >= 0.7) {
    return { pertence: true, confianca: r.confianca, motivo: r.motivo, sugestao: null };
  }
  // Aceita se o pacote da especialidade está pelo menos como alternativa forte (>= 70% da top)
  const scoreAlvo = r.scores[especialidadePacote as Especialidade] ?? 0;
  const scoreTop = r.scores[r.especialidade] ?? 0;
  if (scoreAlvo > 0 && scoreTop > 0 && scoreAlvo / scoreTop >= 0.75) {
    return { pertence: true, confianca: 0.7, motivo: `Sinais fortes mas ambíguo com ${r.especialidade}`, sugestao: r.especialidade };
  }
  return {
    pertence: false,
    confianca: r.confianca,
    motivo: `Melhor encaixe é ${r.especialidade}`,
    sugestao: r.especialidade,
  };
}
