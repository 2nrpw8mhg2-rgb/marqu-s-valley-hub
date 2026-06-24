// Catálogo canónico de especialidades e classificador automático

export const ESPECIALIDADES = [
  "Demolições",
  "Estruturas",
  "Alvenarias",
  "Cobertura",
  "Caixilharias",
  "Eletricidade/ITED",
  "AVAC",
  "Canalizações",
  "Carpintarias",
  "Pinturas",
  "Outros",
] as const;

export type Especialidade = (typeof ESPECIALIDADES)[number];

const KEYWORDS: Array<{ esp: Especialidade; words: RegExp }> = [
  { esp: "Demolições", words: /\b(demoli|picag|remov|desmant|arrombam)/i },
  { esp: "Estruturas", words: /\b(beton|bet[ãa]o|armadura|a[çc]o|pilar|viga|laje|funda|sapata|micro\s*estaca|cofrag)/i },
  { esp: "Alvenarias", words: /\b(alvenaria|tijolo|bloco|reboco|chap|estuque|gesso\s*cart|pladur)/i },
  { esp: "Cobertura", words: /\b(cobertura|telha|telhad|impermeab|isolamento\s*t[ée]rm|chapa\s*sandu|c[ãa]l|fibrocim)/i },
  { esp: "Caixilharias", words: /\b(caixilh|janela|porta\s*alum|alum[íi]nio|pvc|vidro|estor|persian|portad)/i },
  { esp: "Eletricidade/ITED", words: /\b(electric|el[ée]tric|tomada|interruptor|quadro\s*el[ée]ctr|cabo|iluminaç|lumin[áa]ria|ited|cctv|dom[óo]tica|ups|fotovolt)/i },
  { esp: "AVAC", words: /\b(avac|ar\s*condic|climatiz|ventila|extrac|recupera[çc][ãa]o\s*calor|chiller|vrv|vrf|condut|ducto|grelha)/i },
  { esp: "Canalizações", words: /\b(canaliz|tubo|esgoto|[áa]gua\s*(fria|quente)|sanit[áa]|lavat[óo]rio|bid[ée]|chuveir|banheira|autoclism|sif[ãa]o|ppr|pex|multicam)/i },
  { esp: "Carpintarias", words: /\b(carpintar|madeir|porta\s*interior|roupeir|arm[áa]rio|mobili[áa]rio|sob[ãa]do|pavimento\s*madeir|deck)/i },
  { esp: "Pinturas", words: /\b(pintura|tinta|verniz|primario|prim[áa]rio|barram|massa\s*areada)/i },
];

const CHAPTER_HINTS: Array<{ esp: Especialidade; rx: RegExp }> = [
  { esp: "Demolições", rx: /demoli/i },
  { esp: "Estruturas", rx: /estrutur|funda|bet[ãa]o/i },
  { esp: "Alvenarias", rx: /alvenari|paredes|revestiment/i },
  { esp: "Cobertura", rx: /cobertur/i },
  { esp: "Caixilharias", rx: /caixilh|v[ãa]os|janel/i },
  { esp: "Eletricidade/ITED", rx: /electric|el[ée]tr|ited/i },
  { esp: "AVAC", rx: /avac|climatiz|ventila/i },
  { esp: "Canalizações", rx: /canaliz|hidr[áa]ul|[áa]guas/i },
  { esp: "Carpintarias", rx: /carpintar|madeir/i },
  { esp: "Pinturas", rx: /pintur/i },
];

export type ArtigoInput = {
  descricao?: string | null;
  codigo?: string | null;
  capitulo?: string | null;
  subcapitulo?: string | null;
  categoria_custo?: string | null;
  especialidade?: string | null;
};

export function inferirEspecialidade(a: ArtigoInput): Especialidade {
  if (a.especialidade) {
    const m = ESPECIALIDADES.find(e => e.toLowerCase() === a.especialidade!.toLowerCase());
    if (m) return m;
  }
  const hay = [a.capitulo, a.subcapitulo].filter(Boolean).join(" ");
  if (hay) {
    for (const h of CHAPTER_HINTS) if (h.rx.test(hay)) return h.esp;
  }
  const desc = a.descricao ?? "";
  for (const k of KEYWORDS) if (k.words.test(desc)) return k.esp;
  return "Outros";
}
