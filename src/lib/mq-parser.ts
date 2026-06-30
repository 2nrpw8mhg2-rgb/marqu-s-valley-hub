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
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[._:;,\-–—/\\()[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const HEADER_HINTS: Record<keyof ColumnMap, string[]> = {
  codigo: ["codigo", "cod", "ref", "referencia", "artigo", "item", "n", "numero"],
  descricao: ["descricao", "descric", "designacao", "designaca", "design", "desig", "desc", "natureza"],
  unidade: ["un", "und", "unid", "unidade", "uni"],
  quantidade: ["qtd", "qtde", "quant", "quantidade", "qt"],
  preco: ["preco", "pu", "p unit", "p unitario", "pvp", "valor", "unitario"],
};

export function detectColumns(rows: any[][]): { headerRowIdx: number; map: ColumnMap } | null {
  for (let i = 0; i < Math.min(rows.length, 150); i++) {
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
      const inferred = inferColumnsFromData(rows, i + 1);
      if (inferred) {
        if (countMeaningful(rows, i + 1, map.descricao) < 3) map.descricao = inferred.map.descricao;
        map.codigo ??= inferred.map.codigo;
        map.unidade ??= inferred.map.unidade;
        map.quantidade ??= inferred.map.quantidade;
        map.preco ??= inferred.map.preco;
      }
      return { headerRowIdx: i, map };
    }
  }
  return inferColumnsFromData(rows, 0);
}

function toNum(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(/€/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function textOf(v: any): string {
  return v == null ? "" : String(v).trim();
}

function hasLetters(v: any): boolean {
  return /[a-zA-ZÀ-ÿ]/.test(textOf(v));
}

function isNumberLike(v: any): boolean {
  if (v == null || v === "") return false;
  if (typeof v === "number") return Number.isFinite(v);
  const s = textOf(v).replace(/\s/g, "");
  if (!/\d/.test(s)) return false;
  if (!/^[+-]?[\d.,]+%?$/.test(s)) return false;
  return Number.isFinite(toNum(s));
}

function isCodeLike(v: any): boolean {
  const s = NORM(textOf(v)).replace(/\s/g, "");
  if (!s || s.length > 18) return false;
  return /^([a-z])?\d+([.\-]\d+)*([a-z])?$/.test(s) || /^\d+[a-z]$/.test(s);
}

function isUnitLike(v: any): boolean {
  const raw = textOf(v).toLowerCase().trim();
  const compact = NORM(raw).replace(/\s/g, "");
  const units = new Set([
    "un", "und", "uni", "unid", "unidade", "vg", "vb", "verba", "cj", "conj", "conjunto",
    "m", "ml", "m2", "m²", "m^2", "m3", "m³", "m^3", "cm", "mm", "km",
    "kg", "ton", "t", "l", "lt", "h", "hr", "dia", "mes",
  ]);
  return units.has(compact) || units.has(raw.replace(/\s/g, ""));
}

function isHeaderText(v: any): boolean {
  const n = NORM(textOf(v));
  if (!n) return false;
  return Object.values(HEADER_HINTS).some((hints) => hints.some((h) => n === h || n.startsWith(h) || n.includes(h)));
}

function isMeaningfulDescription(v: any): boolean {
  const s = textOf(v);
  const n = NORM(s);
  if (s.length < 4 || !hasLetters(s) || isHeaderText(s)) return false;
  if (/^(total|subtotal|sub total|soma)\b/.test(n)) return false;
  return !isUnitLike(s) && !isNumberLike(s);
}

function inferColumnsFromData(rows: any[][], startRow: number): { headerRowIdx: number; map: ColumnMap } | null {
  const endRow = Math.min(rows.length, Math.max(startRow + 40, 260));
  const maxCols = Math.min(40, Math.max(0, ...rows.slice(startRow, endRow).map((r) => r?.length ?? 0)));
  if (!maxCols) return null;

  const stats = Array.from({ length: maxCols }, (_, idx) => ({ idx, text: 0, longText: 0, unit: 0, num: 0, code: 0, nonEmpty: 0 }));
  for (let ri = startRow; ri < endRow; ri++) {
    const row = rows[ri] || [];
    for (let ci = 0; ci < maxCols; ci++) {
      const cell = row[ci];
      const s = textOf(cell);
      if (!s) continue;
      const st = stats[ci];
      st.nonEmpty += 1;
      if (isMeaningfulDescription(s)) {
        st.text += 1;
        st.longText += Math.min(s.length, 180);
      }
      if (isUnitLike(s)) st.unit += 1;
      if (isNumberLike(s)) st.num += 1;
      if (isCodeLike(s)) st.code += 1;
    }
  }

  const desc = [...stats]
    .filter((s) => s.text >= 3)
    .sort((a, b) => (b.text * 10 + b.longText / 20) - (a.text * 10 + a.longText / 20))[0];
  if (!desc) return null;

  const codigo = [...stats]
    .filter((s) => s.idx < desc.idx && s.code >= 2)
    .sort((a, b) => (b.code * 4 + b.nonEmpty) - (a.code * 4 + a.nonEmpty))[0]?.idx ?? null;
  const unidade = [...stats]
    .filter((s) => s.idx > desc.idx && s.unit >= 2)
    .sort((a, b) => (b.unit * 6 + b.nonEmpty) - (a.unit * 6 + a.nonEmpty))[0]?.idx ?? null;
  const numericRight = [...stats]
    .filter((s) => s.idx > (unidade ?? desc.idx) && s.num >= 2)
    .sort((a, b) => a.idx - b.idx);
  const quantidade = numericRight[0]?.idx ?? null;
  const preco = numericRight.find((s) => s.idx !== quantidade)?.idx ?? null;

  let firstDataRow = startRow;
  for (let ri = startRow; ri < endRow; ri++) {
    const row = rows[ri] || [];
    if (!isMeaningfulDescription(row[desc.idx])) continue;
    const hasSignals =
      (codigo != null && isCodeLike(row[codigo])) ||
      (unidade != null && isUnitLike(row[unidade])) ||
      (quantidade != null && isNumberLike(row[quantidade]));
    if (hasSignals) {
      firstDataRow = ri;
      break;
    }
  }

  return {
    headerRowIdx: Math.max(0, firstDataRow - 1),
    map: { codigo, descricao: desc.idx, unidade, quantidade, preco },
  };
}

function countMeaningful(rows: any[][], startRow: number, col: number): number {
  let count = 0;
  for (let ri = startRow; ri < Math.min(rows.length, startRow + 80); ri++) {
    if (isMeaningfulDescription(rows[ri]?.[col])) count += 1;
  }
  return count;
}

export function parseRows(rows: any[][], headerRowIdx: number, map: ColumnMap): ParsedRow[] {
  const out: ParsedRow[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const descricao = String(r[map.descricao] ?? "").trim();
    if (!descricao) continue;
    if (isHeaderText(descricao)) continue;
    const codigo = map.codigo != null ? String(r[map.codigo] ?? "").trim() || null : null;
    const unidade = map.unidade != null ? String(r[map.unidade] ?? "").trim() || null : null;
    const qtd = map.quantidade != null ? toNum(r[map.quantidade]) : 0;
    const preco = map.preco != null ? toNum(r[map.preco]) : 0;
    const normDesc = NORM(descricao);
    if (!unidade && qtd === 0 && /^(total|subtotal|sub total|soma)\b/.test(normDesc)) continue;

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
