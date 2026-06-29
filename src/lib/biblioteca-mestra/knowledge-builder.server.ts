import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Sb = SupabaseClient<Database>;

const TIPO_LIMIT = 8;
const MQ_TOP = 40;
const CANDIDATOS_TOP = 60;
const ORC_FETCH_PER_TOKEN = 80;
const VIZINHOS_LIMIT = 15;
const VIZINHO_EXEMPLOS = 5;

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
  termos_negativos: GeneratedTermo[];
};

const TIPO_MAP = {
  palavras_chave: { tipo: "palavra_chave", pesoDefault: 30, sign: 1 },
  sinonimos: { tipo: "sinonimo", pesoDefault: 10, sign: 1 },
  expressoes: { tipo: "expressao", pesoDefault: 40, sign: 1 },
  materiais: { tipo: "material", pesoDefault: 8, sign: 1 },
  termos_negativos: { tipo: "termo_negativo", pesoDefault: -30, sign: -1 },
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
]);

function tokenGenerico(c: string): boolean {
  if (!c) return true;
  if (/\d/.test(c)) return true;
  if (c.length < 5) return true;
  if (c.includes(" ")) return false;
  return STOPWORDS.has(c) || GENERICOS_OBRA.has(c);
}

function admin(): Sb {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
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
  // espId -> nº de artigos ativos
  totalPorEsp: Map<string, number>;
  // espId -> nome legível
  nomeEsp: Map<string, string>;
  // artigoId -> espId
  artigoEsp: Map<string, string>;
};

function addToIdx(idx: IndiceGlobal, termoCanon: string, espId: string, artigoId: string) {
  if (!termoCanon || termoCanon.length < 4) return;
  let m = idx.termoEspArtigos.get(termoCanon);
  if (!m) { m = new Map(); idx.termoEspArtigos.set(termoCanon, m); }
  let s = m.get(espId);
  if (!s) { s = new Set(); m.set(espId, s); }
  s.add(artigoId);
}

async function construirIndiceGlobal(sb: Sb): Promise<IndiceGlobal> {
  const idx: IndiceGlobal = {
    termoEspArtigos: new Map(),
    totalPorEsp: new Map(),
    nomeEsp: new Map(),
    artigoEsp: new Map(),
  };

  const { data: esps } = await sb.from("biblioteca_especialidades").select("id, nome");
  for (const e of esps ?? []) idx.nomeEsp.set(e.id as string, (e.nome as string) ?? "");

  const { data: subs } = await sb
    .from("biblioteca_subespecialidades")
    .select("id, especialidade_id");
  const subEsp = new Map<string, string>();
  for (const s of subs ?? []) subEsp.set(s.id as string, s.especialidade_id as string);

  const { data: arts } = await sb
    .from("biblioteca_artigos")
    .select("id, subespecialidade_id, descricao")
    .eq("ativo", true);

  for (const a of arts ?? []) {
    const espId = subEsp.get(a.subespecialidade_id as string);
    if (!espId) continue;
    const aid = a.id as string;
    idx.artigoEsp.set(aid, espId);
    idx.totalPorEsp.set(espId, (idx.totalPorEsp.get(espId) ?? 0) + 1);
    for (const tok of tokenize((a.descricao as string) ?? "")) {
      addToIdx(idx, lemaSingular(tok), espId, aid);
    }
  }

  // Termos positivos já gravados reforçam o índice
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
  }

  return idx;
}

// Calcula termos negativos para um artigo a partir do índice global.
// Critério: termo praticamente ausente nesta especialidade e
// dominante (≥40% dos artigos) noutra especialidade.
function derivarNegativos(
  artigoEspId: string,
  vocPositivoCanonico: Set<string>,
  idx: IndiceGlobal,
  maxResultados = 12
): GeneratedTermo[] {
  const totalThisEsp = idx.totalPorEsp.get(artigoEspId) ?? 0;
  type Cand = { termo: string; espDom: string; domPct: number };
  const out: Cand[] = [];

  for (const [termoCanon, espMap] of idx.termoEspArtigos.entries()) {
    if (termoCanon.length < 4) continue;
    if (STOPWORDS.has(termoCanon)) continue;
    if (vocPositivoCanonico.has(termoCanon)) continue;
    // Termo já presente neste artigo via outro vocabulário
    const thisEspSet = espMap.get(artigoEspId);
    const presencaThis = totalThisEsp > 0 ? (thisEspSet?.size ?? 0) / totalThisEsp : 0;
    if (presencaThis > 0.02) continue;

    let bestEsp = "", bestDom = 0;
    for (const [espId, artSet] of espMap.entries()) {
      if (espId === artigoEspId) continue;
      const total = idx.totalPorEsp.get(espId) ?? 0;
      if (total < 3) continue;
      const dom = artSet.size / total;
      if (dom > bestDom) { bestDom = dom; bestEsp = espId; }
    }
    if (bestDom < 0.40 || !bestEsp) continue;
    out.push({ termo: termoCanon, espDom: bestEsp, domPct: bestDom });
  }

  out.sort((a, b) => b.domPct - a.domPct);
  return out.slice(0, maxResultados).map((n) => ({
    termo: n.termo,
    peso: 30,
    confianca: Math.round(Math.min(95, 55 + n.domPct * 40)),
    fonte: "vizinhos",
    justificacao: `Predominante em ${idx.nomeEsp.get(n.espDom) ?? ""} (${Math.round(n.domPct * 100)}%) e ausente neste artigo.`,
  }));
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
  artigo: { codigo: string; descricao: string; observacoes: string };
  contexto: { especialidade: string; subespecialidade: string; categoria: string };
  especialidadeId: string | null;
  historico: HistoricoEntry[];
  totalHistorico: number;
  historicoValidados: number;
  historicoAuto: number;
  candidatos: CandidatoEntry[];
  totalCandidatos: number;
  vizinhos: VizinhoEntry[];
  vizinhosArtigos: number;
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

  return {
    artigo: {
      codigo: aAny?.codigo ?? "",
      descricao: artigoDescricao,
      observacoes: aAny?.observacoes ?? "",
    },
    contexto: { especialidade: especialidadeNome, subespecialidade: subespecialidadeNome, categoria: categoriaNome },
    especialidadeId: (subRel?.especialidade_id as string | null) ?? null,

    historico,
    totalHistorico: mqRaw?.length ?? 0,
    historicoValidados,
    historicoAuto,
    candidatos,
    totalCandidatos: brutoMap.size,
    vizinhos,
    vizinhosArtigos: vizinhos.length,
    existentes,
    semHistorico: (mqRaw?.length ?? 0) === 0,
  };
}

function buildPrompt(fontes: Fontes, modo: Modo) {
  const { artigo, contexto, historico, candidatos, vizinhos, existentes, semHistorico } = fontes;

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

  const existentesTxt =
    modo === "novos" && existentes.length
      ? `\nTermos já existentes (NÃO repetir):\n${existentes
          .slice(0, 200)
          .map((e) => `- [${e.tipo}] ${e.termo}`)
          .join("\n")}`
      : "";

  const avisoSemHist = semHistorico
    ? "\n⚠ ATENÇÃO: este artigo NÃO tem histórico validado. Sê conservador: confiança ≤ 65, " +
      "prioriza FONTE B e usa FONTE C para discriminar termos negativos."
    : "";

  return `És um engenheiro de conhecimento técnico de construção civil em Portugal.
Constrói a base de conhecimento de UM artigo da Biblioteca Mestra, em português europeu,
para um motor de classificação de mapas de quantidades.

ARTIGO MESTRE
- Código: ${artigo.codigo}
- Descrição: ${artigo.descricao}
- Observações: ${artigo.observacoes || "—"}

CONTEXTO ESTRUTURAL
- Especialidade: ${contexto.especialidade}
- Subespecialidade: ${contexto.subespecialidade}
- Categoria: ${contexto.categoria}

═════ FONTES ═════
FONTE A — Histórico classificado para ESTE artigo (peso ALTO, ${historico.length} entradas, ${fontes.totalHistorico} ocorrências totais):
${linhasA}

FONTE B — Descrições BRUTAS candidatas (peso MÉDIO, top ${candidatos.length} de ${fontes.totalCandidatos} encontradas em orçamentos importados ainda não classificados):
${linhasB}

FONTE C — Artigos VIZINHOS na mesma subespecialidade (peso BAIXO, usar p/ diferenciação):
${linhasC}
${existentesTxt}${avisoSemHist}

GERA até ${TIPO_LIMIT} elementos por tipo, em JSON estrito:
{
  "palavras_chave": [{"termo":"...","peso":<5..50>,"confianca":<0..100>,"fonte":"historico|candidatos|vizinhos|inferido","justificacao":"..."}],
  "sinonimos":      [{"termo":"...","peso":<5..30>,"confianca":<0..100>,"fonte":"...","justificacao":"..."}],
  "expressoes":     [{"termo":"...","peso":<10..60>,"confianca":<0..100>,"fonte":"...","justificacao":"..."}],
  "materiais":      [{"termo":"...","peso":<3..20>,"confianca":<0..100>,"fonte":"...","justificacao":"..."}]
}

⚠ NÃO GERES termos_negativos. São derivados automaticamente pelo sistema a partir
de análise estatística inter-especialidades. Qualquer "termos_negativos" no teu output
será descartado.

REGRAS DE CONFIANÇA POR FONTE
- fonte="historico" → 80-95 (95 se aparecer em descrições [validado])
- fonte="candidatos" → 55-80 (proporcional à similaridade observada)
- fonte="vizinhos" → 40-60 (usar para discriminar termos próprios deste artigo)
- fonte="inferido" → 50-70 (terminologia técnica geral relacionada)

REGRAS DE IDIOMA — PORTUGUÊS DE PORTUGAL (OBRIGATÓRIO E NÃO NEGOCIÁVEL)
- Todo o output (termos, sinónimos, expressões, materiais e justificações) DEVE estar em **Português de Portugal (pt-PT)**. Proibido pt-BR, inglês ou mistura.
- A Biblioteca Mestra é referência de terminologia portuguesa da construção civil (mapas de quantidades, cadernos de encargos, medições). Usa sempre vocabulário praticado em Portugal por engenheiros, arquitetos, medidores e empreiteiros.
- Normalização OBRIGATÓRIA — nunca gerar a forma pt-BR como termo principal:
  concreto→betão · concreto armado→betão armado · concretagem→betonagem · concreto magro→betão de limpeza ·
  laje de concreto→laje de betão · forma (de concreto)→cofragem · escora→escoramento ·
  tubulação→tubagem · contrapiso→camada de regularização · piso cerâmico→pavimento cerâmico ·
  rejunte→betumação de juntas · argamassa colante→cimento-cola ·
  alvenaria de concreto→alvenaria de blocos de betão · bloco de concreto→bloco de betão ·
  esquadria→caixilharia · forro de gesso→teto falso em gesso cartonado ·
  chapisco→salpico · emboço→reboco de regularização ·
  calçada→passeio · meio-fio→lancil · prefeitura→câmara municipal.
- Termos EXCLUSIVAMENTE brasileiros sem equivalente em Portugal (ex.: "tijolo baiano", "cobogó") NÃO devem ser gerados. Se aparecerem nas fontes, ignora-os silenciosamente e procura terminologia portuguesa equivalente, ou omite.
- Se um termo aparecer em pt-BR nas FONTES e existir equivalente pt-PT: gera o equivalente pt-PT como termo principal e regista a forma pt-BR como **sinónimo** (peso baixo 5-10, confiança 40-60) para reconhecimento de descrições importadas.
- Sem anglicismos: "confiança" (não score), "geração/atualização" (não build/update), "conhecimento" (não knowledge), "guardar" (não salvar), "eliminar" (não deletar/excluir).
- Antes de devolveres o JSON, revê CADA termo: se contiver pt-BR ou inglês, substitui ou remove.

REGRAS
- Termos técnicos, minúsculas, sem pontuação supérflua, exclusivamente pt-PT.
- Expressões são frases curtas (2-6 palavras) típicas de MQ portugueses, ex: "fornecimento e aplicação de".
- Nunca repitas o mesmo termo (mesma raiz/singular/plural) em listas diferentes.
- "fonte" é OBRIGATÓRIO em cada termo.
- justificacao = UMA frase curta (máx. 120 caracteres), em pt-PT.
- NÃO inventes materiais sem evidência nas fontes.
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
      max_tokens: 4000,
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
  const norm = (arr: any): GeneratedTermo[] =>
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
              justificacao: x?.justificacao ? String(x.justificacao).trim().slice(0, 200) : undefined,
              fonte,
            };
          })
          .filter((x) => x.termo.length > 0)
          .slice(0, TIPO_LIMIT)
      : [];
  return {
    palavras_chave: norm(parsed.palavras_chave),
    sinonimos: norm(parsed.sinonimos),
    expressoes: norm(parsed.expressoes),
    materiais: norm(parsed.materiais),
    // Negativos NUNCA vêm da IA — são derivados estatisticamente pelo sistema.
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
    palavra_chave: 0, sinonimo: 0, expressao: 0, material: 0, termo_negativo: 0,
  };

  for (const k of Object.keys(TIPO_MAP) as (keyof typeof TIPO_MAP)[]) {
    const meta = TIPO_MAP[k];
    for (const t of gen[k]) {
      const key = `${meta.tipo}::${t.termo.toLowerCase()}`;
      if (setExist.has(key)) continue;
      setExist.add(key);
      const peso = Number.isFinite(t.peso) && t.peso !== 0 ? t.peso : meta.pesoDefault;
      const pesoFinal = meta.sign < 0 ? -Math.abs(peso) : Math.abs(peso);
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

    // Índice estatístico inter-especialidades (calculado UMA vez por run).
    await appendLog(sb, runId, "A construir índice estatístico inter-especialidades…");
    const indice = await construirIndiceGlobal(sb);
    await appendLog(
      sb,
      runId,
      `Índice: ${indice.termoEspArtigos.size} termos × ${indice.totalPorEsp.size} especialidades`
    );


    const counts: Record<string, number> = {
      palavra_chave: 0, sinonimo: 0, expressao: 0, material: 0, termo_negativo: 0,
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

        // Derivar termos negativos a partir do índice estatístico.
        if (fontes.especialidadeId) {
          const vocPositivo = new Set<string>();
          for (const k of ["palavras_chave", "sinonimos", "expressoes", "materiais"] as const) {
            for (const t of gen[k]) {
              const c = canonicalizar(t.termo);
              if (c) vocPositivo.add(c);
            }
          }
          // Termos já gravados (modo "novos") também contam como positivos.
          for (const e of fontes.existentes) {
            if (e.tipo !== "termo_negativo") {
              const c = canonicalizar(e.termo as string);
              if (c) vocPositivo.add(c);
            }
          }
          // Tokens da descrição do próprio artigo nunca podem virar negativos.
          for (const tok of tokenize(fontes.artigo.descricao)) {
            vocPositivo.add(lemaSingular(tok));
          }
          gen.termos_negativos = derivarNegativos(fontes.especialidadeId, vocPositivo, indice);
        }

        // Validação cruzada: elimina conflitos positivo/negativo e duplicados.
        const conflitos = resolverConflitos(gen);
        if (conflitos.removidosNegativos || conflitos.removidosDup) {
          await appendLog(
            sb,
            runId,
            `validação: -${conflitos.removidosNegativos} negativos em conflito, -${conflitos.removidosDup} duplicados`
          );
        }

        const res = await persistir(sb, artigoId, gen, run.modo as Modo, fontes);


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
    await sb
      .from("biblioteca_knowledge_run")
      .update({
        estado: "erro",
        erro_msg: String(e?.message ?? e).slice(0, 500),
        concluido_em: new Date().toISOString(),
      })
      .eq("id", runId);
  }
}

