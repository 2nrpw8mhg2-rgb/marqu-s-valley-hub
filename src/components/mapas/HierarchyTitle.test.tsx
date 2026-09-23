// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HierarchyTitle } from "./HierarchyTitle";

let contentor: HTMLDivElement;

beforeEach(() => {
  contentor = document.createElement("div");
  document.body.append(contentor);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
  Object.defineProperty(window, "ResizeObserver", { configurable: true, value: undefined });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
});

afterEach(() => {
  contentor.remove();
  vi.restoreAllMocks();
});

async function renderTitulo(texto: string, expandido = false, onAlternar = vi.fn()) {
  const raiz = createRoot(contentor);
  await act(async () => raiz.render(<HierarchyTitle texto={texto} rotuloGrupo={`subcapítulo ${texto}`} expandido={expandido} onAlternar={onAlternar} />));
  return { raiz, onAlternar };
}

async function definirOverflow(altura: number) {
  const texto = contentor.querySelector("p");
  if (!texto) throw new Error("Título não renderizado");
  Object.defineProperty(texto, "scrollHeight", { configurable: true, value: altura });
  await act(async () => window.dispatchEvent(new Event("resize")));
}

describe("título hierárquico truncável", () => {
  it("mede o subcapítulo 7.1, expande o texto integral e permite recolher", async () => {
    const longo = "7.1 Revestimentos interiores em madeira com especificação técnica integral e condições de aplicação";
    const onAlternar = vi.fn();
    const { raiz } = await renderTitulo(longo, false, onAlternar);
    await definirOverflow(80);

    const abrir = contentor.querySelector<HTMLButtonElement>('button[aria-expanded="false"]');
    expect(abrir?.textContent).toBe("Ver descrição completa");
    expect(abrir?.getAttribute("aria-controls")).toBe(contentor.querySelector("p")?.id);
    expect(abrir?.getAttribute("aria-label")).toContain(`subcapítulo ${longo}`);
    abrir?.click();
    expect(onAlternar).toHaveBeenCalledOnce();

    await act(async () => raiz.render(<HierarchyTitle texto={longo} rotuloGrupo={`subcapítulo ${longo}`} expandido onAlternar={onAlternar} />));
    expect(contentor.querySelector("p")?.textContent).toBe(longo);
    expect(contentor.querySelector("p")?.className).toContain("whitespace-normal");
    expect(contentor.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')?.textContent).toBe("Recolher descrição");
    contentor.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')?.click();
    expect(onAlternar).toHaveBeenCalledTimes(2);
    await act(async () => raiz.unmount());
  });

  it("não apresenta ação quando o texto curto não está truncado", async () => {
    const { raiz } = await renderTitulo("7.1 Carpintarias");
    await definirOverflow(16);
    expect(contentor.querySelector("button")).toBeNull();
    await act(async () => raiz.unmount());
  });

  it("expõe um botão focável e acessível para ativação por teclado", async () => {
    const onAlternar = vi.fn();
    const { raiz } = await renderTitulo("Capítulo muito longo para teste de teclado e leitores de ecrã", false, onAlternar);
    await definirOverflow(64);
    const botao = contentor.querySelector<HTMLButtonElement>("button");
    botao?.focus();
    expect(botao?.tagName).toBe("BUTTON");
    expect(document.activeElement).toBe(botao);
    expect(botao?.getAttribute("aria-expanded")).toBe("false");
    expect(botao?.getAttribute("aria-controls")).toBeTruthy();
    botao?.click();
    expect(onAlternar).toHaveBeenCalledOnce();
    await act(async () => raiz.unmount());
  });
});