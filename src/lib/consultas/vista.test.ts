import { describe, expect, it } from "vitest";
import { aplicarAtribuicaoOtimista, type LinhaRevisao } from "./revisao";
import {
  contarARever,
  linhasDaVista,
  mostraGruposSubempreitada,
  paramsDaVista,
  validarVista,
} from "./vista";

function linha(over: Partial<LinhaRevisao> = {}): LinhaRevisao {
  return {
    artigo_id: "art-1",
    codigo: "1.1",
    descricao: "Betonilha de regularização",
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

const conjunto: LinhaRevisao[] = [
  linha({ artigo_id: "ok", confianca: 0.95 }),
  linha({ artigo_id: "rever", necessita_revisao: true, confianca: 0.3 }),
  linha({ artigo_id: "sem-sub", subempreitada_id: null, confianca: 0.4 }),
  linha({ artigo_id: "pendente", classificado: false, subempreitada_id: null, confianca: 0 }),
  linha({ artigo_id: "validado", validado_manual: true, confianca: 1 }),
];

describe("navegação entre vistas", () => {
  it("«A Rever» mostra exclusivamente os casos de revisão, sem pendentes nem validados", () => {
    const ids = linhasDaVista(conjunto, "arever").map((l) => l.artigo_id);
    expect(ids).toEqual(["rever", "sem-sub"]);
    expect(ids).not.toContain("pendente");
    expect(ids).not.toContain("validado");
    expect(mostraGruposSubempreitada("arever")).toBe(false);
  });

  it("«Todos» restaura a vista completa com grupos de subempreitada", () => {
    expect(linhasDaVista(conjunto, "todos")).toHaveLength(conjunto.length);
    expect(mostraGruposSubempreitada("todos")).toBe(true);
  });

  it("o contador do cartão «A Rever» abre a vista correspondente", () => {
    expect(contarARever(conjunto)).toBe(2);
    expect(paramsDaVista("arever")).toEqual({ vista: "arever" });
    expect(paramsDaVista("todos")).toEqual({});
  });

  it("o URL preserva a vista e valores inválidos voltam a «Todos»", () => {
    expect(validarVista("arever")).toBe("arever");
    expect(validarVista("todos")).toBe("todos");
    expect(validarVista(undefined)).toBe("todos");
    expect(validarVista("qualquer-coisa")).toBe("todos");
  });

  it("ao atribuir, a linha desaparece da vista e o contador decrementa", () => {
    const antes = contarARever(conjunto);
    const depois = aplicarAtribuicaoOtimista(conjunto, ["rever"], "sub-pintura");
    expect(contarARever(depois)).toBe(antes - 1);
    expect(linhasDaVista(depois, "arever").map((l) => l.artigo_id)).toEqual(["sem-sub"]);
    // A vista «Todos» mantém o artigo, agora já com subempreitada.
    expect(linhasDaVista(depois, "todos")).toHaveLength(conjunto.length);
  });

  it("a vista «A Rever» funciona mesmo com artigos pendentes por processar", () => {
    const comPendentes = [...conjunto, linha({ artigo_id: "p2", classificado: false, subempreitada_id: null })];
    expect(linhasDaVista(comPendentes, "arever").map((l) => l.artigo_id)).toEqual(["rever", "sem-sub"]);
  });
});
