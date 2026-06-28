import { Badge } from "@/components/ui/badge";
import type { Metodo } from "@/lib/classificacao/engine";

type EstadoCls = "classificado_auto" | "necessita_revisao" | "sem_classificacao" | "validado";

export type ResultadoIA = {
  label: string;
  dot: string;
  cls: string;
  hint: string;
};

export function resultadoFromRow(metodo: Metodo, estado: EstadoCls): ResultadoIA {
  if (estado === "sem_classificacao" || metodo === "nenhum") {
    return { label: "Sem Correspondência", dot: "bg-muted-foreground", cls: "border-border text-muted-foreground", hint: "A IA não encontrou nenhum sinal útil" };
  }
  if (metodo === "aprendido") {
    return { label: "Aprendida", dot: "bg-purple-500", cls: "border-purple-500/40 text-purple-700 dark:text-purple-400", hint: "Aprendida de validações anteriores" };
  }
  if (metodo === "exato") {
    return { label: "Exata", dot: "bg-green-500", cls: "border-green-500/40 text-green-700 dark:text-green-400", hint: "Descrição idêntica a um Artigo Mestre" };
  }
  if (metodo === "manual") {
    return { label: "Manual", dot: "bg-orange-500", cls: "border-orange-500/40 text-orange-700 dark:text-orange-400", hint: "Atribuída manualmente pelo utilizador" };
  }
  if (metodo === "keyword_artigo" || metodo === "keyword_subesp" || metodo === "keyword_esp") {
    return { label: "Por Regras", dot: "bg-yellow-500", cls: "border-yellow-500/40 text-yellow-700 dark:text-yellow-400", hint: "Classificada por palavras-chave da Biblioteca" };
  }
  return { label: "—", dot: "bg-muted-foreground", cls: "border-border text-muted-foreground", hint: "" };
}

export function ResultadoIABadge({ metodo, estado }: { metodo: Metodo; estado: EstadoCls }) {
  const r = resultadoFromRow(metodo, estado);
  return (
    <Badge variant="outline" className={`gap-1.5 font-medium ${r.cls}`} title={r.hint}>
      <span className={`h-2 w-2 rounded-full ${r.dot}`} />
      {r.label}
    </Badge>
  );
}
