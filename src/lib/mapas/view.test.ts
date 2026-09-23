import { describe, expect, it } from "vitest";
import type { ArtigoMapa } from "./pastas";
import { ajustarSelecaoVisivel, agruparArtigos, filtrarOrdenarArtigos, hierarquiaArtigo, MAPA_SEARCH_DEFAULTS, opcoesHierarquia, paginarArtigos, resumoQuantidade, validarMapaSearch } from "./view";

function artigo(id: string, ordem: number, extra: Partial<ArtigoMapa> = {}): ArtigoMapa {
  return { artigo_id: id, codigo: `${ordem}`, descricao: `Descrição integral ${id}`, unidade: "m2", quantidade: ordem + 0.123456, ordem, capitulo_codigo: "1.1", capitulo_descricao: "Paredes", observacoes: null, referencia_documental: null, subempreitada_id: "s1", classificado: true, necessita_revisao: false, validado_manual: true, sugestao_nova_subempreitada: null, confianca: 1, ...extra };
}

describe("vista reutilizável do mapa", () => {
  it("agrupa capítulo, subcapítulo e grupos sem classificação hierárquica", () => {
    const grupos = agruparArtigos([artigo("a", 1), artigo("b", 2, { capitulo_codigo: null, capitulo_descricao: null })]);
    expect(grupos.map((g) => g.nome)).toEqual(["1", "Sem capítulo"]);
    expect(grupos[0].subcapitulos[0].nome).toBe("1.1 Paredes");
    expect(grupos[1].subcapitulos[0].nome).toBe("Sem subcapítulo");
  });

  it("mantém ordem original por omissão e ordena apenas dentro dos grupos", () => {
    const base = [artigo("b", 2, { codigo: "B" }), artigo("a", 1, { codigo: "Z" }), artigo("c", 3, { codigo: "A", capitulo_codigo: "2.1" })];
    expect(filtrarOrdenarArtigos(base, MAPA_SEARCH_DEFAULTS).map((a) => a.artigo_id)).toEqual(["a", "b", "c"]);
    expect(filtrarOrdenarArtigos(base, { ...MAPA_SEARCH_DEFAULTS, ordenar: "codigo" }).map((a) => a.artigo_id)).toEqual(["b", "a", "c"]);
  });

  it("pesquisa código/descrição e aplica filtros dependentes", () => {
    const base = [artigo("a", 1, { descricao: "Tubagem de água" }), artigo("b", 2, { capitulo_codigo: "2.1", capitulo_descricao: "Pintura" })];
    expect(filtrarOrdenarArtigos(base, { ...MAPA_SEARCH_DEFAULTS, q: "AGUA" }).map((a) => a.artigo_id)).toEqual(["a"]);
    expect(opcoesHierarquia(base, "1").subcapitulos.map((o) => o.id)).toEqual(["1.1"]);
    expect(filtrarOrdenarArtigos(base, { ...MAPA_SEARCH_DEFAULTS, capitulo: "2" }).map((a) => a.artigo_id)).toEqual(["b"]);
  });

  it("só soma quantidades com unidades compatíveis", () => {
    expect(resumoQuantidade([artigo("a", 1), artigo("b", 2)])).toContain("m2");
    expect(resumoQuantidade([artigo("a", 1), artigo("b", 2, { unidade: "un" })])).toBeNull();
  });

  it("valida e normaliza pesquisa do URL", () => {
    expect(validarMapaSearch({ q: "x", ordenar: "quantidade", direcao: "desc", pagina: "3", tamanho: "50", artigo: "a" })).toMatchObject({ q: "x", ordenar: "quantidade", direcao: "desc", pagina: 3, tamanho: 50, artigo: "a" });
    expect(validarMapaSearch({ pagina: -2, tamanho: 999 })).toEqual(MAPA_SEARCH_DEFAULTS);
  });

  it("pagina 1000 artigos sem devolver a lista integral", () => {
    const base = Array.from({ length: 1000 }, (_, i) => artigo(`a${i}`, i));
    const pagina = paginarArtigos(base, 20, 50);
    expect(pagina.artigos).toHaveLength(50);
    expect(pagina.artigos[0].artigo_id).toBe("a950");
    expect(pagina.totalPaginas).toBe(20);
  });

  it("ajusta seleção e nunca mantém artigos invisíveis", () => {
    const visiveis = [artigo("a", 1), artigo("b", 2)];
    expect([...ajustarSelecaoVisivel(new Set(["a", "x"]), visiveis)]).toEqual(["a"]);
  });

  it("preserva IDs e descrições integrais", () => {
    const longa = "Descrição ".repeat(100);
    const a = artigo("original", 1, { descricao: longa });
    const resultado = filtrarOrdenarArtigos([a], MAPA_SEARCH_DEFAULTS)[0];
    expect(resultado.artigo_id).toBe("original");
    expect(resultado.descricao).toBe(longa);
    expect(hierarquiaArtigo(resultado).subcapitulo).toBe("1.1 Paredes");
  });
});