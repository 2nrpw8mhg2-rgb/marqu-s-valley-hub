/**
 * Exportação PDF profissional de um mapa por subempreitada.
 *
 * As descrições originais são impressas na íntegra (com quebra de linha),
 * o cabeçalho repete-se em cada página e o rodapé numera as páginas.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PastaMapa } from "./pastas";
import type { MetaMapa } from "./excel";

export const CABECALHOS_PDF = ["Código", "Descrição", "Un.", "Quantidade"] as const;

export function metadadosPDF(pasta: PastaMapa, meta: MetaMapa): string[] {
  return [
    `Obra: ${meta.obra_nome}`,
    `Cliente: ${meta.obra_cliente ?? "—"}`,
    `Subempreitada: ${pasta.etiqueta}`,
    `Data de emissão: ${meta.data}`,
    `Versão: ${meta.versao}`,
    `Estado: ${meta.provisorio ? "PROVISÓRIO" : "VALIDADO"}`,
    `Total de artigos: ${pasta.total}`,
  ];
}

/** Corpo da tabela: descrições integrais, sem cortes nem reescrita. */
export function linhasTabelaPDF(pasta: PastaMapa): string[][] {
  return pasta.artigos.map((a) => [
    a.codigo ?? "",
    a.descricao,
    a.unidade ?? "",
    String(a.quantidade),
  ]);
}

export function construirPDFMapa(pasta: PastaMapa, meta: MetaMapa): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const larguraPag = doc.internal.pageSize.getWidth();
  const alturaPag = doc.internal.pageSize.getHeight();

  doc.setFontSize(14);
  doc.text("Mapa de Quantidades para Consulta", 14, 16);
  doc.setFontSize(9);
  metadadosPDF(pasta, meta).forEach((linha, i) => doc.text(linha, 14, 23 + i * 4.6));

  if (meta.provisorio) {
    doc.setTextColor(200, 120, 0);
    doc.setFontSize(11);
    doc.text("PROVISÓRIO", larguraPag - 14, 16, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }

  autoTable(doc, {
    startY: 23 + metadadosPDF(pasta, meta).length * 4.6 + 4,
    head: [[...CABECALHOS_PDF]],
    body: linhasTabelaPDF(pasta),
    styles: { fontSize: 8, cellPadding: 1.8, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [40, 40, 40] },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 120 }, 2: { cellWidth: 14 }, 3: { cellWidth: 24, halign: "right" } },
    margin: { top: 18, bottom: 16 },
    showHead: "everyPage",
    didDrawPage: () => {
      const pagina = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`${meta.obra_nome} · ${pasta.etiqueta}`, 14, alturaPag - 8);
      doc.text(`Página ${pagina}`, larguraPag - 14, alturaPag - 8, { align: "right" });
      doc.setTextColor(0);
    },
  });

  return doc;
}

export function pdfMapaBytes(pasta: PastaMapa, meta: MetaMapa): Uint8Array {
  return new Uint8Array(construirPDFMapa(pasta, meta).output("arraybuffer") as ArrayBuffer);
}
