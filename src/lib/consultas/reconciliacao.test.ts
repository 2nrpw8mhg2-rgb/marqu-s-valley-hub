import { describe, expect, it } from "vitest";
import {
  TAMANHO_LOTE_PADRAO,
  dividirEmLotes,
  idsPendentes,
  reconciliar,
  resumoCobertura,
  tamanhoRetentativa,
} from "./reconciliacao";

function ids(n: number, prefixo = "a") {
  return Array.from({ length: n }, (_, i) => `${prefixo}-${String(i).padStart(4, "0")}`);
}

describe("cenário real da run 66c42c50 (338 artigos, 140 classificados)", () => {
  const mq = ids(338);
  const classificados = mq.slice(0, 140);

  it("calcula exatamente 198 artigos pendentes", () => {
    const pendentes = idsPendentes(mq, classificados);
    expect(pendentes).toHaveLength(198);
    expect(pendentes[0]).toBe(mq[140]);
    expect(new Set(pendentes).size).toBe(198);
    expect(pendentes.some((id) => classificados.includes(id))).toBe(false);
  });

  it("gera 20 lotes de 10 artigos para os pendentes", () => {
    const lotes = dividirEmLotes(idsPendentes(mq, classificados), TAMANHO_LOTE_PADRAO);
    expect(lotes).toHaveLength(20);
    expect(lotes.flat()).toHaveLength(198);
    expect(lotes[lotes.length - 1]).toHaveLength(8);
  });

  it("mantém a invariante MQ = classificados + pendentes + falhados", () => {
    const r = resumoCobertura({ total: 338, classificados: 140, pendentes: 198, falhados: 0 });
    expect(r.invariante_ok).toBe(true);
    expect(r.completo).toBe(false);
    expect(r.percentagem).toBeCloseTo(41.4, 1);
  });

  it("só fica completa quando não há pendentes nem falhados", () => {
    expect(resumoCobertura({ total: 338, classificados: 338, pendentes: 0, falhados: 0 }).completo).toBe(true);
    expect(resumoCobertura({ total: 338, classificados: 337, pendentes: 0, falhados: 1 }).completo).toBe(false);
  });
});

describe("reconciliação por ID", () => {
  it("devolve apenas os ausentes quando a IA omite artigos", () => {
    const enviados = ids(10);
    const recebidos = enviados.slice(0, 7).map((artigo_id) => ({ artigo_id }));
    const r = reconciliar(enviados, recebidos);
    expect(r.validos).toHaveLength(7);
    expect(r.ausentes).toEqual(enviados.slice(7));
  });

  it("rejeita IDs desconhecidos e duplicados sem perder artigos", () => {
    const enviados = ids(3);
    const r = reconciliar(enviados, [
      { artigo_id: enviados[0] },
      { artigo_id: enviados[0] },
      { artigo_id: "inexistente" },
      { artigo_id: enviados[1] },
    ]);
    expect(r.validos.map((v) => v.artigo_id)).toEqual([enviados[0], enviados[1]]);
    expect(r.duplicados).toEqual([enviados[0]]);
    expect(r.desconhecidos).toEqual(["inexistente"]);
    expect(r.ausentes).toEqual([enviados[2]]);
  });

  it("reduz o lote em cada tentativa até ao artigo individual", () => {
    expect(tamanhoRetentativa(0, 10)).toBe(5);
    expect(tamanhoRetentativa(1, 5)).toBe(3);
    expect(tamanhoRetentativa(2, 3)).toBe(1);
  });
});

describe("cardinalidade", () => {
  it("permite muitos artigos na mesma subempreitada e um só registo por artigo", () => {
    const enviados = ids(50);
    const recebidos = enviados.map((artigo_id) => ({ artigo_id, subempreitada_codigo: "ESTAL" }));
    const r = reconciliar(enviados, recebidos);
    expect(r.validos).toHaveLength(50);
    expect(r.ausentes).toHaveLength(0);
    expect(new Set(r.validos.map((v) => v.artigo_id)).size).toBe(50);
    expect(new Set(r.validos.map((v) => v.subempreitada_codigo)).size).toBe(1);
  });
});
