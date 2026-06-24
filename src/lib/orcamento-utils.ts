export type Artigo = {
  id?: string;
  capitulo_id: string | null;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  preco_unitario: number;
  margem_pct: number;
  ordem: number;
};

export const COST_CATEGORIES = [
  { key: "custo_mao_obra", label: "Mão de Obra", fonte: "mao_obra" },
  { key: "custo_tarefeiros", label: "Tarefeiros", fonte: "tarefeiros" },
  { key: "custo_subempreitadas", label: "Subempreitadas", fonte: "subempreitadas" },
  { key: "custo_materiais", label: "Materiais", fonte: "materiais" },
  { key: "custo_equipamentos", label: "Equipamentos", fonte: "equipamentos" },
  { key: "custo_transportes", label: "Transportes", fonte: "transportes" },
  { key: "custo_encargos_gerais", label: "Encargos Gerais", fonte: "encargos_gerais" },
  { key: "custo_outros", label: "Outros", fonte: "outros" },
] as const;

export type CostKey = typeof COST_CATEGORIES[number]["key"];
export type FonteCategoria = typeof COST_CATEGORIES[number]["fonte"];

export type CostBreakdown = Partial<Record<CostKey, number>>;

export function custoTotal(a: CostBreakdown): number {
  return COST_CATEGORIES.reduce((sum, c) => sum + (Number(a[c.key]) || 0), 0);
}

export function pvUnitario(a: CostBreakdown & { margem_pct?: number | null }): number {
  const c = custoTotal(a);
  return c * (1 + (Number(a.margem_pct) || 0) / 100);
}

export function totalVenda(a: CostBreakdown & { quantidade?: number | null; margem_pct?: number | null }): number {
  return pvUnitario(a) * (Number(a.quantidade) || 0);
}

export function lucroBruto(a: CostBreakdown & { quantidade?: number | null; margem_pct?: number | null }): number {
  const q = Number(a.quantidade) || 0;
  return totalVenda(a) - custoTotal(a) * q;
}

export function lineTotal(a: Pick<Artigo, "quantidade" | "preco_unitario" | "margem_pct">) {
  const base = (a.quantidade || 0) * (a.preco_unitario || 0);
  return base * (1 + (a.margem_pct || 0) / 100);
}

export function fmtEUR(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
}

export function fmtNum(n: number | null | undefined, frac = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  }).format(n);
}

export function fmtPct(n: number | null | undefined, frac = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(frac)}%`;
}
