import * as XLSX from "xlsx";

export type ParsedRow = {
  isCapitulo: boolean;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  preco_unitario: number;
};

export type ColumnMap = {
  codigo: number | null;
  descricao: number;
  unidade: number | null;
  quantidade: number | null;
  preco: number | null;
};

const NORM = (s: string) =>
  s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const HEADER_HINTS: Record<keyof ColumnMap, string[]> = {
  codigo: ["codigo", "cod", "ref", "artigo", "item"],
  descricao: ["descricao", "descric", "designacao", "designaca", "desc"],
  unidade: ["un", "und", "unidade", "uni"],
  quantidade: ["qtd", "quant", "quantidade", "qt"],
  preco: ["preco", "pu", "pvp", "valor", "unitario", "p.unit"],
};

export function detectColumns(rows: any[][]): { headerRowIdx: number; map: ColumnMap } | null {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] || [];
    const map: ColumnMap = { codigo: null, descricao: -1, unidade: null, quantidade: null, preco: null };
    let descIdx = -1;
    row.forEach((cell, idx) => {
      if (cell == null) return;
      const n = NORM(String(cell));
      if (!n) return;
      for (const key of Object.keys(HEADER_HINTS) as (keyof ColumnMap)[]) {
        if (HEADER_HINTS[key].some((h) => n === h || n.startsWith(h) || n.includes(h))) {
          if (key === "descricao") descIdx = idx;
          else if (map[key] == null) map[key] = idx;
        }
      }
    });
    if (descIdx >= 0) {
      map.descricao = descIdx;
      return { headerRowIdx: i, map };
    }
  }
  return null;
}

function toNum(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(/€/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function parseRows(rows: any[][], headerRowIdx: number, map: ColumnMap): ParsedRow[] {
  const out: ParsedRow[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const descricao = String(r[map.descricao] ?? "").trim();
    if (!descricao) continue;
    const codigo = map.codigo != null ? String(r[map.codigo] ?? "").trim() || null : null;
    const unidade = map.unidade != null ? String(r[map.unidade] ?? "").trim() || null : null;
    const qtd = map.quantidade != null ? toNum(r[map.quantidade]) : 0;
    const preco = map.preco != null ? toNum(r[map.preco]) : 0;

    // Heurística capítulo: tem código tipo "1", "01", "1.1" sem unidade nem qtd
    const isCapitulo =
      (!unidade && qtd === 0 && preco === 0) ||
      (!!codigo && /^[0-9]+(\.[0-9]+)*$/.test(codigo) && !unidade && qtd === 0);

    out.push({ isCapitulo, codigo, descricao, unidade, quantidade: qtd, preco_unitario: preco });
  }
  return out;
}

export async function readXlsx(file: File): Promise<{ sheets: string[]; data: Record<string, any[][]> }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const data: Record<string, any[][]> = {};
  for (const name of wb.SheetNames) {
    data[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null }) as any[][];
  }
  return { sheets: wb.SheetNames, data };
}
