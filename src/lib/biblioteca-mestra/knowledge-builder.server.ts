import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Sb = SupabaseClient<Database>;

// Limites por tipo: guarda final, não cota da IA. Estão deliberadamente
// generosos para permitir enriquecimento profundo.
const LIMITES: Record<string, number> = {
  palavras_chave: 40,
  sinonimos: 30,
  expressoes: 30,
  materiais: 25,
  unidades: 10,
  capitulos: 10,
  exemplos: 50,
};
const MQ_TOP = 120;
const CANDIDATOS_TOP = 150;
const ORC_FETCH_PER_TOKEN = 200;
const VIZINHOS_LIMIT = 40;
const VIZINHO_EXEMPLOS = 12;
const IRMAOS_CATEGORIA_LIMIT = 25;
const VOC_REUTILIZADO_TOP = 50;
const CORRECOES_TOP = 30;

type FonteOrigem = "historico" | "candidatos" | "vizinhos" | "inferido";

type GeneratedTermo = {
  termo: string;
  peso: number;
  confianca: number;
  justificacao?: string;
  fonte?: FonteOrigem;
};
type Generated = {
  palavras_chave: GeneratedTermo[];
  sinonimos: GeneratedTermo[];
  expressoes: GeneratedTermo[];
  materiais: GeneratedTermo[];
  unidades: GeneratedTermo[];
  capitulos: GeneratedTermo[];
  exemplos: GeneratedTermo[];
  termos_negativos: GeneratedTermo[];
};

type RemocaoNegativo = {
  termo: string;
  motivo: string;
};

type RemocaoTermo = {
  termo: string;
  motivo: string;
};

const TIPO_MAP = {
  palavras_chave: { tipo: "palavra_chave", pesoDefault: 30, sign: 1 },
  sinonimos: { tipo: "sinonimo", pesoDefault: 10, sign: 1 },
  expressoes: { tipo: "expressao", pesoDefault: 40, sign: 1 },
  materiais: { tipo: "material", pesoDefault: 8, sign: 1 },
} as const;

const FONTE_TO_ORIGEM: Record<FonteOrigem, "mapas_quantidades" | "orcamentos_brutos" | "artigos_vizinhos" | "ia"> = {
  historico: "mapas_quantidades",
  candidatos: "orcamentos_brutos",
  vizinhos: "artigos_vizinhos",
  inferido: "ia",
};

const STOPWORDS = new Set([
  "para", "com", "sem", "por", "dos", "das", "que", "uma", "uns", "umas",
  "este", "esta", "estes", "estas", "pelo", "pela", "nos", "nas", "como",
  "fornecimento", "aplicacao", "execucao", "incluindo", "tudo", "necessario",
  "respetivos", "respetivas", "incluindo", "trabalhos",
]);

// Vocabulário genérico de obra: verbos/substantivos comuns a TODAS as
// especialidades. Nunca podem virar termos negativos porque não discriminam
// nada. Já em forma canónica (sem acentos, singular aproximado).
const GENERICOS_OBRA = new Set([
  "fornecimento", "aplicacao", "execucao", "instalacao", "montagem", "desmontagem",
  "remocao", "demolicao", "transporte", "carga", "descarga", "limpeza", "ensaio",
  "teste", "testes", "verificacao", "controlo", "manutencao", "reparacao",
  "substituicao", "ligacao", "integracao", "acabamento", "acabamentos",
  "preparacao", "regularizacao", "nivelamento", "protecao", "isolamento",
  "vedacao", "fixacao", "alinhamento", "assentamento", "implantacao",
  "marcacao", "medicao", "gestao", "coordenacao", "supervisao", "seguranca",
  "qualidade", "conformidade", "norma", "normas", "especificacao", "projeto",
  "desenho", "peca", "pecas", "item", "itens", "artigo", "artigos", "trabalho",
  "trabalhos", "servico", "servicos", "obra", "obras", "estaleiro", "material",
  "materiais", "equipamento", "equipamentos", "ferramenta", "ferramentas",
  "unidade", "metro", "metros", "tonelada", "conjunto", "kit", "sistema",
  "sistemas", "componente", "componentes", "elemento", "elementos", "tipo",
  "tipos", "modelo", "modelos", "marca", "marcas", "cor", "cores", "dimensao",
  "dimensoes", "espessura", "altura", "largura", "comprimento", "diametro",
  "qualquer", "diversos", "varios", "geral", "gerais", "novo", "novos", "nova",
  "novas", "existente", "existentes", "incluido", "incluidos", "incluindo",
  "necessario", "necessaria", "respetivo", "respetiva", "respetivos",
  "respetivas", "completo", "completa", "completos", "completas",
  // Vocabulário transversal a várias especialidades de construção: nunca
  // discrimina entre especialidades, por isso não pode virar termo negativo.
  "civil", "construcao", "construcoes", "construir", "edificio", "edificios",
  "edificacao", "edificacoes", "exterior", "exteriores", "interior", "interiores",
  "arranjo", "arranjos", "residuo", "residuos", "entulho", "entulhos",
  "movimento", "movimentos", "contencao", "contencoes", "jardim", "jardins",

]);

function tokenGenerico(c: string): boolean {
  if (!c) return true;
  if (/\d/.test(c)) return true;
  if (c.length < 5) return true;
  if (c.includes(" ")) return false;
  return STOPWORDS.has(c) || GENERICOS_OBRA.has(c);
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function admin(): Sb {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      `Missing Supabase env var(s): ${[!url && "SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean).join(", ")}`
    );
  }
  // New-format Supabase API keys (sb_secret_*) are opaque, not JWTs.
  // PostgREST rejects them when sent as `Authorization: Bearer <key>`
  // ("Expected 3 parts in JWT; got 1"). Strip that header and keep only `apikey`.
  const supabaseFetch: typeof fetch = (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
  return createClient<Database>(url, key, {
    global: { fetch: supabaseFetch },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

// Reduz um token pt-PT a uma forma singular aproximada.
// Heurística suficiente para deduplicar "betão"/"betões", "viga"/"vigas",
// "muro"/"muros", "pilar"/"pilares" sem necessitar de dicionário externo.
function lemaSingular(token: string): string {
  if (!token || token.length < 4) return token;
  if (/ões$/.test(token)) return token.replace(/ões$/, "ao");
  if (/ães$/.test(token)) return token.replace(/ães$/, "ao");
  if (/oes$/.test(token)) return token.replace(/oes$/, "ao");
  if (/aes$/.test(token)) return token.replace(/aes$/, "ao");
  if (/eis$/.test(token)) return token.replace(/eis$/, "el");
  if (/ais$/.test(token)) return token.replace(/ais$/, "al");
  if (/ois$/.test(token)) return token.replace(/ois$/, "ol");
  if (/uis$/.test(token)) return token.replace(/uis$/, "ul");
  if (/ns$/.test(token)) return token.replace(/ns$/, "m");
  if (/res$/.test(token)) return token.replace(/res$/, "r");
  if (/zes$/.test(token)) return token.replace(/zes$/, "z");
  if (/ses$/.test(token) && token.length >= 5) return token.replace(/ses$/, "s");
  if (/s$/.test(token) && !/[êéó]s$/.test(token) && !/às$/.test(token)) {
    return token.replace(/s$/, "");
  }
  return token;
}

// Forma canónica usada para comparar/deduplicar termos.
// minúsculas + sem acentos + sem pontuação + espaços únicos + lema singular
// por palavra. Nunca usar para mostrar — só para comparar.
function canonicalizar(s: string): string {
  const n = normalize(s).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!n) return "";
  return n.split(" ").filter(Boolean).map(lemaSingular).join(" ");
}

// ============================================================
// Índice estatístico inter-especialidades
// Construído UMA VEZ no início da run; usado para derivar
// termos_negativos de forma determinística (não inventados pela IA).
// ============================================================

type IndiceGlobal = {
  // termoCanonico -> espId -> conjunto de artigos onde aparece
  termoEspArtigos: Map<string, Map<string, Set<string>>>;
  // artigoId -> conjunto de termos canónicos que descrevem o artigo
  artigoTermos: Map<string, Set<string>>;
  // espId -> nº de artigos ativos
  totalPorEsp: Map<string, number>;
  // espId -> nome legível
  nomeEsp: Map<string, string>;
  // artigoId -> espId
  artigoEsp: Map<string, string>;
};


function addToIdx(idx: IndiceGlobal, termoCanon: string, espId: string, artigoId: string) {
  if (tokenGenerico(termoCanon)) return;
  let m = idx.termoEspArtigos.get(termoCanon);
  if (!m) { m = new Map(); idx.termoEspArtigos.set(termoCanon, m); }
  let s = m.get(espId);
  if (!s) { s = new Set(); m.set(espId, s); }
  s.add(artigoId);

  let art = idx.artigoTermos.get(artigoId);
  if (!art) { art = new Set(); idx.artigoTermos.set(artigoId, art); }
  art.add(termoCanon);
}

function addTextoAoIdx(idx: IndiceGlobal, texto: string, espId: string, artigoId: string, incluirExpressaoCompleta = false) {
  const full = canonicalizar(texto);
  if (incluirExpressaoCompleta && full && full.includes(" ") && full.split(" ").length <= 6) {
    addToIdx(idx, full, espId, artigoId);
  }
  for (const tok of tokenize(texto)) {
    const c = lemaSingular(tok);
    if (c) addToIdx(idx, c, espId, artigoId);
  }
}

async function construirIndiceGlobal(sb: Sb): Promise<IndiceGlobal> {
  const idx: IndiceGlobal = {
    termoEspArtigos: new Map(),
    artigoTermos: new Map(),
    totalPorEsp: new Map(),
    nomeEsp: new Map(),
    artigoEsp: new Map(),
  };

  const { data: esps } = await sb.from("biblioteca_especialidades").select("id, nome");
  for (const e of esps ?? []) idx.nomeEsp.set(e.id as string, (e.nome as string) ?? "");

  const { data: subs } = await sb
    .from("biblioteca_subespecialidades")
    .select("id, nome, especialidade_id");
  const subEsp = new Map<string, string>();
  const subNome = new Map<string, string>();
  for (const s of subs ?? []) {
    subEsp.set(s.id as string, s.especialidade_id as string);
    subNome.set(s.id as string, (s.nome as string) ?? "");
  }

  // Mapeamento artigo→especialidade e vocabulário técnico de toda a Biblioteca.
  // O índice é universal: usa Artigos Mestre, Especialidades, Subespecialidades,
  // Categorias, conhecimento curado e Mapas de Quantidades já classificados.
  const { data: arts } = await sb
    .from("biblioteca_artigos")
    .select("id, codigo, descricao, observacoes, subespecialidade_id, biblioteca_categorias(nome)")
    .eq("ativo", true);

  for (const a of (arts ?? []) as any[]) {
    const espId = subEsp.get(a.subespecialidade_id as string);
    if (!espId) continue;
    idx.artigoEsp.set(a.id as string, espId);
    idx.totalPorEsp.set(espId, (idx.totalPorEsp.get(espId) ?? 0) + 1);
    const artigoId = a.id as string;
    addTextoAoIdx(idx, a.descricao ?? "", espId, artigoId);
    addTextoAoIdx(idx, a.observacoes ?? "", espId, artigoId);
    addTextoAoIdx(idx, subNome.get(a.subespecialidade_id as string) ?? "", espId, artigoId);
    addTextoAoIdx(idx, idx.nomeEsp.get(espId) ?? "", espId, artigoId);
    addTextoAoIdx(idx, a?.biblioteca_categorias?.nome ?? "", espId, artigoId);
  }

  // FONTE 1: termos positivos já curados na biblioteca.
  const { data: conhec } = await sb
    .from("biblioteca_artigo_conhecimento")
    .select("artigo_mestre_id, tipo, termo")
    .eq("ativo", true)
    .in("tipo", ["palavra_chave", "sinonimo", "expressao", "material"]);
  for (const r of conhec ?? []) {
    const espId = idx.artigoEsp.get(r.artigo_mestre_id as string);
    if (!espId) continue;
    const c = canonicalizar(r.termo as string);
    if (c) addToIdx(idx, c, espId, r.artigo_mestre_id as string);
    addTextoAoIdx(idx, r.termo as string, espId, r.artigo_mestre_id as string, true);
  }


  // FONTE 2: classificações reais (validadas ou auto) — único sinal de uso real.
  const { data: classifs } = await sb
    .from("classificacao_artigos")
    .select("descricao_original, artigo_mestre_id, estado")
    .in("estado", ["validado", "classificado_auto"])
    .not("artigo_mestre_id", "is", null);
  for (const r of classifs ?? []) {
    const aid = r.artigo_mestre_id as string | null;
    if (!aid) continue;
    const espId = idx.artigoEsp.get(aid);
    if (!espId) continue;
    const vistos = new Set<string>();
    for (const tok of tokenize((r.descricao_original as string) ?? "")) {
      const c = lemaSingular(tok);
      if (vistos.has(c)) continue;
      vistos.add(c);
      addToIdx(idx, c, espId, aid);
    }
  }

  return idx;
}

function setTemConflito(termoCanon: string, termos: Set<string>): boolean {
  for (const t of termos) {
    if (canonicosConflituam(termoCanon, t)) return true;
  }
  return false;
}

// Calcula termos negativos para um artigo a partir do índice global universal.
// Filosofia: negativos são exceções de alta confiança para afastar falsos
// positivos de outras especialidades. Não há quota: se nada for seguro, fica [].
// Gates obrigatórios:
//  - termo não aparece como positivo, contexto, histórico real ou vocabulário do
//    Artigo Mestre atual;
//  - termo não aparece na especialidade atual;
//  - termo é fortemente característico de outra especialidade;
//  - confiança automática >= limiarAutoConfianca.
function derivarNegativos(
  artigoId: string,
  artigoEspId: string,
  vocPositivoCanonico: Set<string>,
  vocReaisDoArtigo: Set<string>,
  idx: IndiceGlobal,
  ancorasArtigo: Set<string> = new Set(),
  maxAlta = 8,
  limiarAutoConfianca = 90
): { termos: GeneratedTermo[]; rejeicoes: RemocaoNegativo[] } {
  type Cand = {
    termo: string; espDom: string; domPct: number; exclusividade: number;
    suporte: number; totalAll: number; confianca: number;
    proximidade: number; coOcorrentes: string[];
  };
  const out: Cand[] = [];
  const rejeicoes: RemocaoNegativo[] = [];
  const vocArtigoAtual = idx.artigoTermos.get(artigoId) ?? new Set<string>();
  const rejeitar = (termo: string, motivo: string) => {
    if (rejeicoes.length < 40) rejeicoes.push({ termo, motivo });
  };

  // Âncoras = vocabulário canónico que caracteriza este artigo (descrição,
  // positivos, contexto, histórico real). É o que permite diferenciar
  // negativos por artigo: dois artigos da mesma especialidade têm âncoras
  // diferentes, logo confundíveis diferentes.
  const ancoras = new Set<string>(ancorasArtigo);
  for (const t of vocPositivoCanonico) ancoras.add(t);
  for (const t of vocReaisDoArtigo) ancoras.add(t);
  for (const t of vocArtigoAtual) ancoras.add(t);
  for (const a of [...ancoras]) {
    if (tokenGenerico(a)) ancoras.delete(a);
  }

  for (const [termoCanon, espMap] of idx.termoEspArtigos.entries()) {
    if (tokenGenerico(termoCanon)) { rejeitar(termoCanon, "vocabulário genérico"); continue; }
    if (setTemConflito(termoCanon, vocPositivoCanonico)) { rejeitar(termoCanon, "existe nas listas positivas/contexto do artigo"); continue; }
    if (setTemConflito(termoCanon, vocReaisDoArtigo)) { rejeitar(termoCanon, "aparece no histórico real deste artigo"); continue; }
    if (setTemConflito(termoCanon, vocArtigoAtual)) { rejeitar(termoCanon, "semanticamente próximo do Artigo Mestre atual"); continue; }

    const thisEspSet = espMap.get(artigoEspId);
    const thisCount = thisEspSet?.size ?? 0;
    if (thisCount > 0) { rejeitar(termoCanon, "aparece na especialidade atual"); continue; }

    let bestEsp = "", bestDom = 0, bestSize = 0;
    let totalAll = 0;
    for (const [espId, artSet] of espMap.entries()) {
      totalAll += artSet.size;
      if (espId === artigoEspId) continue;
      const total = idx.totalPorEsp.get(espId) ?? 0;
      if (total < 3) continue;
      const dom = artSet.size / total;
      if (dom > bestDom) { bestDom = dom; bestEsp = espId; bestSize = artSet.size; }
    }
    if (totalAll < 8) { rejeitar(termoCanon, "suporte global insuficiente"); continue; }
    if (bestSize < 8) { rejeitar(termoCanon, "suporte noutra especialidade insuficiente"); continue; }
    if (bestDom < 0.08 || !bestEsp) { rejeitar(termoCanon, "sem especialidade dominante clara"); continue; }
    const exclusividade = totalAll > 0 ? bestSize / totalAll : 0;
    if (exclusividade < 0.90) { rejeitar(termoCanon, `exclusividade baixa (${Math.round(exclusividade * 100)}%)`); continue; }

    const suporteScore = Math.min(1, Math.log2(bestSize + 1) / 6);
    const confianca = Math.round(100 * ((0.70 * exclusividade) + (0.30 * suporteScore)));
    if (confianca < limiarAutoConfianca) { rejeitar(termoCanon, `confiança ${confianca}% abaixo do limiar ${limiarAutoConfianca}%`); continue; }

    // Proximidade por artigo: para cada artigo da especialidade dominante onde
    // o termo aparece, conta tokens em comum com as âncoras deste Artigo
    // Mestre. Quanto maior, mais "confundível" — preferimos esses negativos
    // porque tratam falsos positivos reais deste artigo, e não exclusividade
    // estatística no abstrato.
    let proximidade = 0;
    const coOcorrentes = new Set<string>();
    if (ancoras.size) {
      const arts = espMap.get(bestEsp);
      if (arts) {
        for (const aId of arts) {
          const voc = idx.artigoTermos.get(aId);
          if (!voc) continue;
          for (const t of voc) {
            if (t === termoCanon) continue;
            if (ancoras.has(t)) {
              proximidade++;
              if (coOcorrentes.size < 5) coOcorrentes.add(t);
            }
          }
        }
      }
    }

    out.push({
      termo: termoCanon, espDom: bestEsp, domPct: bestDom, exclusividade,
      suporte: bestSize, totalAll, confianca,
      proximidade, coOcorrentes: [...coOcorrentes],
    });
  }

  // Normaliza proximidade para [0,1] usando o máximo observado e ordena por
  // score combinado: 50% proximidade ao artigo + 50% confiança estatística.
  // Empate: maior exclusividade, depois maior suporte.
  const maxProx = out.reduce((m, c) => Math.max(m, c.proximidade), 0);
  const scored = out.map((c) => {
    const proxNorm = maxProx > 0 ? c.proximidade / maxProx : 0;
    const score = 0.5 * proxNorm + 0.5 * (c.confianca / 100);
    return { ...c, proxNorm, score };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.exclusividade !== a.exclusividade) return b.exclusividade - a.exclusividade;
    return b.suporte - a.suporte;
  });

  const altas: GeneratedTermo[] = [];
  const vistos = new Set<string>();
  for (const n of scored) {
    const c = canonicalizar(n.termo);
    if (!c || vistos.has(c)) continue;
    vistos.add(c);
    const proxBit = n.proximidade > 0 && n.coOcorrentes.length
      ? ` Confundível com este artigo via co-ocorrência com: ${n.coOcorrentes.join(", ")}.`
      : "";
    const just =
      `"${n.termo}" é específico de ${idx.nomeEsp.get(n.espDom) ?? ""} ` +
      `(${n.suporte} de ${n.totalAll} ocorrências; ${Math.round(n.exclusividade * 100)}% exclusividade, ` +
      `${Math.round(n.domPct * 100)}% dominância) e não aparece no artigo/especialidade atual.` +
      proxBit;
    if (altas.length < maxAlta) altas.push({
      termo: n.termo,
      peso: 30,
      confianca: n.confianca,
      fonte: "vizinhos",
      justificacao: just,
    });
  }
  return { termos: altas, rejeicoes };
}

function canonicosComTokens(s: string): string[] {
  const c = canonicalizar(s);
  if (!c) return [];
  const out = new Set<string>([c]);
  for (const tok of c.split(" ").filter(Boolean)) {
    const lema = lemaSingular(tok);
    if (lema && !tokenGenerico(lema)) out.add(lema);
  }
  return [...out];
}

function canonicosConflituam(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const aParts = a.split(" ").filter(Boolean);
  const bParts = b.split(" ").filter(Boolean);
  if (aParts.length > 1 && new RegExp(`(^| )${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(b)) return true;
  if (bParts.length > 1 && new RegExp(`(^| )${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(a)) return true;
  if (aParts.length === 1 && bParts.includes(a)) return true;
  if (bParts.length === 1 && aParts.includes(b)) return true;
  return false;
}

function construirVocPositivoFinal(gen: Generated, fontes?: Fontes): Set<string> {
  const positivos = new Set<string>();
  const add = (s: string) => {
    for (const c of canonicosComTokens(s)) positivos.add(c);
  };

  for (const k of ["palavras_chave", "sinonimos", "expressoes", "materiais"] as const) {
    for (const t of gen[k]) add(t.termo);
  }
  for (const e of fontes?.existentes ?? []) {
    if (e.tipo !== "termo_negativo") add(e.termo as string);
  }
  if (fontes) {
    add(fontes.artigo.descricao);
    add(fontes.contexto.especialidade);
    add(fontes.contexto.subespecialidade);
    add(fontes.contexto.categoria);
    for (const h of fontes.historico) add(h.descricao);
  }
  return positivos;
}

function validarTermosNegativosFinais(
  gen: Generated,
  fontes?: Fontes
): { removidos: RemocaoNegativo[]; removidosDup: number; mensagem?: string } {
  const removidos: RemocaoNegativo[] = [];
  let removidosDup = 0;
  const positivos = construirVocPositivoFinal(gen, fontes);
  const vistos = new Set<string>();
  const out: GeneratedTermo[] = [];

  for (const t of gen.termos_negativos) {
    const c = canonicalizar(t.termo);
    if (!c) {
      removidos.push({ termo: t.termo, motivo: "termo vazio após normalização" });
      continue;
    }
    if (vistos.has(c)) {
      removidosDup++;
      removidos.push({ termo: t.termo, motivo: "duplicado após normalização singular/plural" });
      continue;
    }
    vistos.add(c);

    let motivo: string | null = null;
    for (const pos of positivos) {
      if (canonicosConflituam(c, pos)) {
        motivo = `conflito com termo positivo "${pos}"`;
        break;
      }
    }
    if (!motivo && t.confianca < 90) {
      motivo = `confiança ${t.confianca}% abaixo do limiar automático de 90%`;
    }
    if (!motivo && tokenGenerico(c)) {
      motivo = "vocabulário genérico de obra sem valor discriminativo";
    }
    if (motivo) {
      removidos.push({ termo: t.termo, motivo });
      continue;
    }
    out.push({ ...t, termo: c });
  }

  gen.termos_negativos = out;
  return {
    removidos,
    removidosDup,
    mensagem: out.length === 0 ? "Não foram encontrados termos negativos com confiança suficiente." : undefined,
  };
}

const PALAVRAS_CHAVE_FRACAS = new Set<string>(
  [
    "fornecimento", "aplicacao", "execucao", "trabalho", "trabalhos",
    "servico", "servicos", "obra", "obras", "material", "materiais",
    "equipamento", "equipamentos", "sistema", "sistemas", "elemento",
    "elementos", "tipo", "modelo", "marca", "unidade", "incluindo",
    "necessario", "completo", "existente", "novo", "nova", "diversos",
    "varios", "geral", "fornecimento e aplicacao", "fornecimento e assentamento",
    "execucao de", "incluindo todos os trabalhos",
  ].map((t) => canonicalizar(t)).filter(Boolean)
);

function textoContemTermo(texto: string, termoCanon: string): boolean {
  const cTexto = canonicalizar(texto);
  if (!cTexto || !termoCanon) return false;
  return canonicosConflituam(termoCanon, cTexto);
}

function palavraChaveTemEvidencia(termoCanon: string, fontes: Fontes): boolean {
  if (textoContemTermo(fontes.artigo.descricao, termoCanon)) return true;
  if (textoContemTermo(fontes.artigo.observacoes, termoCanon)) return true;
  if (textoContemTermo(fontes.contexto.subespecialidade, termoCanon)) return true;
  if (textoContemTermo(fontes.contexto.categoria, termoCanon)) return true;
  if (textoContemTermo(fontes.contexto.especialidade, termoCanon)) return true;
  for (const h of fontes.historico) {
    if (textoContemTermo(h.descricao, termoCanon)) return true;
  }
  for (const c of fontes.candidatos.slice(0, 20)) {
    if (c.score >= 0.35 && textoContemTermo(c.descricao, termoCanon)) return true;
  }
  // Evidência por irmãos da categoria e vocabulário já curado na sub/esp.
  // Sem isto, qualquer termo legitimamente inferido a partir do contexto
  // da família era descartado, deixando listas anémicas (3-4 palavras).
  for (const i of fontes.irmaosCategoria ?? []) {
    if (textoContemTermo(i.descricao, termoCanon)) return true;
  }
  for (const v of fontes.vocReutilizadoSub ?? []) {
    if (textoContemTermo(v, termoCanon)) return true;
  }
  for (const v of fontes.vocReutilizadoEsp ?? []) {
    if (textoContemTermo(v, termoCanon)) return true;
  }
  return false;
}

function motivoPalavraChaveFraca(t: GeneratedTermo, fontes: Fontes): string | null {
  const c = canonicalizar(t.termo);
  if (!c) return "termo vazio após normalização";
  const partes = c.split(" ").filter(Boolean);
  if (partes.length > 3) return "frase longa; deve ser expressão, não palavra-chave";
  if (PALAVRAS_CHAVE_FRACAS.has(c)) return "termo genérico de obra sem poder classificativo";
  if (partes.every((p) => tokenGenerico(p) || PALAVRAS_CHAVE_FRACAS.has(p))) {
    return "todos os componentes são genéricos";
  }
  // Limiares deliberadamente baixos: esta passagem só elimina genéricos e
  // duplicados, não estrangula o enriquecimento. A confiança é depois usada
  // pelo motor de classificação para ponderar matches.
  if (Number(t.confianca) < 40) return `confiança ${t.confianca}% demasiado baixa`;

  const temEvidencia = palavraChaveTemEvidencia(c, fontes);
  if (!temEvidencia && t.fonte === "inferido" && t.confianca < 55) {
    return "termo inferido sem evidência mínima nas fontes";
  }
  if (fontes.semHistorico && !temEvidencia && t.confianca < 55) {
    return "artigo sem histórico: termo sem evidência mínima nas fontes";
  }
  return null;
}

function melhorarPalavrasChave(gen: Generated, fontes: Fontes): { removidos: RemocaoTermo[]; movidosParaExpressoes: number } {
  const removidos: RemocaoTermo[] = [];
  let movidosParaExpressoes = 0;
  const expressoesExistentes = new Set(gen.expressoes.map((e) => canonicalizar(e.termo)).filter(Boolean));
  const palavrasBoas: GeneratedTermo[] = [];
  const vistas = new Set<string>();

  for (const t of gen.palavras_chave) {
    const c = canonicalizar(t.termo);
    const partes = c.split(" ").filter(Boolean);
    const motivo = motivoPalavraChaveFraca(t, fontes);
    if (motivo) {
      // Frases técnicas longas podem ser úteis, mas não como palavra-chave.
      if (c && partes.length >= 4 && partes.length <= 6 && t.confianca >= 60 && !expressoesExistentes.has(c)) {
        gen.expressoes.push({
          ...t,
          termo: t.termo,
          peso: Math.max(20, Math.min(60, Math.abs(t.peso || 25))),
          justificacao: t.justificacao ?? "Movida de palavra-chave para expressão por ser frase técnica.",
        });
        expressoesExistentes.add(c);
        movidosParaExpressoes++;
      }
      removidos.push({ termo: t.termo, motivo });
      continue;
    }
    if (!c || vistas.has(c)) {
      removidos.push({ termo: t.termo, motivo: "duplicado após normalização" });
      continue;
    }
    vistas.add(c);
    palavrasBoas.push({ ...t, termo: c });
  }

  gen.palavras_chave = palavrasBoas
    .sort((a, b) => (b.confianca - a.confianca) || (Math.abs(b.peso) - Math.abs(a.peso)))
    .slice(0, LIMITES.palavras_chave);
  return { removidos, movidosParaExpressoes };
}

// Garante que nenhum termo aparece em duas listas e que não há duplicados
// dentro da mesma lista (comparados pela forma canónica).
function resolverConflitos(gen: Generated): { removidosNegativos: number; removidosDup: number } {
  let removidosNegativos = 0;
  let removidosDup = 0;

  const positivos = new Set<string>();
  for (const k of ["palavras_chave", "sinonimos", "expressoes", "materiais"] as const) {
    for (const t of gen[k]) {
      const c = canonicalizar(t.termo);
      if (c) positivos.add(c);
    }
  }

  const dedup = (arr: GeneratedTermo[]): GeneratedTermo[] => {
    const seen = new Set<string>();
    const out: GeneratedTermo[] = [];
    for (const t of arr) {
      const c = canonicalizar(t.termo);
      if (!c) continue;
      if (seen.has(c)) { removidosDup++; continue; }
      seen.add(c);
      out.push(t);
    }
    return out;
  };

  gen.palavras_chave = dedup(gen.palavras_chave);
  gen.sinonimos = dedup(gen.sinonimos);
  gen.expressoes = dedup(gen.expressoes);
  gen.materiais = dedup(gen.materiais);

  const filteredNeg: GeneratedTermo[] = [];
  for (const t of gen.termos_negativos) {
    const c = canonicalizar(t.termo);
    if (!c) { continue; }
    if (positivos.has(c)) { removidosNegativos++; continue; }
    filteredNeg.push(t);
  }
  gen.termos_negativos = dedup(filteredNeg);
  return { removidosNegativos, removidosDup };
}


export type Scope =
  | { tipo: "especialidade"; especialidadeId: string }
  | { tipo: "subespecialidade"; subespecialidadeId: string }
  | { tipo: "artigo"; artigoId: string };

export type Modo = "manter" | "novos" | "regenerar";

async function listarArtigosDoScope(sb: Sb, scope: Scope): Promise<string[]> {
  if (scope.tipo === "artigo") return [scope.artigoId];
  if (scope.tipo === "subespecialidade") {
    const { data, error } = await sb
      .from("biblioteca_artigos")
      .select("id")
      .eq("subespecialidade_id", scope.subespecialidadeId)
      .eq("ativo", true);
    if (error) throw error;
    return (data ?? []).map((r) => r.id);
  }
  const { data: subs, error: subsErr } = await sb
    .from("biblioteca_subespecialidades")
    .select("id")
    .eq("especialidade_id", scope.especialidadeId);
  if (subsErr) throw subsErr;
  const subIds = (subs ?? []).map((s) => s.id);
  if (!subIds.length) return [];
  const { data, error } = await sb
    .from("biblioteca_artigos")
    .select("id")
    .in("subespecialidade_id", subIds)
    .eq("ativo", true);
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

export async function previewScope(scope: Scope) {
  const sb = admin();
  const ids = await listarArtigosDoScope(sb, scope);
  if (!ids.length) return { artigos: 0, classificacoesReais: 0, artigosSemDados: 0 };

  const { data: cls } = await sb
    .from("classificacao_artigos")
    .select("artigo_mestre_id")
    .in("artigo_mestre_id", ids)
    .in("estado", ["validado", "classificado_auto"]);

  const comDados = new Set((cls ?? []).map((r) => r.artigo_mestre_id as string));
  return {
    artigos: ids.length,
    classificacoesReais: cls?.length ?? 0,
    artigosSemDados: ids.length - comDados.size,
  };
}

type HistoricoEntry = { descricao: string; ocorrencias: number; validado: boolean };
type CandidatoEntry = { descricao: string; score: number };
type VizinhoEntry = { codigo: string; descricao: string; exemplos: string[] };

type Fontes = {
  artigo: { codigo: string; descricao: string; observacoes: string; unidade: string };
  contexto: { especialidade: string; subespecialidade: string; categoria: string };
  especialidadeId: string | null;
  subespecialidadeId: string | null;
  categoriaId: string | null;
  historico: HistoricoEntry[];
  totalHistorico: number;
  historicoValidados: number;
  historicoAuto: number;
  candidatos: CandidatoEntry[];
  totalCandidatos: number;
  vizinhos: VizinhoEntry[];
  vizinhosArtigos: number;
  irmaosCategoria: { codigo: string; descricao: string }[];
  vocReutilizadoSub: string[];
  vocReutilizadoEsp: string[];
  correcoes: string[];
  unidadesPreCalculadas: string[];
  capitulosPreCalculados: string[];
  exemplosPreCalculados: string[];
  existentes: { tipo: string; termo: string }[];
  semHistorico: boolean;
};


async function recolherFontes(sb: Sb, artigoId: string): Promise<Fontes> {
  const { data: a } = await sb
    .from("biblioteca_artigos")
    .select(
      "id, codigo, descricao, observacoes, subespecialidade_id, categoria_id, " +
        "biblioteca_subespecialidades(nome, especialidade_id, biblioteca_especialidades(nome)), " +
        "biblioteca_categorias(nome)"
    )
    .eq("id", artigoId)
    .single();

  const aAny = a as any;
  const subRel = aAny?.biblioteca_subespecialidades;
  const especialidadeNome = subRel?.biblioteca_especialidades?.nome ?? "";
  const subespecialidadeNome = subRel?.nome ?? "";
  const categoriaNome = aAny?.biblioteca_categorias?.nome ?? "";
  const subespecialidadeId = aAny?.subespecialidade_id as string | null;
  const artigoDescricao = (aAny?.descricao ?? "") as string;

  // ===== FONTE A — histórico classificado =====
  const { data: mqRaw } = await sb
    .from("classificacao_artigos")
    .select("descricao_original, estado, artigo_origem_id")
    .eq("artigo_mestre_id", artigoId)
    .in("estado", ["validado", "classificado_auto"])
    .limit(500);

  const freq = new Map<string, { count: number; validado: boolean }>();
  let historicoValidados = 0;
  let historicoAuto = 0;
  const orcArtigosJaClassificados = new Set<string>();
  for (const r of mqRaw ?? []) {
    if (r.artigo_origem_id) orcArtigosJaClassificados.add(r.artigo_origem_id as string);
    const d = (r.descricao_original ?? "").trim();
    if (!d) continue;
    const key = d.toLowerCase().replace(/\s+/g, " ").slice(0, 220);
    const isVal = (r.estado as string) === "validado";
    if (isVal) historicoValidados++;
    else historicoAuto++;
    const cur = freq.get(key);
    if (cur) {
      cur.count++;
      if (isVal) cur.validado = true;
    } else {
      freq.set(key, { count: 1, validado: isVal });
    }
  }
  const historico: HistoricoEntry[] = [...freq.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, MQ_TOP)
    .map(([descricao, v]) => ({ descricao, ocorrencias: v.count, validado: v.validado }));

  // ===== FONTE B — orçamentos brutos por similaridade textual =====
  const existentesKw = await sb
    .from("biblioteca_artigo_conhecimento")
    .select("tipo, termo")
    .eq("artigo_mestre_id", artigoId);
  const existentes = existentesKw.data ?? [];

  const tokensSet = new Set<string>();
  tokenize(artigoDescricao).forEach((t) => tokensSet.add(t));
  for (const e of existentes) {
    if (e.tipo === "palavra_chave" || e.tipo === "expressao") {
      tokenize(e.termo as string).forEach((t) => tokensSet.add(t));
    }
  }
  tokenize(subespecialidadeNome).forEach((t) => tokensSet.add(t));
  tokenize(categoriaNome).forEach((t) => tokensSet.add(t));
  const tokens = [...tokensSet].slice(0, 6);

  const brutoMap = new Map<string, { hits: number; orig: string }>();
  if (tokens.length) {
    for (const tok of tokens) {
      const { data: rows } = await sb
        .from("orcamento_artigos")
        .select("id, descricao")
        .ilike("descricao", `%${tok}%`)
        .limit(ORC_FETCH_PER_TOKEN);
      for (const r of rows ?? []) {
        if (orcArtigosJaClassificados.has(r.id as string)) continue;
        const desc = (r.descricao ?? "").trim();
        if (!desc) continue;
        const key = normalize(desc).slice(0, 220);
        const cur = brutoMap.get(key);
        if (cur) cur.hits++;
        else brutoMap.set(key, { hits: 1, orig: desc.slice(0, 220) });
      }
    }
  }
  const maxHits = Math.max(1, tokens.length);
  const candidatos: CandidatoEntry[] = [...brutoMap.values()]
    .map((v) => ({ descricao: v.orig, score: v.hits / maxHits }))
    .filter((c) => c.score >= 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATOS_TOP);

  // ===== FONTE C — artigos vizinhos =====
  const vizinhos: VizinhoEntry[] = [];
  if (subespecialidadeId) {
    const { data: vizArts } = await sb
      .from("biblioteca_artigos")
      .select("id, codigo, descricao")
      .eq("subespecialidade_id", subespecialidadeId)
      .eq("ativo", true)
      .neq("id", artigoId)
      .limit(VIZINHOS_LIMIT);
    for (const v of vizArts ?? []) {
      const { data: exs } = await sb
        .from("classificacao_artigos")
        .select("descricao_original")
        .eq("artigo_mestre_id", v.id as string)
        .in("estado", ["validado", "classificado_auto"])
        .limit(VIZINHO_EXEMPLOS);
      const exemplos = (exs ?? [])
        .map((e) => (e.descricao_original ?? "").trim())
        .filter(Boolean)
        .slice(0, VIZINHO_EXEMPLOS);
      if (exemplos.length || (v.descricao as string)) {
        vizinhos.push({
          codigo: (v.codigo as string) ?? "",
          descricao: (v.descricao as string) ?? "",
          exemplos,
        });
      }
    }
  }
  // ===== Unidade canónica do Artigo Mestre =====
  let artigoUnidade = "";
  if (aAny?.unidade_id) {
    const { data: u } = await sb
      .from("biblioteca_unidades")
      .select("codigo, simbolo")
      .eq("id", aAny.unidade_id)
      .maybeSingle();
    artigoUnidade = (u?.simbolo ?? u?.codigo ?? "") as string;
  }
  if (!artigoUnidade && aAny?.unidade) artigoUnidade = String(aAny.unidade);

  // ===== Irmãos diretos na mesma CATEGORIA (não só subesp) =====
  const irmaosCategoria: { codigo: string; descricao: string }[] = [];
  const categoriaId = (aAny?.categoria_id as string | null) ?? null;
  if (categoriaId) {
    const { data: irm } = await sb
      .from("biblioteca_artigos")
      .select("codigo, descricao")
      .eq("categoria_id", categoriaId)
      .eq("ativo", true)
      .neq("id", artigoId)
      .limit(IRMAOS_CATEGORIA_LIMIT);
    for (const r of irm ?? []) {
      irmaosCategoria.push({
        codigo: (r.codigo as string) ?? "",
        descricao: ((r.descricao as string) ?? "").slice(0, 180),
      });
    }
  }

  // ===== Vocabulário REUTILIZADO em outras fichas da mesma sub/esp =====
  const espId = (subRel?.especialidade_id as string | null) ?? null;
  const vocReutilizadoSub: string[] = [];
  const vocReutilizadoEsp: string[] = [];
  if (subespecialidadeId) {
    const { data: irmaosIds } = await sb
      .from("biblioteca_artigos")
      .select("id")
      .eq("subespecialidade_id", subespecialidadeId)
      .eq("ativo", true)
      .neq("id", artigoId);
    const ids = (irmaosIds ?? []).map((r) => r.id as string);
    if (ids.length) {
      const { data: voc } = await sb
        .from("biblioteca_artigo_conhecimento")
        .select("termo")
        .in("artigo_mestre_id", ids)
        .in("tipo", ["palavra_chave", "sinonimo", "expressao", "material"])
        .eq("ativo", true)
        .limit(VOC_REUTILIZADO_TOP * 3);
      const freqSub = new Map<string, number>();
      for (const r of voc ?? []) {
        const t = (r.termo as string).trim();
        if (!t) continue;
        freqSub.set(t, (freqSub.get(t) ?? 0) + 1);
      }
      [...freqSub.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, VOC_REUTILIZADO_TOP)
        .forEach(([t]) => vocReutilizadoSub.push(t));
    }
  }
  if (espId) {
    const { data: subsEsp } = await sb
      .from("biblioteca_subespecialidades")
      .select("id")
      .eq("especialidade_id", espId);
    const subIdsEsp = (subsEsp ?? []).map((s) => s.id as string).filter((id) => id !== subespecialidadeId);
    if (subIdsEsp.length) {
      const { data: artsEsp } = await sb
        .from("biblioteca_artigos")
        .select("id")
        .in("subespecialidade_id", subIdsEsp)
        .eq("ativo", true);
      const idsEsp = (artsEsp ?? []).map((r) => r.id as string);
      if (idsEsp.length) {
        const { data: voc } = await sb
          .from("biblioteca_artigo_conhecimento")
          .select("termo")
          .in("artigo_mestre_id", idsEsp.slice(0, 400))
          .in("tipo", ["palavra_chave", "expressao", "material"])
          .eq("ativo", true)
          .limit(VOC_REUTILIZADO_TOP * 3);
        const freqEsp = new Map<string, number>();
        for (const r of voc ?? []) {
          const t = (r.termo as string).trim();
          if (!t) continue;
          freqEsp.set(t, (freqEsp.get(t) ?? 0) + 1);
        }
        [...freqEsp.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, VOC_REUTILIZADO_TOP)
          .forEach(([t]) => vocReutilizadoEsp.push(t));
      }
    }
  }

  // ===== Correções do utilizador =====
  const correcoes: string[] = [];
  if (aAny?.codigo) {
    const { data: corrRaw } = await sb
      .from("classificacao_aprendizagem")
      .select("descricao_original")
      .eq("codigo_artigo", aAny.codigo as string)
      .limit(CORRECOES_TOP);
    for (const r of corrRaw ?? []) {
      const d = ((r as any).descricao_original ?? "").toString().trim();
      if (d) correcoes.push(d.slice(0, 200));
    }
  }

  // ===== Unidades/Capítulos/Exemplos pré-calculados =====
  const uce = await derivarUnidadesCapitulosExemplos(sb, artigoId);
  const unidadesPreCalculadas = uce.unidades.map((u) => u.termo);
  if (!unidadesPreCalculadas.length && artigoUnidade) unidadesPreCalculadas.push(artigoUnidade);
  const capitulosPreCalculados = uce.capitulos.map((c) => c.termo);
  const exemplosPreCalculados = uce.exemplos.slice(0, 15).map((e) => e.termo);

  return {
    artigo: {
      codigo: aAny?.codigo ?? "",
      descricao: artigoDescricao,
      observacoes: aAny?.observacoes ?? "",
      unidade: artigoUnidade,
    },
    contexto: { especialidade: especialidadeNome, subespecialidade: subespecialidadeNome, categoria: categoriaNome },
    especialidadeId: espId,
    subespecialidadeId: subespecialidadeId,
    categoriaId,

    historico,
    totalHistorico: mqRaw?.length ?? 0,
    historicoValidados,
    historicoAuto,
    candidatos,
    totalCandidatos: brutoMap.size,
    vizinhos,
    vizinhosArtigos: vizinhos.length,
    irmaosCategoria,
    vocReutilizadoSub,
    vocReutilizadoEsp,
    correcoes,
    unidadesPreCalculadas,
    capitulosPreCalculados,
    exemplosPreCalculados,
    existentes,
    semHistorico: (mqRaw?.length ?? 0) === 0,
  };
}

function buildPrompt(fontes: Fontes, modo: Modo) {
  const {
    artigo, contexto, historico, candidatos, vizinhos, existentes, semHistorico,
    irmaosCategoria, vocReutilizadoSub, vocReutilizadoEsp, correcoes,
    unidadesPreCalculadas, capitulosPreCalculados, exemplosPreCalculados,
  } = fontes;

  const linhasA = historico.length
    ? historico
        .map((m) => `  (${m.ocorrencias}x)${m.validado ? " [validado]" : ""} ${m.descricao}`)
        .join("\n")
    : "  (nenhuma)";

  const linhasB = candidatos.length
    ? candidatos.map((c) => `  (sim ${c.score.toFixed(2)}) ${c.descricao}`).join("\n")
    : "  (nenhuma)";

  const linhasC = vizinhos.length
    ? vizinhos
        .map((v) => {
          const ex = v.exemplos.length ? ` — exs: ${v.exemplos.slice(0, 2).join(" | ").slice(0, 180)}` : "";
          return `  • ${v.codigo} ${v.descricao}${ex}`;
        })
        .join("\n")
    : "  (nenhum)";

  const linhasD = irmaosCategoria.length
    ? irmaosCategoria.map((v) => `  • ${v.codigo} ${v.descricao}`).join("\n")
    : "  (nenhum)";

  const linhasVocSub = vocReutilizadoSub.length
    ? vocReutilizadoSub.slice(0, 50).join(" · ")
    : "(nenhum)";
  const linhasVocEsp = vocReutilizadoEsp.length
    ? vocReutilizadoEsp.slice(0, 50).join(" · ")
    : "(nenhum)";
  const linhasCorr = correcoes.length
    ? correcoes.slice(0, 30).map((c) => `  • ${c}`).join("\n")
    : "  (nenhuma)";
  const linhasUnid = unidadesPreCalculadas.length
    ? unidadesPreCalculadas.join(", ")
    : "(nenhuma observada)";
  const linhasCap = capitulosPreCalculados.length
    ? capitulosPreCalculados.map((c) => `  • ${c}`).join("\n")
    : "  (nenhum)";
  const linhasEx = exemplosPreCalculados.length
    ? exemplosPreCalculados.map((c) => `  • ${c}`).join("\n")
    : "  (nenhum)";

  const existentesTxt =
    modo === "novos" && existentes.length
      ? `\nTermos já existentes (NÃO repetir):\n${existentes
          .slice(0, 200)
          .map((e) => `- [${e.tipo}] ${e.termo}`)
          .join("\n")}`
      : "";

  const avisoSemHist = semHistorico
    ? "\n⚠ Este artigo NÃO tem histórico validado. Mesmo assim, gera enriquecimento profundo: usa a descrição, " +
      "irmãos da categoria, vocabulário reutilizado na subespecialidade e materiais técnicos plausíveis. Reduz confiança (≤ 70) mas NÃO reduzas a quantidade."
    : "";

  return `És um ENGENHEIRO ORÇAMENTISTA SÉNIOR PORTUGUÊS com décadas de experiência em construção civil.
Vais ENRIQUECER PROFUNDAMENTE um Artigo Mestre da Biblioteca Mestra, cruzando TODAS as fontes disponíveis,
como se tivesses passado vários minutos a estudar este artigo, todos os artigos irmãos, milhares de mapas
de quantidades, o caderno de encargos e o histórico real da aplicação.

REGRA-OURO: quanto mais conhecimento útil, tecnicamente correto e justificável conseguires gerar, melhor.
NÃO restrinjas artificialmente o número de termos. Listas curtas são FALHA do agente. O objetivo é cobrir
todas as variantes técnicas, sinónimos, expressões típicas de MQ portugueses, materiais (explícitos e
implícitos), unidades, capítulos e exemplos plausíveis.

ARTIGO MESTRE
- Código: ${artigo.codigo}
- Descrição: ${artigo.descricao}
- Observações: ${artigo.observacoes || "—"}
- Unidade canónica do artigo: ${artigo.unidade || "—"}

CONTEXTO ESTRUTURAL
- Especialidade: ${contexto.especialidade}
- Subespecialidade: ${contexto.subespecialidade}
- Categoria: ${contexto.categoria}

═════ FONTES ═════
FONTE A — Histórico classificado (peso ALTO, ${historico.length} entradas, ${fontes.totalHistorico} ocorrências):
${linhasA}

FONTE B — Descrições BRUTAS candidatas em orçamentos importados (peso MÉDIO, top ${candidatos.length} de ${fontes.totalCandidatos}):
${linhasB}

FONTE C — Artigos VIZINHOS na mesma subespecialidade (peso BAIXO, usar p/ diferenciação):
${linhasC}

FONTE D — Artigos IRMÃOS da MESMA CATEGORIA (terminologia exata da família):
${linhasD}

FONTE E — Vocabulário REUTILIZADO em outras fichas da MESMA SUBESPECIALIDADE (já curado pelos utilizadores):
${linhasVocSub}

FONTE F — Vocabulário REUTILIZADO noutras fichas da MESMA ESPECIALIDADE:
${linhasVocEsp}

FONTE G — CORREÇÕES feitas por utilizadores (descrições que costumam confundir-se com este artigo):
${linhasCorr}

FONTE H — Unidades já observadas para este artigo: ${linhasUnid}

FONTE I — Capítulos típicos onde este artigo apareceu:
${linhasCap}

FONTE J — Exemplos REAIS já validados para este artigo:
${linhasEx}
${existentesTxt}${avisoSemHist}

═════ OUTPUT — JSON ESTRITO, SEM MARKDOWN ═════
{
  "palavras_chave": [{"termo":"...","peso":<5..50>,"confianca":<0..100>,"fonte":"historico|candidatos|vizinhos|inferido","justificacao":"..."}],
  "sinonimos":      [{"termo":"...","peso":<5..30>,"confianca":<0..100>,"fonte":"...","justificacao":"..."}],
  "expressoes":     [{"termo":"...","peso":<10..60>,"confianca":<0..100>,"fonte":"...","justificacao":"..."}],
  "materiais":      [{"termo":"...","peso":<3..20>,"confianca":<0..100>,"fonte":"...","justificacao":"..."}],
  "unidades":       [{"termo":"m²|m³|m|ml|un|kg|ton|vg|lote|...","peso":0,"confianca":<0..100>,"fonte":"...","justificacao":"..."}],
  "capitulos":      [{"termo":"...","peso":5,"confianca":<0..100>,"fonte":"...","justificacao":"..."}],
  "exemplos":       [{"termo":"frase completa estilo MQ","peso":0,"confianca":<0..100>,"fonte":"...","justificacao":"..."}]
}

⚠ NÃO geres "termos_negativos" / "negativos". As Especialidades Excluídas e os Negativos Concorrentes
são calculados automaticamente pelo sistema. Qualquer chave nesse sentido será descartada.

QUOTAS MÍNIMAS (limite superior NÃO é uma instrução):
- palavras_chave ≥ 10 (idealmente 15-30; cobre singulares, plurais e formas curtas/longas relevantes)
- sinonimos     ≥ 5  (vocabulário pt-PT equivalente: reboco/estuque/argamassa, demolição/desmontagem/remoção…)
- expressoes    ≥ 5  (frases típicas: "fornecimento e aplicação", "incluindo transporte", "carga, transporte e vazadouro"…)
- materiais     ≥ 3  (incluindo implícitos: betão C25/30, aço A500, argamassa M5, EPS, XPS, lã mineral…)
- unidades      ≥ 1  (se vazio, devolve pelo menos a unidade canónica do artigo: "${artigo.unidade || "un"}")
- capitulos     ≥ 1  (sugere com base em Especialidade/Subespecialidade/Categoria mesmo que o histórico esteja vazio)
- exemplos      ≥ 3  (frases reais ou plausíveis ao estilo dos MQ portugueses)

REGRAS DE PALAVRAS-CHAVE
- 1 a 3 palavras. Se for 4+, vai para "expressoes".
- NÃO gerar genéricos: fornecimento, aplicação, execução, trabalhos, serviço, obra, material, equipamento, sistema, tipo, diversos, incluindo, necessário, completo, existente, novo.
- Inclui singulares E plurais relevantes quando ambos forem usados na prática (ex.: "parede", "paredes"; "tubo", "tubos").
- Peso: 40-50 para termo central recorrente; 25-39 para termo técnico forte; 10-24 para auxiliar.

REGRAS DE EXPRESSÕES
- Frases de 2 a 6 palavras, técnicas, típicas de MQ. Ex.: "fornecimento e aplicação", "carga, transporte e vazadouro a vazadouro autorizado", "acabamento areado fino", "betonagem por bomba", "incluindo cofragem e escoramento", "pronto a pintar", "fabricado em central".

REGRAS DE MATERIAIS
- Inclui materiais EXPLÍCITOS na descrição E materiais IMPLÍCITOS típicos da técnica (ex.: para reboco interior incluir cimento, areia, cal hidráulica, rede de fibra; para pavimento cerâmico incluir cimento-cola, betumação, junta).
- Quando aplicável, especifica classes/grades portuguesas: betão C25/30, aço A500NR, argamassa M5/M10, EPS λ=0.036, lã mineral 40mm.

REGRAS DE UNIDADES
- Devolve TODAS as unidades plausíveis para este tipo de artigo. Codifica como símbolo curto pt-PT: m², m³, m, ml, un, kg, ton, vg, lote, conjunto, h, dia.
- Se a unidade canónica do artigo for "${artigo.unidade || "—"}", inclui-a sempre como primeira.

REGRAS DE CAPÍTULOS
- Sugere o capítulo provável de MQ onde este artigo aparece (ex.: "Movimento de terras", "Estruturas em betão armado", "Revestimentos interiores", "Cobertura", "Águas e esgotos"). NÃO devolves lista vazia.

REGRAS DE EXEMPLOS
- Frases completas no estilo dos MQ portugueses. Mistura exemplos reais das FONTES com variantes plausíveis que cobrem casos típicos (interior/exterior, diferentes dimensões, com/sem transporte, etc.).

REGRAS DE CONFIANÇA POR FONTE
- "historico" → 80-95 (95 se for [validado])
- "candidatos" → 55-80
- "vizinhos" → 40-65
- "inferido" → 50-75 (terminologia técnica generalizada)

REGRAS DE IDIOMA — PORTUGUÊS DE PORTUGAL (OBRIGATÓRIO E NÃO NEGOCIÁVEL)
- Tudo em pt-PT. Proibido pt-BR, inglês ou mistura.
- Normalização: concreto→betão · concretagem→betonagem · laje de concreto→laje de betão · tubulação→tubagem · contrapiso→camada de regularização · piso cerâmico→pavimento cerâmico · rejunte→betumação · argamassa colante→cimento-cola · esquadria→caixilharia · forro de gesso→teto falso em gesso cartonado · chapisco→salpico · emboço→reboco de regularização · meio-fio→lancil · calçada→passeio · prefeitura→câmara municipal.
- Termos só-BR sem equivalente (ex.: tijolo baiano, cobogó) → ignora.
- Sem anglicismos: usa "confiança", "geração", "guardar", "eliminar".

REGRAS GERAIS
- Minúsculas, sem pontuação supérflua.
- Nunca repitas o MESMO termo (mesma raiz singular/plural) em listas diferentes.
- "fonte" obrigatório.
- "justificacao" ≤ 160 caracteres, pt-PT.
- Devolve APENAS o JSON, sem comentários, sem markdown.`;
}


// ============================================================
// Camada de normalização linguística pt-BR → pt-PT
// Garante que nenhum termo brasileiro entra na Biblioteca Mestra,
// mesmo que a IA falhe em seguir as regras do prompt.
// ============================================================

const PTBR_TO_PTPT: Array<[RegExp, string]> = [
  [/\bconcreto\s+armado\b/gi, "betão armado"],
  [/\bconcreto\s+magro\b/gi, "betão de limpeza"],
  [/\blaje\s+de\s+concreto\b/gi, "laje de betão"],
  [/\balvenaria\s+de\s+concreto\b/gi, "alvenaria de blocos de betão"],
  [/\bbloco(s)?\s+de\s+concreto\b/gi, "bloco de betão"],
  [/\bconcretagem\b/gi, "betonagem"],
  [/\bconcreto\b/gi, "betão"],
  [/\btubula[cç][aã]o\b/gi, "tubagem"],
  [/\bcontrapiso\b/gi, "camada de regularização"],
  [/\bpiso\s+cer[aâ]mico\b/gi, "pavimento cerâmico"],
  [/\bargamassa\s+colante\b/gi, "cimento-cola"],
  [/\brejunte\b/gi, "betumação de juntas"],
  [/\besquadria(s)?\b/gi, "caixilharia"],
  [/\bforro\s+de\s+gesso\b/gi, "teto falso em gesso cartonado"],
  [/\bchapisco\b/gi, "salpico"],
  [/\bembo[cç]o\b/gi, "reboco de regularização"],
  [/\bmeio[-\s]?fio\b/gi, "lancil"],
  [/\bcal[cç]ada\b/gi, "passeio"],
  [/\bprefeitura\b/gi, "câmara municipal"],
  [/\bforma(s)?\s+(de\s+madeira|met[aá]lica|para\s+concreto|para\s+bet[aã]o)\b/gi, "cofragem"],
];

// Termos exclusivamente brasileiros sem equivalente em Portugal → REJEITAR.
const PTBR_EXCLUSIVOS: RegExp[] = [
  /\btijolo\s+baiano\b/i,
  /\bcobog[oó]\b/i,
];

// Padrões inequivocamente estrangeiros (pt-BR ou inglês) → REJEITAR.
const TERMO_ESTRANGEIRO: RegExp[] = [
  /\bvoc[eê]s?\b/i,
  /\b(building|knowledge|score|update|deploy|workflow)\b/i,
];

function normalizarTextoPtPt(s: string): { texto: string; alterado: boolean } {
  if (!s) return { texto: s, alterado: false };
  let out = s;
  for (const [re, sub] of PTBR_TO_PTPT) out = out.replace(re, sub);
  return { texto: out, alterado: out !== s };
}

function termoRejeitado(s: string): boolean {
  if (!s || !s.trim()) return true;
  for (const re of PTBR_EXCLUSIVOS) if (re.test(s)) return true;
  for (const re of TERMO_ESTRANGEIRO) if (re.test(s)) return true;
  return false;
}

type NormStats = { rejeitados: number; convertidos: number; rejeitadosTermos: string[] };

function normalizarGenerated(gen: Generated): NormStats {
  const stats: NormStats = { rejeitados: 0, convertidos: 0, rejeitadosTermos: [] };
  const sinonimosExtra: GeneratedTermo[] = [];

  const aplicar = (arr: GeneratedTermo[]): GeneratedTermo[] => {
    const out: GeneratedTermo[] = [];
    const vistos = new Set<string>();
    for (const t of arr) {
      if (termoRejeitado(t.termo)) {
        stats.rejeitados++;
        if (stats.rejeitadosTermos.length < 20) stats.rejeitadosTermos.push(t.termo);
        continue;
      }
      const { texto, alterado } = normalizarTextoPtPt(t.termo);
      const just = t.justificacao ? normalizarTextoPtPt(t.justificacao).texto : t.justificacao;
      const principal: GeneratedTermo = { ...t, termo: texto, justificacao: just };
      const key = texto.toLowerCase().trim();
      if (!vistos.has(key) && !termoRejeitado(texto)) {
        vistos.add(key);
        out.push(principal);
      }
      if (alterado) {
        stats.convertidos++;
        sinonimosExtra.push({
          termo: t.termo,
          peso: 8,
          confianca: 50,
          justificacao: "Forma pt-BR registada como sinónimo para reconhecimento de descrições importadas.",
          fonte: t.fonte ?? "inferido",
        });
      }
    }
    return out;
  };

  gen.palavras_chave = aplicar(gen.palavras_chave);
  gen.expressoes = aplicar(gen.expressoes);
  gen.materiais = aplicar(gen.materiais);
  gen.unidades = aplicar(gen.unidades);
  gen.capitulos = aplicar(gen.capitulos);
  gen.exemplos = aplicar(gen.exemplos);
  gen.termos_negativos = aplicar(gen.termos_negativos);
  gen.sinonimos = aplicar([...gen.sinonimos, ...sinonimosExtra]);
  return stats;
}


function parseJsonLoose(raw: string): any {
  if (!raw) return {};
  // Strip markdown fences ```json ... ``` or ``` ... ```
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    /* fallthrough */
  }
  // Walk chars, respecting strings/escapes, to find the first balanced JSON object.
  const start = s.indexOf("{");
  if (start < 0) return {};
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = false; }
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = s.slice(start, i + 1);
        try { return JSON.parse(candidate); } catch { return {}; }
      }
    }
  }
  return {};
}

async function callAI(prompt: string): Promise<Generated> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY em falta");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Devolve apenas JSON válido. Sem markdown, sem texto antes ou depois do objeto JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 16000,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`IA ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const json = await resp.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "{}";
  const parsed = parseJsonLoose(content);
  const validFontes: FonteOrigem[] = ["historico", "candidatos", "vizinhos", "inferido"];
  const normCom = (arr: any, limite: number): GeneratedTermo[] =>
    Array.isArray(arr)
      ? arr
          .map((x) => {
            const fonteRaw = String(x?.fonte ?? "inferido").toLowerCase();
            const fonte: FonteOrigem = (validFontes as string[]).includes(fonteRaw)
              ? (fonteRaw as FonteOrigem)
              : "inferido";
            return {
              termo: String(x?.termo ?? "").trim(),
              peso: Math.round(Number(x?.peso) || 0),
              confianca: Math.max(0, Math.min(100, Math.round(Number(x?.confianca) || 60))),
              justificacao: x?.justificacao ? String(x.justificacao).trim().slice(0, 240) : undefined,
              fonte,
            };
          })
          .filter((x) => x.termo.length > 0)
          .slice(0, limite)
      : [];
  return {
    palavras_chave: normCom(parsed.palavras_chave, LIMITES.palavras_chave),
    sinonimos: normCom(parsed.sinonimos, LIMITES.sinonimos),
    expressoes: normCom(parsed.expressoes, LIMITES.expressoes),
    materiais: normCom(parsed.materiais, LIMITES.materiais),
    unidades: normCom(parsed.unidades, LIMITES.unidades),
    capitulos: normCom(parsed.capitulos, LIMITES.capitulos),
    exemplos: normCom(parsed.exemplos, LIMITES.exemplos),
    // Negativos NUNCA vêm da IA — são derivados automaticamente pelo sistema.
    termos_negativos: [],
  };
}


type PersistResult = { inseridos: number; perTipo: Record<string, number>; novosIds: string[] };

function calcOcorrenciasEExemplos(
  termo: string,
  historico: HistoricoEntry[],
  candidatos: CandidatoEntry[]
): { ocorrencias: number; exemplos: string[] } {
  const t = normalize(termo);
  if (!t) return { ocorrencias: 0, exemplos: [] };
  let oc = 0;
  const ex: string[] = [];
  for (const h of historico) {
    if (normalize(h.descricao).includes(t)) {
      oc += h.ocorrencias;
      if (ex.length < 3) ex.push(`[hist] ${h.descricao.slice(0, 160)}`);
    }
  }
  for (const c of candidatos) {
    if (ex.length >= 3) break;
    if (normalize(c.descricao).includes(t)) {
      ex.push(`[cand] ${c.descricao.slice(0, 160)}`);
    }
  }
  return { ocorrencias: oc, exemplos: ex };
}

async function persistir(
  sb: Sb,
  artigoId: string,
  gen: Generated,
  modo: Modo,
  fontes: Fontes
): Promise<PersistResult> {
  if (modo === "regenerar") {
    await sb
      .from("biblioteca_artigo_conhecimento")
      .delete()
      .eq("artigo_mestre_id", artigoId)
      .in("origem", ["ia", "mapas_quantidades", "orcamentos_brutos", "artigos_vizinhos"]);
  }

  const { data: existentes } = await sb
    .from("biblioteca_artigo_conhecimento")
    .select("tipo, termo")
    .eq("artigo_mestre_id", artigoId);
  const setExist = new Set(
    (existentes ?? []).map((e) => `${e.tipo}::${e.termo.toLowerCase()}`)
  );

  const rows: any[] = [];
  const perTipo: Record<string, number> = {
    palavra_chave: 0, sinonimo: 0, expressao: 0, material: 0,
    negativo_incompativel: 0, negativo_concorrente: 0,
    unidade_compativel: 0, capitulo_tipico: 0, exemplo_real: 0,
  };

  for (const k of Object.keys(TIPO_MAP) as (keyof typeof TIPO_MAP)[]) {
    const meta = TIPO_MAP[k];
    for (const t of gen[k]) {
      const key = `${meta.tipo}::${t.termo.toLowerCase()}`;
      if (setExist.has(key)) continue;
      setExist.add(key);
      const pesoBruto = Number.isFinite(t.peso) ? t.peso : meta.pesoDefault;
      const pesoFinal = pesoBruto === 0 ? 0 : (meta.sign < 0 ? -Math.abs(pesoBruto) : Math.abs(pesoBruto));
      const { ocorrencias, exemplos } = calcOcorrenciasEExemplos(t.termo, fontes.historico, fontes.candidatos);
      // Prefer reported fonte; auto-promote to historico if termo really aparece no histórico.
      let fonte: FonteOrigem = t.fonte ?? "inferido";
      if (ocorrencias > 0 && fonte === "inferido") fonte = "historico";
      const origem = FONTE_TO_ORIGEM[fonte];
      rows.push({
        artigo_mestre_id: artigoId,
        tipo: meta.tipo,
        termo: t.termo,
        peso: pesoFinal,
        confianca: t.confianca,
        origem,
        ativo: true,
        ocorrencias,
        justificacao: t.justificacao ?? null,
        exemplos,
      });
      perTipo[meta.tipo]++;
    }
  }

  let novosIds: string[] = [];
  if (rows.length) {
    const { data: ins, error } = await sb
      .from("biblioteca_artigo_conhecimento")
      .insert(rows)
      .select("id");
    if (error) throw error;
    novosIds = (ins ?? []).map((r) => r.id as string);
  }
  return { inseridos: rows.length, perTipo, novosIds };
}

async function appendLog(sb: Sb, runId: string, msg: string) {
  const { data } = await sb
    .from("biblioteca_knowledge_run")
    .select("log")
    .eq("id", runId)
    .single();
  const log: any[] = ((data?.log as any) ?? []).slice(-49);
  log.push({ ts: new Date().toISOString(), msg });
  await sb.from("biblioteca_knowledge_run").update({ log }).eq("id", runId);
}

type ArtigoRun = {
  id: string;
  codigo: string;
  descricao: string;
  especialidade?: string;
  subespecialidade?: string;
  categoria?: string;
  novosIds: string[];
  falhou: boolean;
  erro?: string | null;
  fontes?: Fontes;
};

type AntesSnap = {
  perTipo: Record<string, { count: number; somaPeso: number; somaPesoConf: number }>;
  confiancaGlobal: number;
  total: number;
};

async function snapshotArtigo(sb: Sb, artigoId: string): Promise<AntesSnap> {
  const { data: prev } = await sb
    .from("biblioteca_artigo_conhecimento")
    .select("tipo, peso, confianca")
    .eq("artigo_mestre_id", artigoId)
    .eq("ativo", true);
  const snap: AntesSnap = { perTipo: {}, confiancaGlobal: 0, total: (prev ?? []).length };
  let sp = 0, spc = 0;
  for (const r of prev ?? []) {
    const t = r.tipo as string;
    const p = Math.abs(Number(r.peso) || 0);
    const c = Number(r.confianca) || 0;
    if (!snap.perTipo[t]) snap.perTipo[t] = { count: 0, somaPeso: 0, somaPesoConf: 0 };
    snap.perTipo[t].count++;
    snap.perTipo[t].somaPeso += p;
    snap.perTipo[t].somaPesoConf += p * c;
    sp += p;
    spc += p * c;
  }
  snap.confiancaGlobal = sp > 0 ? Math.round(spc / sp) : 0;
  return snap;
}

// ============================================================
// Derivadores das novas secções de conhecimento
// (concorrentes, unidades, capítulos, exemplos reais)
// ============================================================

type Extras = {
  concorrentes: GeneratedTermo[];
  incompativeis: GeneratedTermo[];
  unidades: GeneratedTermo[];
  capitulos: GeneratedTermo[];
  exemplos: GeneratedTermo[];
};

// Termos de artigos irmãos da mesma especialidade que ajudam a distinguir
// este artigo dos seus concorrentes diretos. NÃO eliminam — apenas penalizam
// candidaturas confundíveis.
async function derivarConcorrentes(
  sb: Sb,
  artigoId: string,
  artigoEspId: string | null,
  artigoSubespId: string | null,
  ancoras: Set<string>
): Promise<GeneratedTermo[]> {
  if (!artigoEspId) return [];

  const { data: subs } = await sb
    .from("biblioteca_subespecialidades")
    .select("id")
    .eq("especialidade_id", artigoEspId);
  const subIds = (subs ?? []).map((s) => s.id as string);
  if (!subIds.length) return [];

  const { data: irmaos } = await sb
    .from("biblioteca_artigos")
    .select("id, descricao, subespecialidade_id")
    .in("subespecialidade_id", subIds)
    .eq("ativo", true)
    .neq("id", artigoId)
    .limit(1000);

  const freq = new Map<string, { count: number; mesmoSub: number }>();
  for (const r of irmaos ?? []) {
    const mesmoSub = r.subespecialidade_id === artigoSubespId;
    const tokens = new Set<string>();
    for (const tok of tokenize((r.descricao as string) ?? "")) {
      const c = lemaSingular(tok);
      if (!c || tokenGenerico(c)) continue;
      if (ancoras.has(c)) continue;
      tokens.add(c);
    }
    for (const t of tokens) {
      const cur = freq.get(t) ?? { count: 0, mesmoSub: 0 };
      cur.count++;
      if (mesmoSub) cur.mesmoSub++;
      freq.set(t, cur);
    }
  }

  return [...freq.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([termo, v]) => ({
      termo,
      peso: -15,
      confianca: Math.min(95, 55 + v.count * 3 + v.mesmoSub * 5),
      justificacao:
        `Aparece em ${v.count} artigo(s) irmãos da mesma especialidade` +
        (v.mesmoSub ? ` (${v.mesmoSub} na mesma subespecialidade)` : "") +
        ` e não em "${[...ancoras].slice(0, 3).join(", ")}".`,
      fonte: "vizinhos" as const,
    }))
    .sort((a, b) => b.confianca - a.confianca)
    .slice(0, 10);
}

// Unidades, capítulos e exemplos a partir do histórico real classificado.
async function derivarUnidadesCapitulosExemplos(
  sb: Sb,
  artigoId: string
): Promise<{ unidades: GeneratedTermo[]; capitulos: GeneratedTermo[]; exemplos: GeneratedTermo[] }> {
  const { data: cls } = await sb
    .from("classificacao_artigos")
    .select("descricao_original, unidade_original, artigo_origem_id, estado")
    .eq("artigo_mestre_id", artigoId)
    .in("estado", ["validado", "classificado_auto"])
    .limit(500);

  const linhas = cls ?? [];
  if (!linhas.length) return { unidades: [], capitulos: [], exemplos: [] };

  // -------- Unidades --------
  const unidadeFreq = new Map<string, { count: number; validados: number }>();
  let totalUnid = 0;
  for (const r of linhas) {
    const u = ((r.unidade_original as string) ?? "").trim().toLowerCase();
    if (!u) continue;
    totalUnid++;
    const cur = unidadeFreq.get(u) ?? { count: 0, validados: 0 };
    cur.count++;
    if (r.estado === "validado") cur.validados++;
    unidadeFreq.set(u, cur);
  }
  const unidades: GeneratedTermo[] = [...unidadeFreq.entries()]
    .map(([termo, v]) => ({
      termo,
      pct: totalUnid > 0 ? v.count / totalUnid : 0,
      conf: Math.round(Math.min(99, 60 + v.validados * 3 + v.count * 1.5)),
      count: v.count,
    }))
    .filter((u) => u.pct >= 0.05 || u.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((u) => ({
      termo: u.termo,
      peso: 0,
      confianca: u.conf,
      justificacao: `Usada em ${u.count} classificação(ões) reais deste artigo (${Math.round(u.pct * 100)}%).`,
      fonte: "historico" as const,
    }));

  // -------- Capítulos --------
  const orcIds = [...new Set(linhas.map((r) => r.artigo_origem_id as string).filter(Boolean))];
  let capitulos: GeneratedTermo[] = [];
  if (orcIds.length) {
    const { data: orcArts } = await sb
      .from("orcamento_artigos")
      .select("id, capitulo_id")
      .in("id", orcIds);
    const capIds = [...new Set((orcArts ?? []).map((r) => r.capitulo_id as string).filter(Boolean))];
    if (capIds.length) {
      const { data: caps } = await sb
        .from("orcamento_capitulos")
        .select("id, descricao")
        .in("id", capIds);
      const capById = new Map<string, string>((caps ?? []).map((c) => [c.id as string, (c.descricao as string) ?? ""]));
      const capFreq = new Map<string, number>();
      for (const o of orcArts ?? []) {
        const desc = capById.get(o.capitulo_id as string) ?? "";
        if (!desc) continue;
        const k = desc.trim().slice(0, 120);
        if (!k) continue;
        capFreq.set(k, (capFreq.get(k) ?? 0) + 1);
      }
      capitulos = [...capFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([termo, n]) => ({
          termo,
          peso: 5,
          confianca: Math.min(95, 55 + n * 4),
          justificacao: `Aparece em ${n} capítulo(s) de orçamento como contexto deste artigo.`,
          fonte: "historico" as const,
        }));
    }
  }

  // -------- Exemplos reais --------
  const exMap = new Map<string, { count: number; validado: boolean }>();
  for (const r of linhas) {
    const d = ((r.descricao_original as string) ?? "").trim();
    if (!d || d.length < 8) continue;
    const key = normalize(d).slice(0, 220);
    const cur = exMap.get(key) ?? { count: 0, validado: false };
    cur.count++;
    if (r.estado === "validado") cur.validado = true;
    exMap.set(key, cur);
    // guardar versão original no termo do primeiro encontro
    if (cur.count === 1) (cur as any).orig = d.slice(0, 240);
  }
  const exemplos: GeneratedTermo[] = [...exMap.entries()]
    .sort((a, b) => (Number(b[1].validado) - Number(a[1].validado)) || (b[1].count - a[1].count))
    .slice(0, 50)
    .map(([, v]) => ({
      termo: ((v as any).orig as string) ?? "",
      peso: 0,
      confianca: v.validado ? 95 : 75,
      justificacao: v.validado
        ? `Exemplo validado por utilizador (${v.count}x).`
        : `Exemplo auto-classificado (${v.count}x).`,
      fonte: "historico" as const,
    }))
    .filter((e) => e.termo);

  return { unidades, capitulos, exemplos };
}

// Especialidades excluídas: termos centrais (palavras-chave/materiais curados)
// que aparecem APENAS noutras especialidades. Geram penalização forte e podem
// eliminar candidatos confundíveis entre especialidades distintas.
async function derivarIncompatibilidades(
  sb: Sb,
  artigoEspId: string | null,
  ancoras: Set<string>
): Promise<GeneratedTermo[]> {
  if (!artigoEspId) return [];

  // 1) IDs das subespecialidades da MESMA especialidade (proibido marcar como excluído)
  const { data: subsMesma } = await sb
    .from("biblioteca_subespecialidades")
    .select("id")
    .eq("especialidade_id", artigoEspId);
  const subIdsMesma = new Set((subsMesma ?? []).map((s) => s.id as string));

  // 2) IDs de artigos da MESMA especialidade
  const { data: artsMesma } = await sb
    .from("biblioteca_artigos")
    .select("id")
    .in("subespecialidade_id", [...subIdsMesma])
    .eq("ativo", true);
  const artigosMesmaEsp = new Set((artsMesma ?? []).map((r) => r.id as string));

  // 3) Termos curados da MESMA especialidade (devem ficar de fora dos excluídos)
  const termosMesma = new Set<string>();
  if (artigosMesmaEsp.size) {
    const { data } = await sb
      .from("biblioteca_artigo_conhecimento")
      .select("termo")
      .in("artigo_mestre_id", [...artigosMesmaEsp].slice(0, 500))
      .in("tipo", ["palavra_chave", "expressao", "material", "sinonimo"])
      .eq("ativo", true)
      .limit(5000);
    for (const r of data ?? []) {
      const c = lemaSingular((r.termo as string).trim().toLowerCase());
      if (c) termosMesma.add(c);
    }
  }

  // 4) Termos curados das OUTRAS especialidades
  const { data: outrosArts } = await sb
    .from("biblioteca_artigos")
    .select("id, subespecialidade_id, biblioteca_subespecialidades(especialidade_id)")
    .eq("ativo", true)
    .limit(8000);
  const outrosIds: string[] = [];
  const espPorArtigo = new Map<string, string>();
  for (const r of (outrosArts ?? []) as any[]) {
    const espId = r.biblioteca_subespecialidades?.especialidade_id as string | undefined;
    if (!espId || espId === artigoEspId) continue;
    outrosIds.push(r.id as string);
    espPorArtigo.set(r.id as string, espId);
  }
  if (!outrosIds.length) return [];

  const { data: termosOutros } = await sb
    .from("biblioteca_artigo_conhecimento")
    .select("artigo_mestre_id, termo, tipo")
    .in("artigo_mestre_id", outrosIds.slice(0, 800))
    .in("tipo", ["palavra_chave", "expressao", "material"])
    .eq("ativo", true)
    .limit(8000);

  const freq = new Map<string, { count: number; esps: Set<string> }>();
  for (const r of termosOutros ?? []) {
    const raw = (r.termo as string).trim().toLowerCase();
    if (!raw) continue;
    const c = r.tipo === "expressao" ? raw : lemaSingular(raw);
    if (!c || tokenGenerico(c)) continue;
    if (termosMesma.has(c)) continue;
    if (ancoras.has(c)) continue;
    const espId = espPorArtigo.get(r.artigo_mestre_id as string) ?? "";
    const cur = freq.get(c) ?? { count: 0, esps: new Set() };
    cur.count++;
    if (espId) cur.esps.add(espId);
    freq.set(c, cur);
  }

  return [...freq.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([termo, v]) => ({
      termo,
      peso: -60,
      confianca: Math.min(95, 60 + v.count * 2),
      justificacao: `Termo central de ${v.esps.size} outra(s) especialidade(s), ausente desta. Penaliza fortemente candidatos cruzados.`,
      fonte: "vizinhos" as const,
    }))
    .sort((a, b) => b.confianca - a.confianca)
    .slice(0, 60);
}

async function gravarExtras(
  sb: Sb,
  artigoId: string,
  extras: Extras,
  modo: Modo
): Promise<Record<string, number>> {
  const perTipo: Record<string, number> = {
    negativo_concorrente: 0, negativo_incompativel: 0,
    unidade_compativel: 0, capitulo_tipico: 0, exemplo_real: 0,
  };
  const tiposNovos = ["negativo_concorrente", "negativo_incompativel", "unidade_compativel", "capitulo_tipico", "exemplo_real"];

  if (modo === "regenerar") {
    await sb
      .from("biblioteca_artigo_conhecimento")
      .delete()
      .eq("artigo_mestre_id", artigoId)
      .in("tipo", tiposNovos as any)
      .in("origem", ["ia", "mapas_quantidades", "orcamentos_brutos", "artigos_vizinhos"]);
  }

  const { data: existentes } = await sb
    .from("biblioteca_artigo_conhecimento")
    .select("tipo, termo")
    .eq("artigo_mestre_id", artigoId)
    .in("tipo", tiposNovos as any);
  const setExist = new Set((existentes ?? []).map((e) => `${e.tipo}::${(e.termo as string).toLowerCase()}`));

  const rows: any[] = [];
  const push = (tipo: string, t: GeneratedTermo, origem: "mapas_quantidades" | "artigos_vizinhos" | "ia") => {
    if (!t.termo) return;
    const key = `${tipo}::${t.termo.toLowerCase()}`;
    if (setExist.has(key)) return;
    setExist.add(key);
    rows.push({
      artigo_mestre_id: artigoId,
      tipo,
      termo: t.termo,
      peso: t.peso,
      confianca: t.confianca,
      origem,
      ativo: true,
      ocorrencias: 0,
      justificacao: t.justificacao ?? null,
      exemplos: [],
    });
    perTipo[tipo]++;
  };

  for (const t of extras.concorrentes) push("negativo_concorrente", t, "artigos_vizinhos");
  for (const t of extras.incompativeis) push("negativo_incompativel", t, "artigos_vizinhos");
  for (const t of extras.unidades) push("unidade_compativel", t, t.fonte === "historico" ? "mapas_quantidades" : "ia");
  for (const t of extras.capitulos) push("capitulo_tipico", t, t.fonte === "historico" ? "mapas_quantidades" : "ia");
  for (const t of extras.exemplos) push("exemplo_real", t, t.fonte === "historico" ? "mapas_quantidades" : "ia");

  if (rows.length) {
    const { error } = await sb.from("biblioteca_artigo_conhecimento").insert(rows);
    if (error) throw error;
  }
  return perTipo;
}



export async function processRun(runId: string) {
  const sb = admin();
  try {
    const { data: run, error } = await sb
      .from("biblioteca_knowledge_run")
      .select("*")
      .eq("id", runId)
      .single();
    if (error || !run) throw error ?? new Error("Run não encontrada");

    const scope: Scope =
      run.scope_tipo === "especialidade"
        ? { tipo: "especialidade", especialidadeId: (run.scope_ids as any).especialidadeId }
        : run.scope_tipo === "subespecialidade"
        ? { tipo: "subespecialidade", subespecialidadeId: (run.scope_ids as any).subespecialidadeId }
        : { tipo: "artigo", artigoId: (run.scope_ids as any).artigoId };

    const ids = await listarArtigosDoScope(sb, scope);

    await sb
      .from("biblioteca_knowledge_run")
      .update({ estado: "em_curso", total_artigos: ids.length })
      .eq("id", runId);
    await appendLog(sb, runId, `Início: ${ids.length} artigos no âmbito`);

    // Limpeza inicial universal: apaga negativos antigos que sejam genéricos
    // ou que conflituem com vocabulário positivo/contexto do próprio artigo.
    try {
      const { data: antigos } = await sb
        .from("biblioteca_artigo_conhecimento")
        .select("id, termo, artigo_mestre_id")
        .eq("tipo", "termo_negativo");

      const artIds = Array.from(new Set((antigos ?? []).map((r) => r.artigo_mestre_id as string)));
      const positivosPorArtigo = new Map<string, Set<string>>();
      const addPositivoAntigo = (artigoId: string, texto: string) => {
        let set = positivosPorArtigo.get(artigoId);
        if (!set) { set = new Set(); positivosPorArtigo.set(artigoId, set); }
        for (const c of canonicosComTokens(texto)) set.add(c);
      };
      if (artIds.length) {
        const { data: artsCtx } = await sb
          .from("biblioteca_artigos")
          .select("id, descricao, observacoes, biblioteca_subespecialidades(nome, biblioteca_especialidades(nome)), biblioteca_categorias(nome)")
          .in("id", artIds);
        for (const r of (artsCtx ?? []) as any[]) {
          const nomeEsp = r?.biblioteca_subespecialidades?.biblioteca_especialidades?.nome ?? "";
          const nomeSub = r?.biblioteca_subespecialidades?.nome ?? "";
          const nomeCat = r?.biblioteca_categorias?.nome ?? "";
          addPositivoAntigo(r.id as string, r?.descricao ?? "");
          addPositivoAntigo(r.id as string, r?.observacoes ?? "");
          addPositivoAntigo(r.id as string, nomeEsp);
          addPositivoAntigo(r.id as string, nomeSub);
          addPositivoAntigo(r.id as string, nomeCat);
        }
        const { data: positivosAntigos } = await sb
          .from("biblioteca_artigo_conhecimento")
          .select("artigo_mestre_id, tipo, termo")
          .in("artigo_mestre_id", artIds)
          .in("tipo", ["palavra_chave", "sinonimo", "expressao", "material"]);
        for (const r of positivosAntigos ?? []) {
          addPositivoAntigo(r.artigo_mestre_id as string, r.termo as string);
        }
      }

      let removidosConflito = 0;
      let removidosGenericos = 0;
      const aRemover = (antigos ?? []).filter((r) => {
        const c = canonicalizar((r.termo as string) ?? "");
        if (!c) return false;
        if (tokenGenerico(c)) { removidosGenericos++; return true; }
        if (setTemConflito(c, positivosPorArtigo.get(r.artigo_mestre_id as string) ?? new Set())) {
          removidosConflito++;
          return true;
        }
        return false;
      }).map((r) => r.id as string);
      if (aRemover.length) {
        await sb.from("biblioteca_artigo_conhecimento").delete().in("id", aRemover);
        await appendLog(sb, runId, `Limpeza: removidos ${aRemover.length} negativos antigos inválidos`);
        if (removidosGenericos > 0) await appendLog(sb, runId, `Limpeza: negativos removidos por serem genéricos: ${removidosGenericos}`);
        if (removidosConflito > 0) await appendLog(sb, runId, `Limpeza: negativos removidos por conflito com positivos/contexto do artigo: ${removidosConflito}`);
      }

    } catch (e: any) {
      await appendLog(sb, runId, `Limpeza falhou (ignorado): ${e?.message ?? e}`);
    }

    // (Índice estatístico inter-especialidades descontinuado: as Especialidades
    // Excluídas e Negativos Concorrentes são agora derivados directamente da
    // Biblioteca Mestra curada, sem necessidade de pré-índice.)


    const counts: Record<string, number> = {
      palavra_chave: 0, sinonimo: 0, expressao: 0, material: 0,
      negativo_incompativel: 0, negativo_concorrente: 0,
      unidade_compativel: 0, capitulo_tipico: 0, exemplo_real: 0,
    };
    const fontesAgg = {
      historico_total: 0,
      historico_validado: 0,
      historico_auto: 0,
      historico_descricoes_unicas: 0,
      candidatos_brutos: 0,
      vizinhos_artigos: 0,
      vizinhos_exemplos: 0,
      correcoes_total: 0,
    };
    let processados = 0;
    let saltados = 0;
    let falhados = 0;
    let ultimoErro: string | null = null;
    let semHistoricoGlobal = true;

    const antesPorArtigo = new Map<string, AntesSnap>();
    const artigosRuns = new Map<string, ArtigoRun>();

    for (const artigoId of ids) {
      antesPorArtigo.set(artigoId, await snapshotArtigo(sb, artigoId));
    }

    for (const artigoId of ids) {
      const { data: chk } = await sb
        .from("biblioteca_knowledge_run")
        .select("cancelar")
        .eq("id", runId)
        .single();
      if (chk?.cancelar) {
        await appendLog(sb, runId, "Cancelado pelo utilizador");
        await sb
          .from("biblioteca_knowledge_run")
          .update({ estado: "cancelado", concluido_em: new Date().toISOString() })
          .eq("id", runId);
        return;
      }

      try {
        if (run.modo === "manter") {
          const { count } = await sb
            .from("biblioteca_artigo_conhecimento")
            .select("id", { count: "exact", head: true })
            .eq("artigo_mestre_id", artigoId);
          if ((count ?? 0) > 0) {
            saltados++;
            processados++;
            await sb
              .from("biblioteca_knowledge_run")
              .update({ processados, saltados })
              .eq("id", runId);
            continue;
          }
        }

        const fontes = await recolherFontes(sb, artigoId);
        if (!fontes.semHistorico) semHistoricoGlobal = false;
        fontesAgg.historico_total += fontes.totalHistorico;
        fontesAgg.historico_validado += fontes.historicoValidados;
        fontesAgg.historico_auto += fontes.historicoAuto;
        fontesAgg.historico_descricoes_unicas += fontes.historico.length;
        fontesAgg.candidatos_brutos += fontes.totalCandidatos;
        fontesAgg.vizinhos_artigos += fontes.vizinhosArtigos;
        fontesAgg.vizinhos_exemplos += fontes.vizinhos.reduce((a, v) => a + v.exemplos.length, 0);

        const prompt = buildPrompt(fontes, run.modo as Modo);
        const gen = await callAI(prompt);
        const normStats = normalizarGenerated(gen);
        if (normStats.rejeitados > 0 || normStats.convertidos > 0) {
          await appendLog(
            sb,
            runId,
            `pt-PT: ${normStats.convertidos} convertidos, ${normStats.rejeitados} rejeitados${
              normStats.rejeitadosTermos.length ? ` (${normStats.rejeitadosTermos.slice(0, 5).join(", ")})` : ""
            }`
          );
        }

        // Validação de qualidade das palavras-chave: remove termos genéricos,
        // sem evidência ou longos demais para servirem como sinal de classificação.
        const qualidadeKw = melhorarPalavrasChave(gen, fontes);
        if (qualidadeKw.removidos.length || qualidadeKw.movidosParaExpressoes) {
          await appendLog(
            sb,
            runId,
            `palavras-chave: removidas ${qualidadeKw.removidos.length} fracas, ${qualidadeKw.movidosParaExpressoes} movidas para expressões`
          );
          for (const r of qualidadeKw.removidos.slice(0, 10)) {
            await appendLog(sb, runId, `palavra-chave removida "${r.termo}": ${r.motivo}`);
          }
        }

        // (Os negativos por análise estatística inter-especialidades foram
        // descontinuados. Passam a existir apenas duas modalidades, geradas
        // automaticamente mais abaixo: negativo_concorrente — irmãos da mesma
        // especialidade — e negativo_incompativel — "Especialidades excluídas".)
        gen.termos_negativos = [];

        // Validação cruzada: remove duplicados entre listas positivas.
        const conflitos = resolverConflitos(gen);
        if (conflitos.removidosDup) {
          await appendLog(sb, runId, `validação: -${conflitos.removidosDup} duplicados removidos`);
        }

        const res = await persistir(sb, artigoId, gen, run.modo as Modo, fontes);

        // ===== Extras: concorrentes / incompatíveis / unidades / capítulos / exemplos =====
        try {
          const ancorasExtras = new Set<string>();
          const addAncoraExtra = (s: string) => {
            for (const c of canonicosComTokens(s)) ancorasExtras.add(c);
          };
          addAncoraExtra(fontes.artigo.descricao);
          addAncoraExtra(fontes.artigo.observacoes);
          addAncoraExtra(fontes.contexto.categoria);
          for (const k of ["palavras_chave", "sinonimos", "expressoes", "materiais"] as const) {
            for (const t of gen[k]) addAncoraExtra(t.termo);
          }

          const concorrentes = await derivarConcorrentes(
            sb,
            artigoId,
            fontes.especialidadeId,
            fontes.subespecialidadeId,
            ancorasExtras
          );
          const incompativeis = await derivarIncompatibilidades(
            sb,
            fontes.especialidadeId,
            ancorasExtras
          );
          const uce = await derivarUnidadesCapitulosExemplos(sb, artigoId);

          // Merge IA-generated unidades/capítulos/exemplos com os derivados
          // do histórico real. Histórico tem precedência; IA preenche os vazios.
          const mergeUnico = (a: GeneratedTermo[], b: GeneratedTermo[]) => {
            const seen = new Set(a.map((x) => x.termo.toLowerCase().trim()));
            const out = [...a];
            for (const t of b) {
              const k = t.termo.toLowerCase().trim();
              if (!k || seen.has(k)) continue;
              seen.add(k);
              out.push(t);
            }
            return out;
          };
          const unidadesFinal = mergeUnico(uce.unidades, gen.unidades);
          const capitulosFinal = mergeUnico(uce.capitulos, gen.capitulos);
          const exemplosFinal = mergeUnico(uce.exemplos, gen.exemplos);

          const extrasTipos = await gravarExtras(
            sb,
            artigoId,
            {
              concorrentes,
              incompativeis,
              unidades: unidadesFinal,
              capitulos: capitulosFinal,
              exemplos: exemplosFinal,
            },
            run.modo as Modo
          );
          for (const k of Object.keys(extrasTipos)) {
            (res.perTipo as any)[k] = ((res.perTipo as any)[k] ?? 0) + extrasTipos[k];
            res.inseridos += extrasTipos[k];
          }
          await appendLog(
            sb,
            runId,
            `extras: ${extrasTipos.negativo_concorrente} concorrentes · ${extrasTipos.negativo_incompativel} incompatíveis · ${extrasTipos.unidade_compativel} unidades · ${extrasTipos.capitulo_tipico} capítulos · ${extrasTipos.exemplo_real} exemplos`
          );
        } catch (e: any) {
          await appendLog(sb, runId, `extras falhou (ignorado): ${String(e?.message ?? e).slice(0, 200)}`);
        }




        // correcoes do utilizador para este artigo
        if (fontes.artigo.codigo) {
          const { count } = await sb
            .from("classificacao_aprendizagem")
            .select("id", { count: "exact", head: true })
            .eq("codigo_artigo", fontes.artigo.codigo);
          fontesAgg.correcoes_total += count ?? 0;
        }

        artigosRuns.set(artigoId, {
          id: artigoId,
          codigo: fontes.artigo.codigo,
          descricao: fontes.artigo.descricao,
          especialidade: fontes.contexto.especialidade,
          subespecialidade: fontes.contexto.subespecialidade,
          categoria: fontes.contexto.categoria,
          novosIds: res.novosIds,
          falhou: false,
          fontes,
        });

        for (const k of Object.keys(res.perTipo)) counts[k] = (counts[k] ?? 0) + res.perTipo[k];
        processados++;
        await sb
          .from("biblioteca_knowledge_run")
          .update({
            processados,
            counts,
            ultimo_artigo: `${fontes.artigo.codigo} — ${fontes.artigo.descricao}`.slice(0, 200),
          })
          .eq("id", runId);
        await appendLog(
          sb,
          runId,
          `✓ ${fontes.artigo.codigo} — ${res.inseridos} termos · A:${fontes.totalHistorico} B:${fontes.totalCandidatos} C:${fontes.vizinhosArtigos}`
        );
      } catch (e: any) {
        falhados++;
        processados++;
        ultimoErro = String(e?.message ?? e).slice(0, 300);
        artigosRuns.set(artigoId, {
          id: artigoId,
          codigo: "",
          descricao: "",
          novosIds: [],
          falhou: true,
          erro: ultimoErro,
        });
        await sb
          .from("biblioteca_knowledge_run")
          .update({ processados, falhados })
          .eq("id", runId);
        await appendLog(sb, runId, `✗ ${artigoId}: ${String(e?.message ?? e).slice(0, 200)}`);
      }
    }

    // === Construir resumo rico (todos os âmbitos) ===
    const idsOk = [...artigosRuns.values()].filter((a) => !a.falhou).map((a) => a.id);
    const novosIdsAll = [...artigosRuns.values()].flatMap((a) => a.novosIds);

    // Carregar metadados de artigos para casos em que falharam antes de termos `fontes`
    if (idsOk.length || ids.length) {
      const { data: artMeta } = await sb
        .from("biblioteca_artigos")
        .select("id, codigo, descricao, biblioteca_subespecialidades(nome, biblioteca_especialidades(nome)), biblioteca_categorias(nome)")
        .in("id", ids);
      for (const m of artMeta ?? []) {
        const cur = artigosRuns.get(m.id as string);
        const mm = m as any;
        const esp = mm.biblioteca_subespecialidades?.biblioteca_especialidades?.nome ?? "";
        const sub = mm.biblioteca_subespecialidades?.nome ?? "";
        const cat = mm.biblioteca_categorias?.nome ?? "";
        if (cur) {
          if (!cur.codigo) cur.codigo = (mm.codigo as string) ?? "";
          if (!cur.descricao) cur.descricao = (mm.descricao as string) ?? "";
          if (!cur.especialidade) cur.especialidade = esp;
          if (!cur.subespecialidade) cur.subespecialidade = sub;
          if (!cur.categoria) cur.categoria = cat;
        } else {
          artigosRuns.set(m.id as string, {
            id: m.id as string,
            codigo: (mm.codigo as string) ?? "",
            descricao: (mm.descricao as string) ?? "",
            especialidade: esp,
            subespecialidade: sub,
            categoria: cat,
            novosIds: [],
            falhou: false,
          });
        }
      }
    }

    // Carregar termos actuais para todos os artigos
    const TIPOS = ["palavra_chave", "sinonimo", "expressao", "material", "termo_negativo"];
    const perTipoDepois: Record<string, { count: number; somaPeso: number; somaPesoConf: number }> = {};
    const perOrigem: Record<string, number> = {};
    let somaPeso = 0, somaPesoConf = 0;
    const novosSet = new Set(novosIdsAll);
    const termos: any[] = [];
    const termosPorArtigo = new Map<string, { total: number; novos: number }>();

    if (idsOk.length) {
      const { data: rows } = await sb
        .from("biblioteca_artigo_conhecimento")
        .select("id, artigo_mestre_id, tipo, termo, peso, confianca, origem, ocorrencias, exemplos, justificacao")
        .in("artigo_mestre_id", idsOk)
        .eq("ativo", true)
        .order("tipo")
        .order("peso", { ascending: false });

      for (const r of rows ?? []) {
        const t = r.tipo as string;
        const p = Math.abs(Number(r.peso) || 0);
        const c = Number(r.confianca) || 0;
        if (!perTipoDepois[t]) perTipoDepois[t] = { count: 0, somaPeso: 0, somaPesoConf: 0 };
        perTipoDepois[t].count++;
        perTipoDepois[t].somaPeso += p;
        perTipoDepois[t].somaPesoConf += p * c;
        perOrigem[r.origem as string] = (perOrigem[r.origem as string] ?? 0) + 1;
        somaPeso += p;
        somaPesoConf += p * c;
        const amId = r.artigo_mestre_id as string;
        const aRun = artigosRuns.get(amId);
        const isNovo = novosSet.has(r.id as string);
        termos.push({
          id: r.id,
          artigoMestreId: amId,
          artigoCodigo: aRun?.codigo ?? "",
          artigoDescricao: aRun?.descricao ?? "",
          tipo: r.tipo,
          termo: r.termo,
          peso: r.peso,
          confianca: r.confianca,
          origem: r.origem,
          ocorrencias: r.ocorrencias ?? 0,
          exemplos: r.exemplos ?? [],
          justificacao: r.justificacao ?? null,
          novo: isNovo,
        });
        const cur = termosPorArtigo.get(amId) ?? { total: 0, novos: 0 };
        cur.total++;
        if (isNovo) cur.novos++;
        termosPorArtigo.set(amId, cur);
      }
    }

    const perTipo: Record<string, { antes: number; depois: number; delta: number }> = {};
    let antesTotal = 0;
    for (const t of TIPOS) {
      let antes = 0;
      for (const id of idsOk) {
        antes += antesPorArtigo.get(id)?.perTipo?.[t]?.count ?? 0;
      }
      const depois = perTipoDepois[t]?.count ?? 0;
      perTipo[t] = { antes, depois, delta: depois - antes };
      antesTotal += antes;
    }

    const confiancaDepois = somaPeso > 0 ? Math.round(somaPesoConf / somaPeso) : 0;
    let antesSomaP = 0, antesSomaPC = 0;
    for (const id of idsOk) {
      const snap = antesPorArtigo.get(id);
      if (!snap) continue;
      for (const t of Object.values(snap.perTipo)) {
        antesSomaP += t.somaPeso;
        antesSomaPC += t.somaPesoConf;
      }
    }
    const confiancaAntes = antesSomaP > 0 ? Math.round(antesSomaPC / antesSomaP) : 0;

    // Resolver escopo (nome)
    let escopoEspecialidade = "", escopoSubespecialidade = "", escopoArtigo: any = undefined;
    if (scope.tipo === "especialidade") {
      const { data } = await sb.from("biblioteca_especialidades").select("codigo, nome").eq("id", scope.especialidadeId).maybeSingle();
      escopoEspecialidade = data ? `${data.codigo ?? ""} — ${data.nome}`.trim() : "";
    } else if (scope.tipo === "subespecialidade") {
      const { data } = await sb
        .from("biblioteca_subespecialidades")
        .select("codigo, nome, biblioteca_especialidades(codigo, nome)")
        .eq("id", scope.subespecialidadeId)
        .maybeSingle();
      const dd = data as any;
      escopoSubespecialidade = dd ? `${dd.codigo ?? ""} — ${dd.nome}`.trim() : "";
      escopoEspecialidade = dd?.biblioteca_especialidades
        ? `${dd.biblioteca_especialidades.codigo ?? ""} — ${dd.biblioteca_especialidades.nome}`.trim()
        : "";
    } else {
      const a = artigosRuns.get(scope.artigoId);
      escopoArtigo = a ? { id: a.id, codigo: a.codigo, descricao: a.descricao } : { id: scope.artigoId, codigo: "", descricao: "" };
      escopoSubespecialidade = a?.subespecialidade ?? "";
      escopoEspecialidade = a?.especialidade ?? "";
    }

    const artigosList = [...artigosRuns.values()]
      .map((a) => {
        const t = termosPorArtigo.get(a.id) ?? { total: 0, novos: 0 };
        return {
          id: a.id,
          codigo: a.codigo,
          descricao: a.descricao,
          especialidade: a.especialidade,
          subespecialidade: a.subespecialidade,
          categoria: a.categoria,
          totalTermos: t.total,
          novos: t.novos,
          falhou: a.falhou,
          erro: a.erro ?? null,
        };
      })
      .sort((a, b) => (a.codigo || "").localeCompare(b.codigo || ""));

    const reutilizadosTotal = Math.max(0, termos.length - novosIdsAll.length);

    // Snapshot dos logs (últimos 100)
    const { data: runLog } = await sb
      .from("biblioteca_knowledge_run")
      .select("log")
      .eq("id", runId)
      .single();

    const resumo: any = {
      escopo: {
        tipo: scope.tipo,
        especialidade: escopoEspecialidade || undefined,
        subespecialidade: escopoSubespecialidade || undefined,
        artigo: escopoArtigo,
      },
      execucao: {
        totalArtigos: ids.length,
        processados,
        saltados,
        falhados,
        modo: run.modo,
      },
      // mantém `artigo` (single) só para âmbito Artigo (compat)
      artigo: scope.tipo === "artigo" && escopoArtigo
        ? {
            id: escopoArtigo.id,
            codigo: escopoArtigo.codigo,
            descricao: escopoArtigo.descricao,
            especialidade: escopoEspecialidade,
            subespecialidade: escopoSubespecialidade,
            categoria: artigosRuns.get(scope.artigoId)?.categoria ?? "",
          }
        : undefined,
      confiancaGlobal: { antes: confiancaAntes, depois: confiancaDepois },
      perTipo,
      perOrigem,
      total: termos.length,
      totalNovos: novosIdsAll.length,
      fontes: {
        historico: {
          total: fontesAgg.historico_total,
          validados: fontesAgg.historico_validado,
          auto: fontesAgg.historico_auto,
          descricoesUnicas: fontesAgg.historico_descricoes_unicas,
        },
        candidatos: { total: fontesAgg.candidatos_brutos },
        vizinhos: { artigos: fontesAgg.vizinhos_artigos, exemplos: fontesAgg.vizinhos_exemplos },
        correcoes: { total: fontesAgg.correcoes_total },
        reutilizados: { total: reutilizadosTotal },
      },
      termos,
      artigos: artigosList,
      counts,
      semHistorico: semHistoricoGlobal,
      erro: (falhados > 0 && processados === falhados + saltados && termos.length === 0) ? ultimoErro : null,
      log: ((runLog?.log as any[]) ?? []).slice(-100),
    };

    await sb
      .from("biblioteca_knowledge_run")
      .update({ estado: "concluido", concluido_em: new Date().toISOString(), resumo })
      .eq("id", runId);
    await appendLog(sb, runId, `Concluído: ${processados} processados, ${saltados} saltados, ${falhados} falhados`);
  } catch (e: any) {
    console.error("[knowledge-builder] processRun failed", e);
    try {
      const sbErr = admin();
      await sbErr
        .from("biblioteca_knowledge_run")
        .update({
          estado: "erro",
          erro_msg: String(e?.message ?? e).slice(0, 500),
          concluido_em: new Date().toISOString(),
        })
        .eq("id", runId);
    } catch (e2) {
      console.error("[knowledge-builder] could not mark run as erro", e2);
    }
  }
}
