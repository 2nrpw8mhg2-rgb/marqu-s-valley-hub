// Catálogo canónico de especialidades e classificador automático
// com palavras-chave positivas e negativas por especialidade.

export const ESPECIALIDADES = [
  "Betão",
  "Demolições",
  "Terraplanagens",
  "Estruturas",
  "Alvenarias",
  "Cobertura",
  "Caixilharias",
  "Eletricidade/ITED",
  "AVAC",
  "Canalizações",
  "Carpintarias",
  "Pinturas",
  "Arranjos Exteriores",
  "Outros",
] as const;

export type Especialidade = (typeof ESPECIALIDADES)[number];

type Rule = {
  esp: Especialidade;
  positive: RegExp[];
  negative?: RegExp[];
};

// Palavras-chave por especialidade. Cada match positivo soma 1 ponto,
// cada match negativo subtrai 2 pontos (negativos fortes "vetam" a especialidade).
const RULES: Rule[] = [
  {
    esp: "Demolições",
    positive: [/\bdemoli/i, /\bpicag/i, /\barrombam/i, /\bdesmant/i, /\bremo[çc][ãa]o\s+(de\s+)?(parede|teto|pavimento|reboco)/i],
  },
  {
    esp: "Terraplanagens",
    positive: [
      /\bterraplan/i, /\bescava[çc]/i, /\baterro/i, /\bdesaterro/i, /\bcompacta[çc]/i,
      /\bmovimento\s+de\s+terras/i, /\bdesmatag/i, /\bdecapag/i, /\bvala\b/i,
      /\bdrenagem\s+(do\s+)?terreno/i, /\brede\s+enterrada/i,
    ],
  },
  {
    esp: "Estruturas",
    positive: [
      /\bbet[ãa]o\b/i, /\barmadura/i, /\ba[çc]o\s+(em|para|de)\s+(viga|pilar|laje|arma)/i,
      /\bpilar\b/i, /\bviga\b/i, /\blaje\b/i, /\bfunda[çc]/i, /\bsapata/i,
      /\bmicro\s*estaca/i, /\bcofrag/i, /\bmuro\s+de\s+suporte/i,
    ],
    negative: [/\bcobertura/i, /\btelha/i],
  },
  {
    esp: "Alvenarias",
    positive: [
      /\balvenaria/i, /\btijolo/i, /\bbloco\s+(de\s+)?(bet[ãa]o|t[ée]rmico|cer[âa]mic)/i,
      /\breboco/i, /\bestuque/i, /\bgesso\s*cart/i, /\bpladur/i,
    ],
    negative: [/\bcobertura/i],
  },
  {
    esp: "Cobertura",
    positive: [
      /\bcobertura/i, /\btelhad/i, /\btelha\b/i, /\bsubtelha/i, /\bcumeeira/i,
      /\bbeirado/i, /\bcaleira/i, /\brufo/i, /\balgeroz/i, /\bclarab[oó]ia/i,
      /\bremate\s+(de\s+)?cobertura/i, /\bimpermeabiliza[çc][ãa]o\s+(de\s+)?cobertura/i,
      /\bisolamento\s+(t[ée]rmico\s+)?(de\s+)?cobertura/i, /\bchapa\s+(sandu|de\s+cobertura)/i,
      /\bpainel\s+sandu/i, /\btubo\s+de\s+queda\s+(da\s+)?cobertura/i,
      /\bplatibanda/i, /\bfibrocimento/i,
    ],
    negative: [
      /\bterraplan/i, /\bescava[çc]/i, /\baterro/i, /\bdesaterro/i, /\bcompacta[çc]/i,
      /\bfunda[çc]/i, /\bsapata/i, /\bdemoli/i, /\bpavimento\s+(t[ée]rreo|exterior)/i,
      /\bmuro\b/i, /\barranjo\s+exterior/i, /\bdrenagem\s+(do\s+)?terreno/i,
      /\bpintura\s+interior/i, /\bcarpintar/i, /\bcaixilh/i,
      /\binstala[çc][ãa]o\s+el[ée]ctric/i, /\bcanaliza[çc]/i,
    ],
  },
  {
    esp: "Caixilharias",
    positive: [
      /\bcaixilh/i, /\bjanela/i, /\bporta\s+(de\s+)?alum[íi]nio/i, /\balum[íi]nio/i,
      /\bpvc\b/i, /\bvidro\s+(duplo|simples|laminad|temperad)/i, /\bestor/i, /\bpersian/i, /\bportad/i,
    ],
  },
  {
    esp: "Eletricidade/ITED",
    positive: [
      /\bel[ée]tric/i, /\belectric/i, /\btomada/i, /\binterruptor/i, /\bquadro\s+el[ée]ctr/i,
      /\bilumina[çc]/i, /\blumin[áa]ria/i, /\bited\b/i, /\bcctv/i, /\bdom[óo]tica/i,
      /\bups\b/i, /\bfotovolt/i,
    ],
  },
  {
    esp: "AVAC",
    positive: [
      /\bavac\b/i, /\bar\s*condic/i, /\bclimatiz/i, /\bventila[çc]/i, /\bextrac[çc]/i,
      /\brecupera[çc][ãa]o\s*calor/i, /\bchiller/i, /\bvrv\b/i, /\bvrf\b/i, /\bconduta\b/i, /\bgrelha\s+(de\s+)?(ar|ventila)/i,
    ],
  },
  {
    esp: "Canalizações",
    positive: [
      /\bcanaliza[çc]/i, /\bhidr[áa]ulic/i, /\besgoto/i, /\b[áa]gua\s+(fria|quente)/i,
      /\bsanit[áa]/i, /\blavat[óo]rio/i, /\bbid[ée]/i, /\bchuveir/i, /\bbanheira/i,
      /\bautoclism/i, /\bsif[ãa]o/i, /\bppr\b/i, /\bpex\b/i, /\bmulticam/i,
    ],
    negative: [/\btubo\s+de\s+queda\s+(da\s+)?cobertura/i],
  },
  {
    esp: "Carpintarias",
    positive: [
      /\bcarpintar/i, /\bporta\s+interior/i, /\broupeir/i, /\barm[áa]rio/i,
      /\bmobili[áa]rio/i, /\bsob[ãa]do/i, /\bpavimento\s+(em\s+)?madeira/i, /\bdeck\b/i,
    ],
  },
  {
    esp: "Pinturas",
    positive: [
      /\bpintura/i, /\btinta\b/i, /\bverniz/i, /\bprim[áa]rio/i, /\bbarram/i, /\bmassa\s+areada/i,
    ],
  },
  {
    esp: "Arranjos Exteriores",
    positive: [
      /\barranjo\s+exterior/i, /\bpavimento\s+exterior/i, /\bcal[çc]ada/i,
      /\blancil/i, /\bjardin/i, /\brelvad/i, /\bmuro\b/i,
    ],
    negative: [/\bcobertura/i, /\btelha/i],
  },
];

const CHAPTER_HINTS: Array<{ esp: Especialidade; rx: RegExp }> = [
  { esp: "Demolições", rx: /demoli/i },
  { esp: "Terraplanagens", rx: /terraplan|movimento\s+de\s+terras|escava/i },
  { esp: "Estruturas", rx: /estrutur|funda[çc]/i },
  { esp: "Alvenarias", rx: /alvenari|paredes\s+divis/i },
  { esp: "Cobertura", rx: /cobertur/i },
  { esp: "Caixilharias", rx: /caixilh|v[ãa]os\s+exteri/i },
  { esp: "Eletricidade/ITED", rx: /electric|el[ée]tr|ited/i },
  { esp: "AVAC", rx: /avac|climatiz|ventila/i },
  { esp: "Canalizações", rx: /canaliza|hidr[áa]ulic|[áa]guas/i },
  { esp: "Carpintarias", rx: /carpintar/i },
  { esp: "Pinturas", rx: /pintur/i },
  { esp: "Arranjos Exteriores", rx: /arranjo|exteri/i },
];

export type ArtigoInput = {
  descricao?: string | null;
  codigo?: string | null;
  capituloCodigo?: string | null;
  capitulo?: string | null;
  subcapitulo?: string | null;
  categoria_custo?: string | null;
  especialidade?: string | null;
};

export type ClassificacaoResultado = {
  especialidade: Especialidade;
  confianca: number; // 0..1
  motivo: string;
};

const TERRAPLANAGEM_RX = /\b(terraplenagens?|terraplanagens?|movimentos?\s+de\s+terras?|escava[çc][ãa]o|escava[çc]|aterro|desaterro|enrocamento|tout-?venant|compacta[çc][ãa]o|decapagem|desmatagem)\b/i;
const BASE_PAVIMENTO_RX = /\bbase(?:s)?\s+de\s+pavimentos?\b|\bpavimentos?\s+(interiores?|exteriores?|flutuantes?)\b/i;
const COBERTURA_RX = /\b(coberturas?|telhados?|telhas?|subtelha|cumeeira|beirado|caleira|rufos?|algeroz|clarab[oó]ia|platibanda|fibrocimento|onduline|painel\s+sandu(?:í|i)che|barreira\s+para-?vapor)\b/i;
const DEMOLICAO_RX = /\b(demoli[çc][ãa]o|demoli[çc][õo]es|demolir|levantamento|remo[çc][ãa]o|desmontagem|desmantelamento|picagem|arrombamento)\b/i;
const ESTRUTURA_RX = /\b(estruturas?|bet[ãa]o\s+armado|funda[çc][õo]es?|sapatas?|vigas?|pilares?|lajes?|cofragem|armaduras?|a[çc]o\s+a?\d+|malha\s+electrossoldada|micro\s*estacas?)\b/i;
const ALVENARIA_RX = /\b(alvenarias?|tijolos?|blocos?|rebocos?|estuques?|gesso\s*cartonado|pladur|paredes?\s+divis[óo]rias?)\b/i;
const CAIXILHARIA_RX = /\b(caixilharias?|janelas?|v[ãa]os?\s+exteriores?|portas?\s+de\s+alum[íi]nio|alum[íi]nio|\bpvc\b|vidros?|estores?|persianas?)\b/i;
const ELETRICIDADE_RX = /\b(eletricidade|electricidade|el[ée]tric[ao]s?|tomadas?|interruptores?|quadro\s+el[ée]ctrico|ilumina[çc][ãa]o|lumin[áa]rias?|\bited\b|cctv|dom[óo]tica|cablagem|fotovoltaic[ao])\b/i;
const AVAC_RX = /\b(avac|ar\s*condicionado|climatiza[çc][ãa]o|ventila[çc][ãa]o|extra[çc][ãa]o|bomba\s+de\s+calor|piso\s+radiante|\bvrv\b|\bvrf\b|daikin|condutas?|grelhas?\s+de\s+ar)\b/i;
const CANALIZACOES_RX = /\b(canaliza[çc][õo]es?|hidr[áa]ulic[ao]s?|abastecimento\s+de\s+[áa]guas?|rede\s+de\s+esgotos?|esgotos?|[áa]guas?\s+residuais?|sanit[áa]rios?|lavat[óo]rios?|duches?|banheiras?|ralos?|sif[õo]es?|fossa\s+s[ée]ptica|po[çc]o\s+de\s+infiltra[çc][ãa]o|autoclismos?)\b/i;
const CARPINTARIA_RX = /\b(carpintarias?|madeiras?|portas?\s+interiores?|roupeiros?|arm[áa]rios?|m[óo]veis?\s+de\s+cozinha|mobili[áa]rio|sobrados?|deck\b|prateleiras?)\b/i;
const PINTURA_RX = /\b(pinturas?|tintas?|vernizes?|prim[áa]rios?|barramentos?|massa\s+areada)\b/i;
const ARRANJOS_EXTERIORES_RX = /\b(arranjos?\s+exteriores?|pavimentos?\s+exteriores?|cal[çc]adas?|lancis?|jardins?|relvados?|muros?\s+exteriores?|pavimento\s+pedonal)\b/i;

function normalizarCodigo(codigo?: string | null) {
  return (codigo ?? "").trim();
}

function codigoComecaPor(codigo: string, prefixo: string) {
  return codigo === prefixo || codigo.startsWith(`${prefixo}.`);
}

function classificacaoEstrutural({ codigo, capituloCodigo, hay, chap }: { codigo: string; capituloCodigo: string; hay: string; chap: string }): ClassificacaoResultado | null {
  if (DEMOLICAO_RX.test(hay) || codigoComecaPor(capituloCodigo, "3") || codigoComecaPor(codigo, "3")) {
    return { especialidade: "Demolições", confianca: 1, motivo: "Capítulo/código de demolições" };
  }
  if (TERRAPLANAGEM_RX.test(hay) || codigoComecaPor(capituloCodigo, "4.2") || codigoComecaPor(codigo, "4.2")) {
    return { especialidade: "Terraplanagens", confianca: 1, motivo: "Capítulo/código de terraplenagens" };
  }
  if ((codigoComecaPor(codigo, "8") || codigoComecaPor(capituloCodigo, "8")) && BASE_PAVIMENTO_RX.test(hay)) {
    return { especialidade: "Outros", confianca: 0.95, motivo: "Base de pavimentos — rever fora de cobertura/instalações" };
  }
  if (ESTRUTURA_RX.test(hay)) {
    return { especialidade: "Estruturas", confianca: 0.95, motivo: "Capítulo/descrição de estruturas" };
  }
  if (COBERTURA_RX.test(hay) || codigoComecaPor(capituloCodigo, "12") || codigoComecaPor(codigo, "12")) {
    return { especialidade: "Cobertura", confianca: 0.95, motivo: "Capítulo/descrição de cobertura" };
  }
  if (ELETRICIDADE_RX.test(hay) || codigoComecaPor(capituloCodigo, "16") || codigoComecaPor(codigo, "16")) {
    return { especialidade: "Eletricidade/ITED", confianca: 0.95, motivo: "Capítulo/descrição de eletricidade/ITED" };
  }
  if (AVAC_RX.test(hay) || codigoComecaPor(capituloCodigo, "17") || codigoComecaPor(codigo, "17")) {
    return { especialidade: "AVAC", confianca: 0.95, motivo: "Capítulo/descrição de AVAC" };
  }
  if (CANALIZACOES_RX.test(hay)) {
    if (ALVENARIA_RX.test(hay) && !/\b(tubagens?|canaliza[çc][õo]es?|rede\s+de\s+esgotos?|rede\s+de\s+abastecimento|[áa]guas?\s+residuais?|fossa\s+s[ée]ptica|po[çc]o\s+de\s+infiltra[çc][ãa]o)\b/i.test(hay)) {
      return { especialidade: "Alvenarias", confianca: 0.95, motivo: "Trabalho construtivo em alvenaria" };
    }
    return { especialidade: "Canalizações", confianca: 0.95, motivo: "Capítulo/descrição de canalizações" };
  }
  if (CAIXILHARIA_RX.test(hay)) {
    return { especialidade: "Caixilharias", confianca: 0.95, motivo: "Capítulo/descrição de caixilharias" };
  }
  if (PINTURA_RX.test(hay)) {
    return { especialidade: "Pinturas", confianca: 0.95, motivo: "Capítulo/descrição de pinturas" };
  }
  if (ALVENARIA_RX.test(hay)) {
    return { especialidade: "Alvenarias", confianca: 0.95, motivo: "Capítulo/descrição de alvenarias" };
  }
  if (ARRANJOS_EXTERIORES_RX.test(hay)) {
    return { especialidade: "Arranjos Exteriores", confianca: 0.95, motivo: "Capítulo/descrição de arranjos exteriores" };
  }
  if (CARPINTARIA_RX.test(hay)) {
    return { especialidade: "Carpintarias", confianca: 0.9, motivo: "Capítulo/descrição de carpintarias" };
  }
  return null;
}

export function classificarArtigo(a: ArtigoInput): ClassificacaoResultado {
  // 1) Especialidade já atribuída manualmente → respeita
  if (a.especialidade) {
    const m = ESPECIALIDADES.find(e => e.toLowerCase() === a.especialidade!.toLowerCase());
    if (m) return { especialidade: m, confianca: 1, motivo: "Especialidade atribuída manualmente" };
  }

  const desc = (a.descricao ?? "").toString();
  const codigo = normalizarCodigo(a.codigo);
  const capituloCodigo = normalizarCodigo(a.capituloCodigo);
  const chap = [a.capitulo, a.subcapitulo].filter(Boolean).join(" ");
  const hay = `${desc} ${chap}`;

  // 2) Guardas estruturais: quando o capítulo/código do mapa identifica claramente
  // a família do trabalho, isto prevalece sobre palavras soltas na descrição.
  const estrutural = classificacaoEstrutural({ codigo, capituloCodigo, hay, chap });
  if (estrutural) return estrutural;

  const capituloIndicaCobertura = COBERTURA_RX.test(chap) || codigoComecaPor(capituloCodigo, "12") || codigoComecaPor(codigo, "12");
  const descricaoIndicaCobertura = COBERTURA_RX.test(desc);

  // 3) Score por palavras-chave (positivas/negativas) na descrição+capítulo
  const scores = new Map<Especialidade, number>();
  for (const rule of RULES) {
    let s = 0;
    for (const rx of rule.positive) if (rx.test(hay)) s += 1;
    if (rule.negative) for (const rx of rule.negative) if (rx.test(hay)) s -= 2;
    if (s !== 0) scores.set(rule.esp, s);
  }

  if (capituloIndicaCobertura || descricaoIndicaCobertura) {
    scores.set("Cobertura", Math.max(scores.get("Cobertura") ?? 0, 3));
  } else {
    scores.delete("Cobertura");
  }

  // 4) Reforço pelo capítulo (peso adicional)
  for (const h of CHAPTER_HINTS) {
    if (chap && h.rx.test(chap)) {
      scores.set(h.esp, (scores.get(h.esp) ?? 0) + 2);
    }
  }

  // Sem nenhum sinal
  if (scores.size === 0) {
    return { especialidade: "Outros", confianca: 0.1, motivo: "Sem palavras-chave reconhecidas" };
  }

  // Escolher a maior pontuação positiva
  const ordered = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [topEsp, topScore] = ordered[0];
  const second = ordered[1]?.[1] ?? 0;

  if (topScore <= 0) {
    return { especialidade: "Outros", confianca: 0.2, motivo: "Palavras-chave negativas anularam a classificação" };
  }

  // Confiança = combinação do score e da margem face ao segundo
  const margem = topScore - Math.max(second, 0);
  const confianca = Math.min(1, 0.5 + 0.15 * topScore + 0.1 * margem);

  return {
    especialidade: topEsp,
    confianca,
    motivo: `Score ${topScore} (margem ${margem}) por palavras-chave de ${topEsp}`,
  };
}

// Compatibilidade com chamadas existentes
export function inferirEspecialidade(a: ArtigoInput): Especialidade {
  return classificarArtigo(a).especialidade;
}

export const CONFIANCA_MINIMA = 0.8;

export function validarArtigoParaEspecialidade(a: ArtigoInput, especialidade: string) {
  // Especialidade especial "Betão" agrega todos os artigos relacionados com
  // betão / elementos estruturais, independentemente do capítulo de origem.
  if (especialidade === "Betão") {
    const valido = isBetaoArtigo(a);
    return {
      valido,
      classificacao: {
        especialidade: "Betão" as unknown as Especialidade,
        confianca: valido ? 1 : 0,
        motivo: valido ? "Artigo identificado como trabalho de betão" : "Sem palavras-chave de betão",
      },
    };
  }
  const { especialidade: _ignorarEspecialidadeGuardada, ...semEspecialidadeGuardada } = a;
  const classificacao = classificarArtigo(semEspecialidadeGuardada);
  return {
    valido: classificacao.especialidade === especialidade && classificacao.confianca >= CONFIANCA_MINIMA,
    classificacao,
  };
}

// =============================================================
// Pacote "Betão" — sempre presente em qualquer obra. Identifica
// artigos relacionados com betão / estruturas em betão mesmo que
// estejam dispersos noutros capítulos (estruturas, bases de
// pavimentos, lajes de cobertura, fundações, etc.).
// =============================================================

const BETAO_DESC_RX = /\b(bet[ãa]o|betonagem|betonilha|sapatas?|ensoleiramento|cofrag\w*|armaduras?\s+(?:em|para|de)|ma[çc]i[çc]os?|micro\s*estacas?|muros?\s+de\s+(?:suporte|conten[çc][ãa]o|tens[ãa]o)|escadas?\s+em\s+bet|enchimentos?\s+(?:em\s+)?bet|regulariza[çc][ãa]o\s+(?:em\s+)?bet|malha\s+electrossoldada|ferro\s+para\s+bet|c\s*\d{2}\s*\/\s*\d{2}\b|\bxc\s*\d|estruturas?\s+mistas?|vigas?\s+(?:de\s+funda[çc][ãa]o|de\s+borda|de\s+lintel|principais?|secund[áa]rias?|em\s+bet|de\s+bet|de\s+contorno|de\s+coroamento|\/p[óo]rticos?|p[óo]rticos?))\b/i;

// Padrões soltos (viga/pilar/laje/sapata) — aceites quando o capítulo é
// claramente estrutural OU quando o próprio artigo contém betão.
const BETAO_SOFT_RX = /\b(vigas?|pilares?|lajes?|sapatas?|funda[çc][õo]es?|funda[çc][ãa]o)\b/i;
const CAP_ESTRUTURAL_RX = /\b(estruturas?|funda[çc][õo]es?|bet[ãa]o|bases?\s+de\s+pavimentos?)\b/i;

// Negativos: "viga/pilar/laje" referem-se claramente a outro material.
const BETAO_NEG_RX = /\b(em\s+madeira|de\s+madeira|em\s+alum[íi]nio|de\s+alum[íi]nio|em\s+pvc|gesso\s*cartonado|pladur|laje\s+de\s+gesso)\b/i;

export function isBetaoArtigo(a: ArtigoInput): boolean {
  const desc = (a.descricao ?? "").toString();
  const chap = `${a.capitulo ?? ""} ${a.subcapitulo ?? ""}`;
  const hay = `${desc} ${chap}`;
  if (BETAO_NEG_RX.test(desc) && !/\bbet[ãa]o\b/i.test(desc)) return false;
  if (BETAO_DESC_RX.test(hay)) return true;
  if (CAP_ESTRUTURAL_RX.test(chap) && BETAO_SOFT_RX.test(desc)) return true;
  return false;
}

