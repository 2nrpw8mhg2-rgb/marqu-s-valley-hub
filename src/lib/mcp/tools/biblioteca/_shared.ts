import type { SupabaseClient } from "@supabase/supabase-js";

// Normalizador simples pt-BR → pt-PT (lista curta; sinaliza restantes)
const PTBR_MAP: Record<string, string> = {
  concreto: "betão",
  "forma ": "cofragem ",
  concretagem: "betonagem",
  tubulação: "tubagem",
  encanamento: "canalização",
  tomada: "tomada", // igual
  arquivo: "ficheiro",
  time: "equipa",
  "banheiro": "casa de banho",
  chuveiro: "chuveiro",
  torneira: "torneira",
};

export function normalizarPtPt(txt: string): string {
  let out = txt;
  for (const [br, pt] of Object.entries(PTBR_MAP)) {
    out = out.replace(new RegExp(`\\b${br}\\b`, "gi"), pt);
  }
  return out;
}

export function detetarPtBr(txt: string): string[] {
  const found: string[] = [];
  for (const br of Object.keys(PTBR_MAP)) {
    if (new RegExp(`\\b${br}\\b`, "i").test(txt)) found.push(br);
  }
  return found;
}

export type Pesos = {
  palavra_chave: number;
  sinonimo: number;
  expressao: number;
  material: number;
  negativo: number;
  exemplo_real: number;
  relacao: number;
  unidade_compativel: number;
  capitulo_tipico: number;
};

const PESOS: Pesos = {
  palavra_chave: 0.15,
  sinonimo: 0.1,
  expressao: 0.1,
  material: 0.1,
  negativo: 0.15,
  exemplo_real: 0.15,
  relacao: 0.15,
  unidade_compativel: 0.05,
  capitulo_tipico: 0.05,
};

export function calcularScoreQualidade(counts: Record<string, number>): {
  score: number;
  completude: number;
} {
  const target = { palavra_chave: 5, sinonimo: 3, expressao: 2, material: 3, negativo: 3, exemplo_real: 3, relacao: 2, unidade_compativel: 1, capitulo_tipico: 1 } as Record<string, number>;
  let score = 0;
  let presentes = 0;
  for (const [k, w] of Object.entries(PESOS)) {
    const n = counts[k] ?? 0;
    const t = target[k] ?? 1;
    const ratio = Math.min(1, n / t);
    score += ratio * w;
    if (n > 0) presentes++;
  }
  return { score: Number(score.toFixed(3)), completude: Number((presentes / Object.keys(PESOS).length).toFixed(3)) };
}

export async function contarConhecimento(sb: SupabaseClient, artigoId: string) {
  const { data } = await sb
    .from("biblioteca_artigo_conhecimento")
    .select("tipo")
    .eq("artigo_mestre_id", artigoId)
    .eq("ativo", true);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.tipo] = (counts[row.tipo] ?? 0) + 1;
  const negativo = (counts["negativo_concorrente"] ?? 0) + (counts["negativo_incompativel"] ?? 0) + (counts["termo_negativo"] ?? 0);
  return { ...counts, negativo } as Record<string, number>;
}

export async function recalcularQualidade(sb: SupabaseClient, artigoId: string) {
  const c = await contarConhecimento(sb, artigoId);
  const { count: relCount } = await sb
    .from("biblioteca_artigo_relacoes")
    .select("*", { count: "exact", head: true })
    .or(`artigo_origem_id.eq.${artigoId},artigo_destino_id.eq.${artigoId}`);
  const counts = { ...c, relacao: relCount ?? 0 };
  const { score, completude } = calcularScoreQualidade(counts);
  await sb.from("biblioteca_artigo_qualidade").upsert({
    artigo_id: artigoId,
    score_qualidade: score,
    completude,
    n_palavras_chave: counts["palavra_chave"] ?? 0,
    n_sinonimos: counts["sinonimo"] ?? 0,
    n_expressoes: counts["expressao"] ?? 0,
    n_materiais: counts["material"] ?? 0,
    n_negativos: counts["negativo"] ?? 0,
    n_exemplos: counts["exemplo_real"] ?? 0,
    n_relacoes: relCount ?? 0,
    ultima_auditoria: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "artigo_id" });
  return { score, completude, counts };
}

export async function registarAprendizagem(sb: SupabaseClient, artigoId: string, tipo: string, payload: unknown, autor: string | null) {
  await sb.from("biblioteca_aprendizagem_evento").insert({ artigo_id: artigoId, tipo, payload: payload ?? {}, autor });
}

export async function isAdmin(sb: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  return Boolean(data);
}
