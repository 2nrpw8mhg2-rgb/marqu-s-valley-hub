import { describe, expect, it } from "vitest";
import {
  BREADCRUMBS_BIBLIOTECA,
  DESCRICAO_BIBLIOTECA,
  ROTA_BIBLIOTECA,
  eRotaAdministracao,
  redirecionamentoBiblioteca,
  seccoesVisiveis,
} from "./menu";
import { sections } from "@/components/AppSidebar";

describe("navegação — Administração → Configuração da IA → Biblioteca de Subempreitadas", () => {
  it("remove a entrada «Biblioteca Mestra» do menu principal", () => {
    const titulos = sections.map((s) => s.title);
    expect(titulos).not.toContain("Biblioteca Mestra");
    const rotas = sections.flatMap((s) => s.items.map((i) => i.to));
    expect(rotas.some((r) => r.startsWith("/biblioteca-mestra"))).toBe(false);
  });

  it("mostra o percurso administrativo a perfis autorizados", () => {
    const visiveis = seccoesVisiveis(sections, true);
    const admin = visiveis.find((s) => s.title === "Administração");
    expect(admin).toBeTruthy();
    expect(admin!.items[0].to).toBe("/administracao/configuracao-ia");
    expect(admin!.items[0].descricao).toContain("regras");
  });

  it("oculta Administração a perfis sem permissão", () => {
    const visiveis = seccoesVisiveis(sections, false);
    expect(visiveis.some((s) => s.title === "Administração")).toBe(false);
    // as restantes secções mantêm-se
    expect(visiveis.length).toBe(sections.length - 1);
  });

  it("redireciona as rotas antigas para o novo percurso", () => {
    expect(redirecionamentoBiblioteca("/biblioteca-mestra")).toBe(ROTA_BIBLIOTECA);
    expect(redirecionamentoBiblioteca("/biblioteca-mestra/")).toBe(ROTA_BIBLIOTECA);
    expect(redirecionamentoBiblioteca("/biblioteca-mestra/artigos")).toBe(`${ROTA_BIBLIOTECA}/artigos`);
    expect(redirecionamentoBiblioteca("/biblioteca-mestra/knowledge-builder")).toBe(
      `${ROTA_BIBLIOTECA}/knowledge-builder`,
    );
  });

  it("tem breadcrumbs e título coerentes", () => {
    expect(BREADCRUMBS_BIBLIOTECA.map((c) => c.label)).toEqual([
      "Administração",
      "Configuração da IA",
      "Biblioteca de Subempreitadas",
    ]);
    expect(BREADCRUMBS_BIBLIOTECA[2].label).not.toContain("Mestra");
    expect(DESCRICAO_BIBLIOTECA).toContain("Configuração avançada");
  });

  it("identifica rotas da área de administração", () => {
    expect(eRotaAdministracao("/administracao")).toBe(true);
    expect(eRotaAdministracao(ROTA_BIBLIOTECA)).toBe(true);
    expect(eRotaAdministracao("/obras")).toBe(false);
    expect(eRotaAdministracao("/administracaox")).toBe(false);
  });
});
