import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtEUR } from "@/lib/orcamento-utils";

export type ArtigoExport = {
  codigo: string | null;
  capitulo_codigo: string | null;
  capitulo_descricao: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  preco_unitario: number;
  subempreitada_id: string | null;
  subempreitada_nome: string | null;
};

export type ExportPorSubempreitadaInput = {
  orcamento_nome: string;
  obra_nome: string;
  obra_cliente: string | null;
  subempreitadas_selecionadas: Array<{ id: string; nome: string }>;
  artigos: ArtigoExport[];
  /** Se true, esconde preço unitário (para pedido de proposta). */
  pedido_proposta?: boolean;
};

function agrupar(input: ExportPorSubempreitadaInput) {
  const map = new Map<string, ArtigoExport[]>();
  for (const s of input.subempreitadas_selecionadas) map.set(s.id, []);
  for (const a of input.artigos) {
    if (a.subempreitada_id && map.has(a.subempreitada_id)) {
      map.get(a.subempreitada_id)!.push(a);
    }
  }
  return map;
}

export function exportarExcelPorSubempreitada(input: ExportPorSubempreitadaInput) {
  const wb = XLSX.utils.book_new();
  const groups = agrupar(input);

  for (const s of input.subempreitadas_selecionadas) {
    const arts = groups.get(s.id) ?? [];
    const rows: any[][] = [];
    rows.push(["Obra", input.obra_nome, "Cliente", input.obra_cliente ?? ""]);
    rows.push(["Orçamento", input.orcamento_nome, "Subempreitada", s.nome]);
    rows.push([]);
    if (input.pedido_proposta) {
      rows.push(["Código", "Capítulo", "Descrição", "Un.", "Quantidade"]);
      let total = 0;
      for (const a of arts) {
        rows.push([a.codigo ?? "", a.capitulo_codigo ?? "", a.descricao, a.unidade ?? "", a.quantidade]);
        total += a.quantidade * a.preco_unitario;
      }
      rows.push([]);
      rows.push([`Total de artigos: ${arts.length}`]);
    } else {
      rows.push(["Código", "Capítulo", "Descrição", "Un.", "Qtd.", "Preço unit.", "Total"]);
      let total = 0;
      for (const a of arts) {
        const t = a.quantidade * a.preco_unitario;
        total += t;
        rows.push([a.codigo ?? "", a.capitulo_codigo ?? "", a.descricao, a.unidade ?? "", a.quantidade, a.preco_unitario, t]);
      }
      rows.push([]);
      rows.push(["", "", "", "", "", "TOTAL", total]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 55 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
    const sheetName = s.nome.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 28) || s.id.slice(0, 8);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const filename = `${input.pedido_proposta ? "pedido_proposta" : "por_subempreitada"}_${input.orcamento_nome.replace(/[^a-z0-9]+/gi, "_")}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportarPDFPorSubempreitada(input: ExportPorSubempreitadaInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const groups = agrupar(input);
  let first = true;

  for (const s of input.subempreitadas_selecionadas) {
    if (!first) doc.addPage();
    first = false;
    const arts = groups.get(s.id) ?? [];

    doc.setFontSize(14);
    doc.text(input.pedido_proposta ? "Pedido de proposta" : "Mapa de quantidades", 14, 15);
    doc.setFontSize(10);
    doc.text(`Obra: ${input.obra_nome}`, 14, 22);
    doc.text(`Cliente: ${input.obra_cliente ?? "—"}`, 14, 27);
    doc.text(`Orçamento: ${input.orcamento_nome}`, 14, 32);
    doc.setFontSize(12);
    doc.text(`Subempreitada: ${s.nome}`, 14, 40);

    if (input.pedido_proposta) {
      autoTable(doc, {
        startY: 45,
        head: [["Código", "Descrição", "Un.", "Qtd."]],
        body: arts.map((a) => [a.codigo ?? "", a.descricao, a.unidade ?? "", String(a.quantidade)]),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [40, 40, 40] },
        columnStyles: { 1: { cellWidth: 110 } },
      });
    } else {
      let total = 0;
      const body = arts.map((a) => {
        const t = a.quantidade * a.preco_unitario;
        total += t;
        return [a.codigo ?? "", a.descricao, a.unidade ?? "", String(a.quantidade), fmtEUR(a.preco_unitario), fmtEUR(t)];
      });
      autoTable(doc, {
        startY: 45,
        head: [["Código", "Descrição", "Un.", "Qtd.", "Preço", "Total"]],
        body,
        foot: [["", "", "", "", "TOTAL", fmtEUR(total)]],
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [40, 40, 40] },
        footStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold" },
        columnStyles: { 1: { cellWidth: 90 } },
      });
    }
  }

  const filename = `${input.pedido_proposta ? "pedido_proposta" : "por_subempreitada"}_${input.orcamento_nome.replace(/[^a-z0-9]+/gi, "_")}.pdf`;
  doc.save(filename);
}
