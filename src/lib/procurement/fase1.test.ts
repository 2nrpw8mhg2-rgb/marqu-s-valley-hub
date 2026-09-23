import { describe, expect, it } from "vitest";
import type { ArtigoMapa, SubempreitadaRef } from "@/lib/mapas/pastas";
import {
  alertasPacote,
  ambitoPreenchido,
  AMBITO_VAZIO,
  artigoElegivel,
  diffVersaoMQ,
  estadoSugerido,
  etiquetaVersao,
  filtrarOrdenarPacotes,
  metricasProcurement,
  pacotesEsperados,
  rotuloEstado,
  type LinhaPacote,
} from "./fase1";

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
    atualizado_em: "2026-09-01T10:00:00Z",
    ...p,
  } as ArtigoMapa;
}

function linha(p: Partial<LinhaPacote> & { id: string }): LinhaPacote {
  return {
    nome: "Pacote",
    subempreitada_id: "s1",
    estado: "por_preparar",
    origem: "classificacao_subempreitada",
    responsavel_id: null,
    artigos: 5,
    mq_revisao: "Rev. 01",
    empresas: 0,
    consultas_enviadas: 0,
    respostas: 0,
    atualizado_em: "2026-09-01T10:00:00Z",
    alertas: [],
    ...p,
  };
}

describe("pacotes esperados", () => {
  const subs: SubempreitadaRef[] = [
    { id: "s1", codigo: "PINT", nome: "Pinturas" },
    { id: "s2", codigo: "ALV", nome: "Alvenarias" },
    { id: "s3", codigo: "VAZI", nome: "Sem artigos" },
  ];

  it("cria exatamente um pacote por subempreitada com artigos elegíveis", () => {
    const pacotes = pacotesEsperados(
      [
        artigo({ artigo_id: "a1", ordem: 1 }),
        artigo({ artigo_id: "a2", ordem: 2 }),
        artigo({ artigo_id: "a3", ordem: 3, subempreitada_id: "s2" }),
      ],
      subs,
    );
    expect(pacotes).toHaveLength(2);
    expect(pacotes.map((p) => p.nome)).toEqual(["Alvenarias", "Pinturas"]);
    expect(pacotes.find((p) => p.subempreitada_id === "s1")!.total).toBe(2);
  });

  it("nunca cria pacotes vazios", () => {
    expect(pacotesEsperados([], subs)).toHaveLength(0);
    expect(pacotesEsperados([artigo({ artigo_id: "a1", ordem: 1 })], subs).some((p) => p.total === 0)).toBe(false);
  });

  it("exclui pendentes, falhados e artigos a rever", () => {
    const pacotes = pacotesEsperados(
      [
        artigo({ artigo_id: "ok", ordem: 1 }),
        artigo({ artigo_id: "pendente", ordem: 2, classificado: false, subempreitada_id: null }),
        artigo({ artigo_id: "rever", ordem: 3, necessita_revisao: true }),
      ],
      subs,
    );
    expect(pacotes).toHaveLength(1);
    expect(pacotes[0].artigos.map((a) => a.artigo_id)).toEqual(["ok"]);
    expect(artigoElegivel(artigo({ artigo_id: "x", ordem: 1, necessita_revisao: true }))).toBe(false);
  });

  it("24 subempreitadas válidas produzem 24 pacotes", () => {
    const muitas: SubempreitadaRef[] = Array.from({ length: 24 }, (_, i) => ({
      id: `sub${i}`,
      codigo: `C${i}`,
      nome: `Subempreitada ${String(i).padStart(2, "0")}`,
    }));
    const artigos = muitas.map((s, i) => artigo({ artigo_id: `a${i}`, ordem: i, subempreitada_id: s.id }));
    expect(pacotesEsperados(artigos, muitas)).toHaveLength(24);
  });

  it("acompanha dinamicamente alterações do MQ antes do envio", () => {
    const antes = pacotesEsperados([artigo({ artigo_id: "a1", ordem: 1 })], subs);
    const depois = pacotesEsperados(
      [artigo({ artigo_id: "a1", ordem: 1, subempreitada_id: "s2" })],
      subs,
    );
    expect(antes[0].subempreitada_id).toBe("s1");
    expect(depois[0].subempreitada_id).toBe("s2");
  });

  it("preserva ordem original e dados originais dos artigos", () => {
    const pacotes = pacotesEsperados(
      [artigo({ artigo_id: "a2", ordem: 5 }), artigo({ artigo_id: "a1", ordem: 1, quantidade: 3.25 })],
      subs,
    );
    expect(pacotes[0].artigos.map((a) => a.artigo_id)).toEqual(["a1", "a2"]);
    expect(pacotes[0].artigos[0].quantidade).toBe(3.25);
  });
});

describe("métricas", () => {
  it("são zero quando não existem pacotes", () => {
    expect(metricasProcurement([])).toEqual({
      total: 0,
      por_preparar: 0,
      em_preparacao: 0,
      consultas_enviadas: 0,
      propostas_recebidas: 0,
      em_comparacao: 0,
      adjudicadas: 0,
      alertas: 0,
    });
  });

  it("contam estados e pendências reais", () => {
    const m = metricasProcurement([
      linha({ id: "p1" }),
      linha({ id: "p2", estado: "em_preparacao", alertas: ["Sem empresas selecionadas"] }),
      linha({ id: "p3", estado: "pronto_envio" }),
    ]);
    expect(m.total).toBe(3);
    expect(m.por_preparar).toBe(1);
    expect(m.em_preparacao).toBe(2);
    expect(m.consultas_enviadas).toBe(0);
    expect(m.propostas_recebidas).toBe(0);
    expect(m.alertas).toBe(1);
  });
});

describe("lista de pacotes", () => {
  const linhas = [
    linha({ id: "p1", nome: "Pinturas", artigos: 10 }),
    linha({ id: "p2", nome: "Alvenarias", artigos: 48, estado: "em_preparacao", responsavel_id: "u1" }),
  ];

  it("pesquisa sem acentos e filtra por estado e responsável", () => {
    expect(filtrarOrdenarPacotes(linhas, { q: "alven" }).map((l) => l.id)).toEqual(["p2"]);
    expect(filtrarOrdenarPacotes(linhas, { estado: "em_preparacao" }).map((l) => l.id)).toEqual(["p2"]);
    expect(filtrarOrdenarPacotes(linhas, { responsavel: "sem" }).map((l) => l.id)).toEqual(["p1"]);
  });

  it("ordena por nome e por número de artigos", () => {
    expect(filtrarOrdenarPacotes(linhas, {}).map((l) => l.nome)).toEqual(["Alvenarias", "Pinturas"]);
    expect(filtrarOrdenarPacotes(linhas, { ordenar: "artigos", direcao: "desc" }).map((l) => l.artigos)).toEqual([48, 10]);
  });

  it("traduz os estados para português", () => {
    expect(rotuloEstado("pronto_envio")).toBe("Pronto para envio");
    expect(rotuloEstado("por_preparar")).toBe("Por preparar");
  });
});

describe("pendências e estado de preparação", () => {
  it("lista as pendências reais do pacote", () => {
    expect(alertasPacote({ artigos: 5, empresas: 0, documentos: 0, ambito_preenchido: false })).toEqual([
      "Sem empresas selecionadas",
      "Documentação em falta",
      "Âmbito por definir",
    ]);
    expect(alertasPacote({ artigos: 5, empresas: 1, documentos: 1, ambito_preenchido: true })).toEqual([]);
    expect(
      alertasPacote({ artigos: 5, empresas: 1, documentos: 1, ambito_preenchido: true, mq_alterado: true }),
    ).toEqual(["MQ alterado"]);
  });

  it("sugere o estado a partir da preparação real", () => {
    expect(estadoSugerido({ estado: "por_preparar", empresas: 0, documentos: 0, ambito_preenchido: false })).toBe("por_preparar");
    expect(estadoSugerido({ estado: "por_preparar", empresas: 1, documentos: 0, ambito_preenchido: false })).toBe("em_preparacao");
    expect(estadoSugerido({ estado: "em_preparacao", empresas: 2, documentos: 1, ambito_preenchido: true })).toBe("pronto_envio");
    expect(estadoSugerido({ estado: "adjudicado", empresas: 2, documentos: 1, ambito_preenchido: true })).toBeNull();
  });
});

describe("versões e congelamento", () => {
  const snapshot = [
    { artigo_id: "a1", quantidade: 10, descricao: "Pintura" },
    { artigo_id: "a2", quantidade: 5, descricao: "Estuque" },
  ];

  it("uma versão congelada não muda quando o MQ muda", () => {
    const copia = JSON.parse(JSON.stringify(snapshot));
    diffVersaoMQ(snapshot, [{ artigo_id: "a1", quantidade: 99, descricao: "Pintura" }]);
    expect(snapshot).toEqual(copia);
  });

  it("deteta adições, remoções e alterações de quantidade e descrição", () => {
    const d = diffVersaoMQ(snapshot, [
      { artigo_id: "a1", quantidade: 12, descricao: "Pintura nova" },
      { artigo_id: "a3", quantidade: 1, descricao: "Novo" },
    ]);
    expect(d.alterado).toBe(true);
    expect(d.adicionados).toEqual(["a3"]);
    expect(d.removidos).toEqual(["a2"]);
    expect(d.quantidades_alteradas).toEqual([{ artigo_id: "a1", antes: 10, depois: 12 }]);
    expect(d.descricoes_alteradas).toEqual(["a1"]);
  });

  it("sem alterações não há diferença", () => {
    expect(diffVersaoMQ(snapshot, snapshot).alterado).toBe(false);
  });

  it("etiqueta a consulta e a revisão do MQ", () => {
    expect(etiquetaVersao(1, 1)).toBe("Consulta 01 / MQ Rev. 01");
    expect(etiquetaVersao(2, 12)).toBe("Consulta 02 / MQ Rev. 12");
  });
});

describe("âmbito da consulta", () => {
  it("é uma camada do pacote e não altera o MQ", () => {
    const artigos = [artigo({ artigo_id: "a1", ordem: 1 })];
    const copia = JSON.parse(JSON.stringify(artigos));
    const ambito = { ...AMBITO_VAZIO, ambito_geral: "Fornecimento e montagem" };
    expect(ambitoPreenchido(ambito)).toBe(true);
    expect(ambitoPreenchido(AMBITO_VAZIO)).toBe(false);
    expect(artigos).toEqual(copia);
  });
});
