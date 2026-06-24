import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { lineTotal, fmtEUR } from "./orcamento-utils";

type Cap = { id: string; codigo: string | null; descricao: string; ordem: number };
type Art = {
  id: string;
  capitulo_id: string | null;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  preco_unitario: number;
  margem_pct: number;
  ordem: number;
};

export type ExportData = {
  orcamento: { nome: string; versao: number; estado: string; observacoes: string | null; margem_global_pct: number };
  obra: { nome: string; codigo: string | null; cliente: string | null };
  capitulos: Cap[];
  artigos: Art[];
};

function groupByCap(data: ExportData) {
  const caps = [...data.capitulos].sort((a, b) => a.ordem - b.ordem);
  const sem: Art[] = [];
  const byCap = new Map<string, Art[]>();
  for (const a of data.artigos) {
    if (a.capitulo_id && caps.find((c) => c.id === a.capitulo_id)) {
      const arr = byCap.get(a.capitulo_id) ?? [];
      arr.push(a);
      byCap.set(a.capitulo_id, arr);
    } else sem.push(a);
  }
  return { caps, byCap, sem };
}

export function exportToExcel(data: ExportData) {
  const { caps, byCap, sem } = groupByCap(data);
  const rows: any[][] = [];
  rows.push(["Obra", data.obra.nome, "", "Cliente", data.obra.cliente ?? ""]);
  rows.push(["Orçamento", `${data.orcamento.nome} (v${data.orcamento.versao})`, "", "Estado", data.orcamento.estado]);
  rows.push([]);
  rows.push(["Código", "Descrição", "Un.", "Qtd.", "Preço unit.", "Margem %", "Total"]);

  let total = 0;
  const addArt = (a: Art) => {
    const t = lineTotal(a);
    total += t;
    rows.push([a.codigo ?? "", a.descricao, a.unidade ?? "", a.quantidade, a.preco_unitario, a.margem_pct, t]);
  };

  for (const c of caps) {
    rows.push([c.codigo ?? "", c.descricao.toUpperCase(), "", "", "", "", ""]);
    const arts = (byCap.get(c.id) ?? []).sort((a, b) => a.ordem - b.ordem);
    arts.forEach(addArt);
  }
  if (sem.length) {
    rows.push(["", "OUTROS", "", "", "", "", ""]);
    sem.forEach(addArt);
  }

  const gross = total * (1 + (data.orcamento.margem_global_pct || 0) / 100);
  rows.push([]);
  rows.push(["", "", "", "", "", "Subtotal", total]);
  rows.push(["", "", "", "", "", `Margem global ${data.orcamento.margem_global_pct}%`, gross - total]);
  rows.push(["", "", "", "", "", "TOTAL", gross]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 60 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orçamento");
  XLSX.writeFile(wb, `${data.orcamento.nome.replace(/[^a-z0-9]+/gi, "_")}_v${data.orcamento.versao}.xlsx`);
}

export function exportToPDF(data: ExportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { caps, byCap, sem } = groupByCap(data);

  doc.setFontSize(16);
  doc.text(data.orcamento.nome, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Obra: ${data.obra.nome}${data.obra.codigo ? ` · ${data.obra.codigo}` : ""}`, 14, 22);
  if (data.obra.cliente) doc.text(`Cliente: ${data.obra.cliente}`, 14, 27);
  doc.text(`Versão ${data.orcamento.versao} · ${data.orcamento.estado}`, 14, 32);
  doc.setTextColor(0);

  const body: any[][] = [];
  let total = 0;

  const pushArt = (a: Art) => {
    const t = lineTotal(a);
    total += t;
    body.push([
      a.codigo ?? "",
      a.descricao,
      a.unidade ?? "",
      a.quantidade.toLocaleString("pt-PT"),
      fmtEUR(a.preco_unitario),
      fmtEUR(t),
    ]);
  };

  for (const c of caps) {
    body.push([{ content: `${c.codigo ? c.codigo + " · " : ""}${c.descricao}`.toUpperCase(), colSpan: 6, styles: { fillColor: [232, 178, 58], textColor: 20, fontStyle: "bold" } }]);
    const arts = (byCap.get(c.id) ?? []).sort((a, b) => a.ordem - b.ordem);
    arts.forEach(pushArt);
  }
  if (sem.length) {
    body.push([{ content: "OUTROS", colSpan: 6, styles: { fillColor: [200, 200, 200], fontStyle: "bold" } }]);
    sem.forEach(pushArt);
  }

  const gross = total * (1 + (data.orcamento.margem_global_pct || 0) / 100);

  autoTable(doc, {
    startY: 38,
    head: [["Código", "Descrição", "Un.", "Qtd.", "P. Unit.", "Total"]],
    body,
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [20, 25, 32], textColor: 240 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 12 },
      3: { cellWidth: 20, halign: "right" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 26, halign: "right" },
    },
    foot: [
      [{ content: "Subtotal", colSpan: 5, styles: { halign: "right" } }, { content: fmtEUR(total), styles: { halign: "right" } }],
      [{ content: `Margem global ${data.orcamento.margem_global_pct}%`, colSpan: 5, styles: { halign: "right" } }, { content: fmtEUR(gross - total), styles: { halign: "right" } }],
      [{ content: "TOTAL", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } }, { content: fmtEUR(gross), styles: { halign: "right", fontStyle: "bold" } }],
    ],
  });

  doc.save(`${data.orcamento.nome.replace(/[^a-z0-9]+/gi, "_")}_v${data.orcamento.versao}.pdf`);
}
