/**
 * Exportação global «Exportar Todos os Mapas» num único ficheiro ZIP.
 *
 * A geração parte sempre do estado atual no momento do pedido e é incremental
 * (pasta a pasta), para não bloquear a interface. Falhas parciais não anulam o
 * ficheiro: são devolvidas num relatório claro.
 */
import { zipSync } from "fflate";
import { nomeFicheiroMapa, sanitizarNomeFicheiro, type PastaMapa } from "./pastas";
import { excelMapaBytes, type MetaMapa } from "./excel";
import { pdfMapaBytes } from "./pdf";

export type ModoZip = "excel" | "pdf" | "ambos";

/** Caminho dentro do ZIP: uma pasta por subempreitada, nomes sanitizados. */
export function caminhoNoZip(obra: string, pasta: PastaMapa, ext: "xlsx" | "pdf"): string {
  return `${sanitizarNomeFicheiro(pasta.etiqueta, 50)}/${nomeFicheiroMapa(obra, pasta.etiqueta, ext)}`;
}

export function arvoreZip(obra: string, pastas: PastaMapa[], modo: ModoZip): string[] {
  const caminhos: string[] = [];
  for (const p of pastas) {
    if (modo === "excel" || modo === "ambos") caminhos.push(caminhoNoZip(obra, p, "xlsx"));
    if (modo === "pdf" || modo === "ambos") caminhos.push(caminhoNoZip(obra, p, "pdf"));
  }
  return caminhos;
}

export type RelatorioZip = {
  ficheiros: number;
  falhas: Array<{ pasta: string; formato: string; erro: string }>;
  vazio: boolean;
};

export type ResultadoZip = { bytes: Uint8Array | null; relatorio: RelatorioZip };

/**
 * Gera o ZIP pasta a pasta. `onProgresso` recebe (feitos, total) e permite
 * ceder o controlo à interface entre ficheiros.
 */
export async function gerarZipMapas(
  pastas: PastaMapa[],
  meta: MetaMapa,
  modo: ModoZip,
  onProgresso?: (feitos: number, total: number) => void | Promise<void>,
): Promise<ResultadoZip> {
  const ficheiros: Record<string, Uint8Array> = {};
  const falhas: RelatorioZip["falhas"] = [];
  const formatos: Array<"xlsx" | "pdf"> =
    modo === "ambos" ? ["xlsx", "pdf"] : modo === "excel" ? ["xlsx"] : ["pdf"];
  const total = pastas.length * formatos.length;
  let feitos = 0;

  for (const pasta of pastas) {
    for (const formato of formatos) {
      try {
        const bytes = formato === "xlsx" ? excelMapaBytes(pasta, meta) : pdfMapaBytes(pasta, meta);
        ficheiros[caminhoNoZip(meta.obra_nome, pasta, formato)] = bytes;
      } catch (e: unknown) {
        falhas.push({
          pasta: pasta.etiqueta,
          formato,
          erro: e instanceof Error ? e.message : "erro desconhecido",
        });
      }
      feitos++;
      await onProgresso?.(feitos, total);
    }
  }

  const n = Object.keys(ficheiros).length;
  if (n === 0) return { bytes: null, relatorio: { ficheiros: 0, falhas, vazio: true } };

  return {
    bytes: zipSync(ficheiros, { level: 6 }),
    relatorio: { ficheiros: n, falhas, vazio: false },
  };
}
