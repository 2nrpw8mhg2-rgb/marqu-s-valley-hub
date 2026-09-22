import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { unzipSync } from "fflate";
import {
  derivarCapitulos,
  derivarPastas,
  estadoMapas,
  filtrarPastas,
  nomeFicheiroMapa,
  protegerTextoExcel,
  reconciliarPastas,
  sanitizarNomeFicheiro,
  type ArtigoMapa,
  type SubempreitadaRef,
} from "./pastas";
import { CABECALHOS_EXCEL, LINHA_CABECALHO, construirFolhaMapa, excelMapaBytes, type MetaMapa } from "./excel";
import { linhasTabelaPDF, metadadosPDF, pdfMapaBytes } from "./pdf";
import { arvoreZip, gerarZipMapas } from "./zip";

const SUBS: SubempreitadaRef[] = [
  { id: "s1", codigo: "PINT", nome: "Pinturas" },
  { id: "s2", codigo: "ELEC", nome: "Eletricidade" },
  { id: "s3", codigo: "VAZI", nome: "Sem artigos" },
];

const DESCRICAO_LONGA =
  "Fornecimento e aplicação de pintura em paredes interiores, incluindo preparação do suporte, primário, duas demãos de tinta plástica lavável, proteção de superfícies adjacentes, limpeza final e todos os trabalhos e materiais acessórios necessários ao perfeito acabamento, de acordo com o caderno de encargos e as peças desenhadas do projeto de arquitetura.";

function artigo(p: Partial<ArtigoMapa> & { artigo_id: string; ordem: number }): ArtigoMapa {
  return {
    codigo: "1.1",
    descricao: "Artigo",
    unidade: "m2",
    quantidade: 10,
    capitulo_codigo: "1",
    capitulo_descricao: "Trabalhos",
    observacoes: null,
    subempreitada_id: "s1",
    classificado: true,
    necessita_revisao: false,
    validado_manual: true,
    sugestao_nova_subempreitada: null,
    confianca: 0.95,
    atualizado_em: "2026-01-01T10:00:00Z",
    ...p,
  };
}

const META: MetaMapa = {
  obra_nome: "Moradia Foz / Porto",
  obra_cliente: "Cliente SA",
  orcamento_nome: "MQ v1",
  data: "01/02/2026",
  provisorio: true,
  versao: "01/02/2026",
};

describe("pastas derivadas", () => {
  it("só cria pastas para subempreitadas com artigos", () => {
    const artigos = [artigo({ artigo_id: "a1", ordem: 1 }), artigo({ artigo_id: "a2", ordem: 2, subempreitada_id: "s2" })];
    const pastas = derivarPastas(artigos, SUBS);
    expect(pastas.map((p) => p.subempreitada_id).sort()).toEqual(["s1", "s2"]);
    expect(pastas.find((p) => p.subempreitada_id === "s3")).toBeUndefined();
  });

  it("reconcilia sem perdas nem duplicados e preserva a ordem original", () => {
    const artigos = [
      artigo({ artigo_id: "a3", ordem: 3 }),
      artigo({ artigo_id: "a1", ordem: 1 }),
      artigo({ artigo_id: "a2", ordem: 2 }),
      artigo({ artigo_id: "a4", ordem: 4, subempreitada_id: null, classificado: false, validado_manual: false }),
    ];
    const pastas = derivarPastas(artigos, SUBS);
    expect(pastas[0].artigos.map((a) => a.artigo_id)).toEqual(["a1", "a2", "a3"]);
    const r = reconciliarPastas(artigos, pastas);
    expect(r).toMatchObject({ total_mq: 4, em_pastas: 3, sem_classificacao: 1, duplicados: [], ok: true });
  });

  it("mantém a descrição integral e o artigo numa única pasta após reatribuição", () => {
    const a = artigo({ artigo_id: "a1", ordem: 1, descricao: DESCRICAO_LONGA });
    const antes = derivarPastas([a], SUBS);
    expect(antes[0].artigos[0].descricao).toBe(DESCRICAO_LONGA);
    const depois = derivarPastas([{ ...a, subempreitada_id: "s2" }], SUBS);
    expect(depois).toHaveLength(1);
    expect(depois[0].subempreitada_id).toBe("s2");
  });

  it("marca provisório enquanto houver pendentes, falhados ou a rever", () => {
    expect(estadoMapas({ pendentes: 0, falhados: 0, a_rever: 0 }).provisorio).toBe(false);
    expect(estadoMapas({ pendentes: 0, falhados: 0, a_rever: 3 })).toMatchObject({ provisorio: true });
    expect(estadoMapas({ pendentes: 198, falhados: 1, a_rever: 0 }).motivos).toHaveLength(2);
  });

  it("distingue pasta validada de provisória", () => {
    const pastas = derivarPastas(
      [
        artigo({ artigo_id: "a1", ordem: 1 }),
        artigo({ artigo_id: "a2", ordem: 2, validado_manual: false, necessita_revisao: true }),
      ],
      SUBS,
    );
    expect(pastas[0].validada).toBe(false);
  });

  it("pesquisa e ordena as pastas", () => {
    const artigos = [artigo({ artigo_id: "a1", ordem: 1 }), artigo({ artigo_id: "a2", ordem: 2, subempreitada_id: "s2" })];
    const pastas = derivarPastas(artigos, SUBS);
    expect(filtrarPastas(pastas, "", "az")[0].codigo).toBe("ELEC");
    expect(filtrarPastas(pastas, "", "za")[0].codigo).toBe("PINT");
    expect(filtrarPastas(pastas, "pint", "az").map((p) => p.codigo)).toEqual(["PINT"]);
    expect(filtrarPastas(pastas, "inexistente", "az")).toHaveLength(0);
  });

  it("deriva capítulo e subcapítulo do código hierárquico", () => {
    expect(derivarCapitulos(artigo({ artigo_id: "a", ordem: 1, capitulo_codigo: "2.3" }))).toEqual({
      capitulo: "2",
      subcapitulo: "2.3 Trabalhos",
    });
  });

  it("sanitiza nomes de ficheiro e limita o comprimento", () => {
    // Sem separadores de caminho nem acentos; o nome não pode começar por «.» ou «_».
    expect(sanitizarNomeFicheiro("../Obra Ré/x*?")).toBe("Obra_Re_x");
    expect(sanitizarNomeFicheiro("a".repeat(200)).length).toBe(60);
    expect(nomeFicheiroMapa("Moradia Foz / Porto", "PINT · Pinturas", "xlsx")).toBe(
      "Moradia_Foz_Porto_PINT_Pinturas.xlsx",
    );
  });
});

describe("Excel", () => {
  const pasta = derivarPastas(
    [
      artigo({ artigo_id: "a1", ordem: 1, descricao: DESCRICAO_LONGA, quantidade: 12.5 }),
      artigo({ artigo_id: "a2", ordem: 2, codigo: "=CMD()", descricao: "-1+1 trabalho" }),
    ],
    SUBS,
  )[0];

  const ws = construirFolhaMapa(pasta, META);

  it("tem identificação, cabeçalhos e fórmulas corretas", () => {
    expect(ws["A2"].v).toBe("Obra");
    expect(ws["B2"].v).toBe("Moradia Foz / Porto");
    expect(ws["E4"].v).toBe("PROVISÓRIO");
    CABECALHOS_EXCEL.forEach((h, i) => {
      expect(ws[XLSX.utils.encode_cell({ r: LINHA_CABECALHO - 1, c: i })].v).toBe(h);
    });
    expect(ws["F7"].f).toBe("D7*E7");
    expect(ws["F8"].f).toBe("D8*E8");
    expect(ws["E10"].v).toBe("TOTAL");
    expect(ws["F10"].f).toBe("SUM(F7:F8)");
  });

  it("deixa o preço unitário vazio e não exporta preços internos", () => {
    expect(ws["E7"].v).toBeUndefined();
    const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
    const texto = JSON.stringify(json);
    expect(texto).not.toContain("preco_seco");
    expect(texto).not.toContain("custo");
  });

  it("previne injeção de fórmulas nas descrições e códigos", () => {
    expect(protegerTextoExcel("=1+1")).toBe("'=1+1");
    expect(protegerTextoExcel("@SUM")).toBe("'@SUM");
    expect(protegerTextoExcel("normal")).toBe("normal");
    expect(ws["A8"].v).toBe("'=CMD()");
    expect(ws["B8"].v).toBe("'-1+1 trabalho");
  });

  it("mantém a descrição integral e gera um ficheiro xlsx", () => {
    expect(ws["B7"].v).toBe(DESCRICAO_LONGA);
    const bytes = excelMapaBytes(pasta, META);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });
});

describe("PDF", () => {
  const pasta = derivarPastas([artigo({ artigo_id: "a1", ordem: 1, descricao: DESCRICAO_LONGA })], SUBS)[0];

  it("inclui metadados e selo provisório", () => {
    const meta = metadadosPDF(pasta, META);
    expect(meta).toContain("Obra: Moradia Foz / Porto");
    expect(meta).toContain("Subempreitada: PINT · Pinturas");
    expect(meta).toContain("Data de emissão: 01/02/2026");
    expect(meta).toContain("Estado: PROVISÓRIO");
    expect(metadadosPDF(pasta, { ...META, provisorio: false })).toContain("Estado: VALIDADO");
  });

  it("não trunca descrições longas e gera um PDF válido", () => {
    expect(linhasTabelaPDF(pasta)[0][1]).toBe(DESCRICAO_LONGA);
    const bytes = pdfMapaBytes(pasta, META);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
  });
});

describe("ZIP", () => {
  const pastas = derivarPastas(
    [artigo({ artigo_id: "a1", ordem: 1 }), artigo({ artigo_id: "a2", ordem: 2, subempreitada_id: "s2" })],
    SUBS,
  );

  it("gera a árvore correta nos três modos", () => {
    expect(arvoreZip("Obra X", pastas, "excel")).toHaveLength(2);
    expect(arvoreZip("Obra X", pastas, "pdf")).toHaveLength(2);
    const ambos = arvoreZip("Obra X", pastas, "ambos");
    expect(ambos).toHaveLength(4);
    expect(ambos[0]).toBe("ELEC_Eletricidade/Obra_X_ELEC_Eletricidade.xlsx");
  });

  it("produz um ZIP com os ficheiros esperados e reporta progresso", async () => {
    const progresso: number[] = [];
    const { bytes, relatorio } = await gerarZipMapas(pastas, META, "ambos", (f, t) => {
      progresso.push(Math.round((f / t) * 100));
    });
    expect(relatorio).toMatchObject({ ficheiros: 4, falhas: [], vazio: false });
    expect(progresso[progresso.length - 1]).toBe(100);
    const entradas = Object.keys(unzipSync(bytes!));
    expect(entradas.sort()).toEqual(arvoreZip(META.obra_nome, pastas, "ambos").sort());
  });

  it("trata falhas parciais sem anular o ficheiro", async () => {
    const corrompida = { ...pastas[0], artigos: null as unknown as typeof pastas[0]["artigos"] };
    const { bytes, relatorio } = await gerarZipMapas([corrompida, pastas[1]], META, "excel");
    expect(relatorio.falhas).toHaveLength(1);
    expect(relatorio.ficheiros).toBe(1);
    expect(bytes).not.toBeNull();
  });

  it("devolve relatório vazio quando não há pastas", async () => {
    const { bytes, relatorio } = await gerarZipMapas([], META, "ambos");
    expect(bytes).toBeNull();
    expect(relatorio.vazio).toBe(true);
  });
});
