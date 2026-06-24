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
