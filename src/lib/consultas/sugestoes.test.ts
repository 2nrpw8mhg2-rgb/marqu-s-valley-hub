import { describe, expect, it } from "vitest";
import {
  classificarSugestao,
  codigoSugerido,
  encontrarEquivalente,
  normalizarNomeSubempreitada,
  rejeitarSugestaoOtimista,
  sugestaoNovaComum,
} from "./sugestoes";
import { aplicarAtribuicaoOtimista, listarARever, type LinhaRevisao } from "./revisao";
import { construirPastas } from "@/lib/mapas/pastas";

/** Fixtures do caso real, sem tocar nos artigos reais. */
const LAREIRAS = "Lareiras e Braseiras";
const MICROBETAO = "Pavimentos em Betão e Microbetão";

function linha(over: Partial<LinhaRevisao> = {}): LinhaRevisao {
  return {
    artigo_id: "art-1",
    codigo: "1.1",
    descricao: "Fornecimento e montagem de lareira com recuperador de calor",
    unidade: "un",
    quantidade: 1,
    capitulo_codigo: "3",
    capitulo_descricao: "Acabamentos",
    classificado: true,
    subempreitada_id: null,
    subempreitada_ia_id: null,
    confianca: 0.35,
    confianca_ia: 0.35,
    necessita_revisao: true,
    validado_manual: false,
    sugestao_nova_subempreitada: LAREIRAS,
    ...over,
  };
}

const SUBS = [
  { id: "sub-pint", codigo: "PINT", nome: "Pinturas" },
  { id: "sub-betao", codigo: "BETON", nome: "Betão Armado" },
];

describe("normalização e equivalência de nomes", () => {
  it("ignora maiúsculas, acentos e espaços repetidos", () => {
    expect(normalizarNomeSubempreitada("  Pavimentos em BETÃO  e   Microbetão ")).toBe(
      "pavimentos em betao e microbetao",
    );
    const eq = encontrarEquivalente([{ id: "x", codigo: "MICRO", nome: " pavimentos em betao e microbetão " }], MICROBETAO);
    expect(eq?.id).toBe("x");
    expect(encontrarEquivalente(SUBS, LAREIRAS)).toBeNull();
  });

  it("propõe um código legível para a subempreitada nova", () => {
    expect(codigoSugerido(LAREIRAS)).toBe("LAREIRAS");
    expect(codigoSugerido(MICROBETAO)).toBe("PAVIMENT");
    expect(codigoSugerido("   ")).toBe("SUB");
  });
});

describe("classificação da sugestão de cada artigo", () => {
  it("distingue sugestão nova, sugestão existente e ausência de sugestão", () => {
    expect(classificarSugestao(linha(), SUBS)).toEqual({ tipo: "nova", nome: LAREIRAS, equivalente_id: null });
    expect(
      classificarSugestao(linha({ sugestao_nova_subempreitada: "  pinturas " }), SUBS),
    ).toEqual({ tipo: "nova", nome: "pinturas", equivalente_id: "sub-pint" });
    expect(
      classificarSugestao(linha({ sugestao_nova_subempreitada: null, subempreitada_ia_id: "sub-betao" }), SUBS),
    ).toEqual({ tipo: "existente", subempreitada_id: "sub-betao" });
    expect(classificarSugestao(linha({ sugestao_nova_subempreitada: null }), SUBS)).toEqual({ tipo: "nenhuma" });
  });
});

describe("aceitação de sugestões novas", () => {
  it("aceitar uma sugestão nova atribui o artigo e retira-o de «A Rever»", () => {
    const linhas = [linha({ artigo_id: "a" })];
    expect(listarARever(linhas)).toHaveLength(1);
    const depois = aplicarAtribuicaoOtimista(linhas, ["a"], "sub-nova-lareiras");
    expect(depois[0].subempreitada_id).toBe("sub-nova-lareiras");
    expect(listarARever(depois)).toHaveLength(0);
  });

  it("cria a pasta dinâmica correspondente em Mapas por Subempreitada", () => {
    const linhas = aplicarAtribuicaoOtimista([linha({ artigo_id: "a" })], ["a"], "sub-nova-lareiras");
    const pastas = construirPastas(
      linhas.map((l) => ({
        artigo_id: l.artigo_id,
        codigo: l.codigo,
        descricao: l.descricao,
        unidade: l.unidade,
        quantidade: l.quantidade,
        ordem: 1,
        capitulo_codigo: l.capitulo_codigo,
        capitulo_descricao: l.capitulo_descricao,
        subempreitada_id: l.subempreitada_id,
        validado_manual: l.validado_manual,
        necessita_revisao: l.necessita_revisao,
        confianca: l.confianca,
        classificado: l.classificado,
      })) as any,
      [{ id: "sub-nova-lareiras", codigo: "LAREIRAS", nome: LAREIRAS }],
    );
    expect(pastas.pastas.map((p) => p.nome)).toContain(LAREIRAS);
    expect(pastas.pastas.find((p) => p.nome === LAREIRAS)?.artigos).toHaveLength(1);
  });

  it("em massa, artigos com a mesma sugestão nova geram uma única subempreitada", () => {
    const linhas = [
      linha({ artigo_id: "a", sugestao_nova_subempreitada: MICROBETAO }),
      linha({ artigo_id: "b", sugestao_nova_subempreitada: "  pavimentos em betao e MICROBETÃO " }),
    ];
    expect(sugestaoNovaComum(linhas, ["a", "b"])).toBe(MICROBETAO);
    const depois = aplicarAtribuicaoOtimista(linhas, ["a", "b"], "sub-micro");
    expect(new Set(depois.map((l) => l.subempreitada_id))).toEqual(new Set(["sub-micro"]));
  });

  it("não agrupa sugestões diferentes nem artigos sem sugestão", () => {
    const linhas = [
      linha({ artigo_id: "a", sugestao_nova_subempreitada: LAREIRAS }),
      linha({ artigo_id: "b", sugestao_nova_subempreitada: MICROBETAO }),
      linha({ artigo_id: "c", sugestao_nova_subempreitada: null }),
    ];
    expect(sugestaoNovaComum(linhas, ["a", "b"])).toBeNull();
    expect(sugestaoNovaComum(linhas, ["a", "c"])).toBeNull();
    expect(sugestaoNovaComum(linhas, [])).toBeNull();
  });

  it("50 artigos com a mesma sugestão ficam todos na mesma subempreitada", () => {
    const linhas = Array.from({ length: 50 }, (_, i) =>
      linha({ artigo_id: `a-${i}`, sugestao_nova_subempreitada: MICROBETAO }),
    );
    const ids = linhas.map((l) => l.artigo_id);
    expect(sugestaoNovaComum(linhas, ids)).toBe(MICROBETAO);
    const depois = aplicarAtribuicaoOtimista(linhas, ids, "sub-micro");
    expect(depois.filter((l) => l.subempreitada_id === "sub-micro")).toHaveLength(50);
    expect(listarARever(depois)).toHaveLength(0);
  });
});

describe("rejeição de sugestão", () => {
  it("mantém o artigo em «A Rever» e sem subempreitada", () => {
    const linhas = [linha({ artigo_id: "a" })];
    const depois = rejeitarSugestaoOtimista(linhas, "a");
    expect(depois[0].sugestao_nova_subempreitada).toBeNull();
    expect(depois[0].subempreitada_id).toBeNull();
    expect(depois[0].validado_manual).toBe(false);
    expect(listarARever(depois)).toHaveLength(1);
  });

  it("depois de rejeitar, escolher outra subempreitada resolve o artigo", () => {
    const rejeitado = rejeitarSugestaoOtimista([linha({ artigo_id: "a" })], "a");
    const depois = aplicarAtribuicaoOtimista(rejeitado, ["a"], "sub-pint");
    expect(depois[0].subempreitada_id).toBe("sub-pint");
    expect(listarARever(depois)).toHaveLength(0);
  });
});
