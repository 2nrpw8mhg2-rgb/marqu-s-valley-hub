import { describe, expect, it } from "vitest";
import {
  LIMIAR_CONFIANCA,
  aplicarAtribuicaoOtimista,
  construirAuditoria,
  exigeRevisao,
  listarARever,
  podeValidarSeparacao,
  reverterAtribuicao,
  snapshotDe,
  type LinhaRevisao,
} from "./revisao";

function linha(over: Partial<LinhaRevisao> = {}): LinhaRevisao {
  return {
    artigo_id: over.artigo_id ?? "art-1",
    codigo: "1.1",
    descricao: "Betonilha de regularização em pavimento interior",
    unidade: "m2",
    quantidade: 10,
    capitulo_codigo: "1",
    capitulo_descricao: "Pavimentos",
    classificado: true,
    subempreitada_id: "sub-betao",
    subempreitada_ia_id: "sub-betao",
    confianca: 0.9,
    confianca_ia: 0.9,
    necessita_revisao: false,
    validado_manual: false,
    sugestao_nova_subempreitada: null,
    ...over,
  };
}

describe("critério de «A Rever»", () => {
  it("inclui marcados para revisão, sem subempreitada, com sugestão nova ou confiança baixa", () => {
    expect(exigeRevisao(linha({ necessita_revisao: true }))).toBe(true);
    expect(exigeRevisao(linha({ subempreitada_id: null }))).toBe(true);
    expect(exigeRevisao(linha({ sugestao_nova_subempreitada: "Microbetão" }))).toBe(true);
    expect(exigeRevisao(linha({ confianca: LIMIAR_CONFIANCA - 0.01 }))).toBe(true);
    expect(exigeRevisao(linha())).toBe(false);
    expect(exigeRevisao(linha({ necessita_revisao: true, validado_manual: true }))).toBe(false);
  });

  it("não inclui artigos ainda não processados pela IA (pendentes)", () => {
    const pendente = linha({
      artigo_id: "pendente-1",
      classificado: false,
      subempreitada_id: null,
      confianca: 0,
    });
    expect(exigeRevisao(pendente)).toBe(false);
    expect(listarARever([pendente])).toHaveLength(0);
  });

  it("ordena por menor confiança primeiro e respeita pesquisa e filtros", () => {
    const linhas = [
      linha({ artigo_id: "a", confianca: 0.65, codigo: "2.1", descricao: "Pintura de paredes" }),
      linha({ artigo_id: "b", confianca: 0.2, necessita_revisao: true, descricao: "Cofragem de pilares" }),
      linha({ artigo_id: "c", confianca: 0.4, subempreitada_id: null, capitulo_codigo: "9" }),
    ];
    expect(listarARever(linhas).map((l) => l.artigo_id)).toEqual(["b", "c", "a"]);
    expect(listarARever(linhas, { pesquisa: "cofragem" }).map((l) => l.artigo_id)).toEqual(["b"]);
    expect(listarARever(linhas, { capitulo: "9" }).map((l) => l.artigo_id)).toEqual(["c"]);
    expect(listarARever(linhas, { sugestao: "sem" })).toHaveLength(0);
  });
});

describe("atribuição manual", () => {
  it("atribui um artigo e retira-o de «A Rever»", () => {
    const linhas = [linha({ artigo_id: "a", necessita_revisao: true })];
    const depois = aplicarAtribuicaoOtimista(linhas, ["a"], "sub-pintura");
    expect(depois[0].subempreitada_id).toBe("sub-pintura");
    expect(depois[0].validado_manual).toBe(true);
    expect(depois[0].necessita_revisao).toBe(false);
    expect(listarARever(depois)).toHaveLength(0);
  });

  it("atribui 50 artigos à mesma subempreitada", () => {
    const linhas = Array.from({ length: 50 }, (_, i) =>
      linha({ artigo_id: `a-${i}`, necessita_revisao: true }),
    );
    const ids = linhas.map((l) => l.artigo_id);
    const depois = aplicarAtribuicaoOtimista(linhas, ids, "sub-estaleiro");
    expect(depois.filter((l) => l.subempreitada_id === "sub-estaleiro")).toHaveLength(50);
    expect(new Set(depois.map((l) => l.subempreitada_id)).size).toBe(1);
    expect(listarARever(depois)).toHaveLength(0);
  });

  it("desfazer e rollback de erro repõem exatamente os valores anteriores", () => {
    const linhas = [
      linha({ artigo_id: "a", necessita_revisao: true, confianca: 0.3, sugestao_nova_subempreitada: "Microbetão" }),
      linha({ artigo_id: "b", subempreitada_id: null, confianca: 0.1 }),
    ];
    const antes = snapshotDe(linhas, ["a", "b"]);
    const depois = aplicarAtribuicaoOtimista(linhas, ["a", "b"], "sub-x");
    const revertido = reverterAtribuicao(depois, antes);
    expect(revertido).toEqual(linhas);
    expect(listarARever(revertido)).toHaveLength(2);
    // Idempotente: repetir o desfazer não altera nada.
    expect(reverterAtribuicao(revertido, antes)).toEqual(linhas);
  });
});

describe("aprendizagem validada", () => {
  it("preserva a sugestão e a confiança originais da IA", () => {
    const l = linha({ subempreitada_ia_id: "sub-betao", confianca_ia: 0.42, confianca: 0.42, necessita_revisao: true });
    const reg = construirAuditoria(l, "sub-ceramica", "op-1");
    expect(reg.subempreitada_ia_id).toBe("sub-betao");
    expect(reg.confianca_ia).toBe(0.42);
    expect(reg.subempreitada_atribuida_id).toBe("sub-ceramica");
    expect(reg.descricao_original).toBe(l.descricao);
    expect(reg.estado_anterior.subempreitada_id).toBe("sub-betao");
  });
});

describe("bloqueio de «Validar Separação»", () => {
  it("bloqueia com pendentes, falhados ou artigos a rever", () => {
    expect(podeValidarSeparacao({ total: 338, pendentes: 198, falhados: 0, a_rever: 10 })).toBe(false);
    expect(podeValidarSeparacao({ total: 338, pendentes: 0, falhados: 1, a_rever: 0 })).toBe(false);
    expect(podeValidarSeparacao({ total: 338, pendentes: 0, falhados: 0, a_rever: 3 })).toBe(false);
    expect(podeValidarSeparacao({ total: 338, pendentes: 0, falhados: 0, a_rever: 0 })).toBe(true);
  });
});
