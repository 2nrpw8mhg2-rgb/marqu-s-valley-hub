import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ArtigoMapa } from "@/lib/mapas/pastas";
import { MapaHierarchy } from "./MapaHierarchy";

function artigo(id: string, ordem: number, extra: Partial<ArtigoMapa> = {}): ArtigoMapa {
  return { artigo_id: id, codigo: `1.${ordem}`, descricao: `Descrição integral muito longa do artigo ${id} `.repeat(8), unidade: "m2", quantidade: ordem + 0.5, ordem, capitulo_codigo: "1.1", capitulo_descricao: "Alvenarias", observacoes: null, referencia_documental: null, subempreitada_id: "s1", classificado: true, necessita_revisao: false, validado_manual: true, sugestao_nova_subempreitada: null, confianca: 1, ...extra };
}

function render(expandidos: Set<string> = new Set()) {
  return renderToStaticMarkup(
    <MapaHierarchy
      artigos={[artigo("a", 1), artigo("b", 2, { capitulo_codigo: "2.1", capitulo_descricao: "Pavimentos" })]}
      selecionados={new Set()}
      expandidos={expandidos}
      gruposFechados={new Set()}
      onSelecionar={() => {}}
      onSelecionarTodos={() => {}}
      onExpandirDescricao={() => {}}
      onDetalhes={() => {}}
      onGrupo={() => {}}
    />,
  );
}

describe("estrutura DOM da tabela do mapa", () => {
  const html = render();

  it("renderiza o cabeçalho uma única vez, antes de qualquer linha de artigo", () => {
    expect(html.match(/<thead/g)).toHaveLength(1);
    expect(html.indexOf("<thead")).toBeLessThan(html.indexOf("<tbody"));
    expect(html.indexOf("Descrição original")).toBeLessThan(html.indexOf("Descrição integral"));
    expect(html.indexOf("Quantidade</th>")).toBeLessThan(html.indexOf("Descrição integral"));
  });

  it("cabeçalho e linhas partilham o mesmo esquema de colunas", () => {
    expect(html.match(/<colgroup/g)).toHaveLength(1);
    const colunas = (html.match(/<col[ /]/g) ?? []).length;
    const ths = (html.match(/<th /g) ?? []).length;
    const primeiraLinha = html.split("Descrição integral")[0];
    expect(colunas).toBe(6);
    expect(ths).toBe(6);
    // grupos de capítulo/subcapítulo ocupam a largura total, fora da linha do artigo
    expect(primeiraLinha).toContain('colspan="6"');
  });

  it("cabeçalho sticky abaixo da toolbar, sem posicionamento absoluto nem margens negativas", () => {
    expect(html).toContain("top-[var(--mapa-toolbar-h,0px)]");
    expect(html).not.toContain("absolute");
    expect(html).not.toMatch(/-m[tblrxy]?-\d/);
  });

  it("descrição recolhida usa line-clamp e expandida deixa de usar", () => {
    expect(html).toContain("line-clamp-3");
    const expandido = render(new Set(["a", "b"]));
    expect(expandido).not.toContain("line-clamp-3");
    expect(expandido).toContain("Recolher");
  });
});
