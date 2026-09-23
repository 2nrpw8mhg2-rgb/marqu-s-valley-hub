import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { rotuloEstado } from "@/lib/procurement/fase1";
import { ArrowRight } from "lucide-react";

const VARIANTE: Record<string, string> = {
  por_preparar: "bg-muted text-muted-foreground",
  em_preparacao: "bg-primary/10 text-primary",
  pronto_envio: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  enviado: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  em_analise: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  adjudicado: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  cancelado: "bg-destructive/10 text-destructive",
};

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${VARIANTE[estado] ?? "bg-muted text-muted-foreground"}`}>
      {rotuloEstado(estado)}
    </span>
  );
}

export function Metrica({ rotulo, valor, nota }: { rotulo: string; valor: number; nota?: string }) {
  return (
    <Card className="rounded-md p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      {nota && <p className="mt-1 text-[11px] text-muted-foreground">{nota}</p>}
    </Card>
  );
}

const PASSOS = [
  "Mapa validado",
  "Pacote",
  "Preparação",
  "Envio",
  "Respostas",
  "Comparação",
  "Adjudicação",
];

export function FluxoProcurement({ ativo = 2 }: { ativo?: number }) {
  return (
    <Card className="p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Fluxo do processo</p>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
        {PASSOS.map((p, i) => (
          <li key={p} className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 ${
                i < ativo ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {p}
            </span>
            {i < PASSOS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/60" aria-hidden />}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Nesta fase estão operacionais a criação do pacote e a sua preparação. Envio, respostas, comparação e
        adjudicação chegam em fases seguintes.
      </p>
    </Card>
  );
}

export function EstadoVazio({
  titulo,
  descricao,
  icone,
  accao,
}: {
  titulo: string;
  descricao: string;
  icone?: ReactNode;
  accao?: ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-md border border-dashed bg-card/40 p-10 text-center">
      <div className="max-w-md space-y-2">
        {icone && <div className="mx-auto text-muted-foreground">{icone}</div>}
        <h3 className="font-medium">{titulo}</h3>
        <p className="text-sm text-muted-foreground">{descricao}</p>
        {accao}
      </div>
    </div>
  );
}

export function Alertas({ alertas }: { alertas: string[] }) {
  if (!alertas.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {alertas.map((a) => (
        <Badge key={a} variant="outline" className="text-[10px] font-normal">
          {a}
        </Badge>
      ))}
    </div>
  );
}
