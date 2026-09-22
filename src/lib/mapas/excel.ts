/**
 * Exportação Excel profissional de um mapa por subempreitada.
 *
 * O ficheiro é editável pelo subempreiteiro: a coluna «Preço Unitário» fica
 * vazia e o «Preço Total» é uma fórmula. Nenhum custo ou preço interno é
 * exportado.
 */
import * as XLSX from "xlsx";
import { derivarCapitulos, protegerTextoExcel, type PastaMapa } from "./pastas";

export type MetaMapa = {
  obra_nome: string;
  obra_cliente?: string | null;
  orcamento_nome: string;
  data: string;
  provisorio: boolean;
  versao: string;
};

export const CABECALHOS_EXCEL = [
  "Código",
  "Descrição",
  "Unidade",
  "Quantidade",
  "Preço Unitário",
  "Preço Total",
] as const;

/** Linha (1-based) onde começa o cabeçalho da tabela. */
export const LINHA_CABECALHO = 6;

export function construirFolhaMapa(pasta: PastaMapa, meta: MetaMapa): XLSX.WorkSheet {
  const estado = meta.provisorio ? "PROVISÓRIO" : "VALIDADO";
  const linhas: (string | number | null)[][] = [
    ["MAPA DE QUANTIDADES PARA CONSULTA", null, null, null, null, null],
    ["Obra", protegerTextoExcel(meta.obra_nome), null, "Cliente", protegerTextoExcel(meta.obra_cliente ?? ""), null],
    ["Subempreitada", protegerTextoExcel(pasta.etiqueta), null, "Mapa de Quantidades", protegerTextoExcel(meta.orcamento_nome), null],
    ["Data", meta.data, null, "Estado", estado, `Versão ${meta.versao}`],
    [null, null, null, null, null, null],
    [...CABECALHOS_EXCEL],
  ];

  for (const a of pasta.artigos) {
    const { capitulo, subcapitulo } = derivarCapitulos(a);
    const descricao = subcapitulo || capitulo ? `${a.descricao}` : a.descricao;
    linhas.push([
      protegerTextoExcel(a.codigo ?? ""),
      protegerTextoExcel(descricao),
      protegerTextoExcel(a.unidade ?? ""),
      a.quantidade,
      null,
      null,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const primeira = LINHA_CABECALHO + 1;
  const ultima = LINHA_CABECALHO + pasta.artigos.length;

  for (let r = primeira; r <= ultima; r++) {
    const q = XLSX.utils.encode_cell({ r: r - 1, c: 3 });
    if (ws[q]) ws[q].z = "#,##0.00";
    // Preço Unitário fica vazio e editável, apenas com formato de moeda.
    const pu = XLSX.utils.encode_cell({ r: r - 1, c: 4 });
    ws[pu] = { t: "z", z: "#,##0.00 €" } as XLSX.CellObject;
    const pt = XLSX.utils.encode_cell({ r: r - 1, c: 5 });
    ws[pt] = { t: "n", f: `D${r}*E${r}`, z: "#,##0.00 €" } as XLSX.CellObject;
  }

  const linhaTotal = ultima + 2;
  ws[XLSX.utils.encode_cell({ r: linhaTotal - 1, c: 4 })] = { t: "s", v: "TOTAL" };
  ws[XLSX.utils.encode_cell({ r: linhaTotal - 1, c: 5 })] = {
    t: "n",
    f: pasta.artigos.length ? `SUM(F${primeira}:F${ultima})` : "0",
    z: "#,##0.00 €",
  } as XLSX.CellObject;

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhaTotal - 1, c: 5 } });
  ws["!cols"] = [{ wch: 14 }, { wch: 80 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
  ws["!autofilter"] = { ref: `A${LINHA_CABECALHO}:F${Math.max(ultima, LINHA_CABECALHO)}` };
  // Cabeçalho congelado (linhas de identificação + cabeçalho da tabela).
  (ws as any)["!freeze"] = `A${primeira}`;
  (ws as any)["!panes"] = [{ ySplit: LINHA_CABECALHO, topLeftCell: `A${primeira}`, activePane: "bottomLeft", state: "frozen" }];
  for (const a of pasta.artigos.keys()) {
    const cel = ws[XLSX.utils.encode_cell({ r: LINHA_CABECALHO + a, c: 1 })];
    if (cel) cel.s = { alignment: { wrapText: true, vertical: "top" } };
  }

  return ws;
}

export function construirLivroMapa(pasta: PastaMapa, meta: MetaMapa): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const nome = pasta.etiqueta.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 28) || "Mapa";
  XLSX.utils.book_append_sheet(wb, construirFolhaMapa(pasta, meta), nome);
  return wb;
}

export function excelMapaBytes(pasta: PastaMapa, meta: MetaMapa): Uint8Array {
  const wb = construirLivroMapa(pasta, meta);
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}
