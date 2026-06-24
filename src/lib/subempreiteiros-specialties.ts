export const ESPECIALIDADES = [
  "Demolições",
  "Estruturas",
  "Alvenarias",
  "Coberturas",
  "Impermeabilizações",
  "Capoto",
  "Rebocos",
  "Pavimentos",
  "Carpintarias",
  "Serralharias",
  "Caixilharias",
  "Eletricidade",
  "ITED",
  "AVAC",
  "Canalizações",
  "Gás",
  "Pinturas",
  "Gesso Cartonado",
  "Cozinhas",
  "Limpeza Final",
  "Arranjos Exteriores",
] as const;

export type Especialidade = (typeof ESPECIALIDADES)[number];

/** Normalize header text to a canonical key (lowercased, no accents/spaces). */
export function normKey(s: string) {
  return s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Split a multi-value cell on common separators (;, ,, /, |, newline). */
export function splitMulti(value: unknown): string[] {
  if (value == null) return [];
  return String(value)
    .split(/[;,/|\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
