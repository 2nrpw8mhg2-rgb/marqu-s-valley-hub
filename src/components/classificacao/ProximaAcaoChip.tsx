import { Button } from "@/components/ui/button";
import { CheckCircle2, Edit3, Plus, Sparkles, Tag } from "lucide-react";
import type { Metodo, Candidato } from "@/lib/classificacao/engine";

type EstadoCls = "classificado_auto" | "necessita_revisao" | "sem_classificacao" | "validado";

export type AcaoTipo = "validado" | "aceitar" | "corrigir" | "escolher" | "criar_keyword" | "criar_artigo";

export function calcularProximaAcao(args: {
  estado: EstadoCls; metodo: Metodo; confianca: number; candidatos: Candidato[] | null;
}): { tipo: AcaoTipo; label: string } {
  const { estado, metodo, confianca, candidatos } = args;
  if (estado === "validado") return { tipo: "validado", label: "Validado" };
  if (metodo === "exato" && (candidatos?.length ?? 0) > 1) return { tipo: "escolher", label: "Escolher candidato" };
  if (estado === "classificado_auto" && confianca >= 90) return { tipo: "aceitar", label: "Aceitar" };
  if (estado === "necessita_revisao") return { tipo: "corrigir", label: "Corrigir" };
  if (estado === "sem_classificacao") {
    if ((candidatos?.length ?? 0) > 0) return { tipo: "criar_keyword", label: "Criar Palavra-chave" };
    return { tipo: "criar_artigo", label: "Criar Artigo Mestre" };
  }
  return { tipo: "corrigir", label: "Rever" };
}

export function ProximaAcaoChip({
  acao, onClick,
}: { acao: ReturnType<typeof calcularProximaAcao>; onClick: () => void }) {
  if (acao.tipo === "validado") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Validado
      </span>
    );
  }
  const Icon =
    acao.tipo === "aceitar" ? CheckCircle2
    : acao.tipo === "corrigir" ? Edit3
    : acao.tipo === "escolher" ? Edit3
    : acao.tipo === "criar_keyword" ? Tag
    : acao.tipo === "criar_artigo" ? Plus
    : Sparkles;
  const cls =
    acao.tipo === "aceitar" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
    : acao.tipo === "criar_artigo" ? "border-blue-500/40 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10"
    : acao.tipo === "criar_keyword" ? "border-yellow-500/40 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/10"
    : "border-border text-foreground hover:bg-muted";
  return (
    <Button size="sm" variant="outline" className={`h-7 text-xs gap-1 ${cls}`} onClick={onClick}>
      <Icon className="h-3 w-3" /> {acao.label}
    </Button>
  );
}
