import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ConfiancaBar } from "@/components/classificacao/ConfiancaBar";
import {
  CONHECIMENTO_TIPOS,
  CONHECIMENTO_ORIGENS,
  type KnowledgeRunReport,
  type KnowledgeRunReportTermo,
  type ConhecimentoTipo,
} from "@/lib/biblioteca-mestra/types";
import { aprovarConhecimentoRun } from "@/lib/biblioteca-mestra/knowledge-builder.functions";
import {
  CheckCircle2,
  Pencil,
  RefreshCw,
  Download,
  X,
  ArrowRight,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

import { toast } from "sonner";

type Props = {
  runId: string;
  report: KnowledgeRunReport;
  onClose: () => void;
  onRegenerar: () => void;
};

const TIPO_BY_VALUE: Record<string, (typeof CONHECIMENTO_TIPOS)[number]> = Object.fromEntries(
  CONHECIMENTO_TIPOS.map((t) => [t.value, t])
);
const ORIGEM_BY_VALUE: Record<string, (typeof CONHECIMENTO_ORIGENS)[number]> = Object.fromEntries(
  CONHECIMENTO_ORIGENS.map((o) => [o.value, o])
);

function confDotClass(v: number) {
  if (v >= 90) return "bg-emerald-500";
  if (v >= 70) return "bg-amber-500";
  return "bg-red-500";
}

function deltaText(d: number) {
  if (d === 0) return <span className="text-muted-foreground">±0</span>;
  if (d > 0) return <span className="text-emerald-600 dark:text-emerald-400">+{d}</span>;
  return <span className="text-destructive">{d}</span>;
}

export function KnowledgeRunReport({ runId, report, onClose, onRegenerar }: Props) {
  const [selected, setSelected] = useState<KnowledgeRunReportTermo | null>(null);
  const navigate = useNavigate();
  const aprovarFn = useServerFn(aprovarConhecimentoRun);

  const aprovar = useMutation({
    mutationFn: async () => await aprovarFn({ data: { runId } }),
    onSuccess: (r: any) => toast.success(`Conhecimento aprovado (${r.aprovados ?? 0} termos)`),
    onError: (e: Error) => toast.error(e.message),
  });

  const termosPorTipo = useMemo(() => {
    const acc: Record<string, KnowledgeRunReportTermo[]> = {};
    for (const t of report.termos ?? []) {
      (acc[t.tipo] ??= []).push(t);
    }
    return acc;
  }, [report.termos]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conhecimento-${report.artigo.codigo || report.artigo.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEditar = () => {
    navigate({
      to: "/biblioteca-mestra/artigos",
      search: { artigoId: report.artigo.id, tab: "conhecimento" } as any,
    });
  };

  const conf = report.confiancaGlobal.depois;

  return (
    <>
      <Card className="border-emerald-500/40">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" /> Conhecimento gerado com sucesso
              </div>
              <CardTitle className="text-lg">
                {report.artigo.codigo} — {report.artigo.descricao}
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                {[report.artigo.especialidade, report.artigo.subespecialidade, report.artigo.categoria]
                  .filter(Boolean)
                  .join(" › ")}
              </div>
            </div>
            <div className="text-right min-w-[140px]">
              <div className="text-xs text-muted-foreground">Confiança global</div>
              <div className="flex items-center gap-2 justify-end mt-1">
                <span className={`h-2.5 w-2.5 rounded-full ${confDotClass(conf)}`} />
                <span className="text-2xl font-semibold tabular-nums">{conf}%</span>
              </div>
              {report.confiancaGlobal.antes !== conf && (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  antes {report.confiancaGlobal.antes}% → agora {conf}%
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Antes vs Depois */}
          <section>
            <h3 className="text-sm font-medium mb-2">Antes vs Depois</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {CONHECIMENTO_TIPOS.map((t) => {
                const p = report.perTipo[t.value] ?? { antes: 0, depois: 0, delta: 0 };
                return (
                  <div key={t.value} className="rounded border p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">{t.labelShort}</div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-sm text-muted-foreground tabular-nums">{p.antes}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-lg font-semibold tabular-nums">{p.depois}</span>
                      <span className="text-xs ml-auto">{deltaText(p.delta)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Fontes utilizadas */}
          <section>
            <h3 className="text-sm font-medium mb-2">Fontes analisadas</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <FonteCard icon="📄" label="Histórico" main={`${report.fontes.historico.total}`} sub={`${report.fontes.historico.validados} validados · ${report.fontes.historico.auto} auto`} />
              <FonteCard icon="📥" label="Orçamentos brutos" main={`${report.fontes.candidatos.total}`} sub="candidatas" />
              <FonteCard icon="📚" label="Artigos vizinhos" main={`${report.fontes.vizinhos.artigos}`} sub={`${report.fontes.vizinhos.exemplos} exemplos`} />
              <FonteCard icon="👤" label="Correções utilizador" main={`${report.fontes.correcoes.total}`} sub="registadas" />
              <FonteCard icon="🧠" label="Reutilizados" main={`${report.fontes.reutilizados.total}`} sub="termos mantidos" />
            </div>
          </section>

          {/* Conhecimento gerado por tipo */}
          <section>
            <h3 className="text-sm font-medium mb-2">Conhecimento gerado</h3>
            <Accordion type="multiple" className="border rounded-md">
              {CONHECIMENTO_TIPOS.map((t) => {
                const lista = termosPorTipo[t.value] ?? [];
                const novos = lista.filter((x) => x.novo).length;
                return (
                  <AccordionItem key={t.value} value={t.value}>
                    <AccordionTrigger className="px-3 py-2 hover:no-underline">
                      <div className="flex items-center gap-2 flex-1">
                        <Badge variant="outline" className={t.className}>
                          {t.labelShort}
                        </Badge>
                        <span className="text-sm tabular-nums">({lista.length})</span>
                        {novos > 0 && (
                          <Badge className="ml-2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                            <Sparkles className="h-3 w-3 mr-1" /> {novos} novos
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      {lista.length === 0 ? (
                        <div className="text-xs text-muted-foreground">Sem termos.</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {lista.map((termo) => (
                            <button
                              key={termo.id}
                              onClick={() => setSelected(termo)}
                              className={`text-xs px-2 py-1 rounded border transition-colors ${
                                termo.novo
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                                  : "border-muted-foreground/20 bg-muted/40 hover:bg-muted"
                              }`}
                              title={termo.justificacao ?? undefined}
                            >
                              {termo.novo && <span className="mr-1">🟢</span>}
                              {!termo.novo && <span className="mr-1 text-muted-foreground">⚪</span>}
                              {termo.termo}
                            </button>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
            <div className="text-[11px] text-muted-foreground mt-2">
              🟢 Novos termos · ⚪ Termos já existentes · clica num chip para ver detalhes
            </div>
          </section>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button onClick={() => aprovar.mutate()} disabled={aprovar.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar conhecimento
            </Button>
            <Button variant="outline" onClick={handleEditar}>
              <Pencil className="h-4 w-4 mr-2" /> Editar conhecimento
            </Button>
            <Button variant="outline" onClick={onRegenerar}>
              <RefreshCw className="h-4 w-4 mr-2" /> Regenerar
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Exportar
            </Button>
            <Button variant="ghost" onClick={onClose} className="ml-auto">
              <X className="h-4 w-4 mr-2" /> Guardar e fechar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.novo && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                      <Sparkles className="h-3 w-3 mr-1" /> Novo
                    </Badge>
                  )}
                  {selected.termo}
                </SheetTitle>
                <SheetDescription>
                  <Badge variant="outline" className={TIPO_BY_VALUE[selected.tipo]?.className}>
                    {TIPO_BY_VALUE[selected.tipo]?.label ?? selected.tipo}
                  </Badge>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 space-y-4 text-sm">
                <Row label="Origem">
                  <Badge variant="outline" className={ORIGEM_BY_VALUE[selected.origem]?.className}>
                    {ORIGEM_BY_VALUE[selected.origem]?.icon ?? "•"}{" "}
                    {ORIGEM_BY_VALUE[selected.origem]?.label ?? selected.origem}
                  </Badge>
                </Row>
                <Row label="Ocorrências">
                  <span className="tabular-nums font-medium">{selected.ocorrencias}</span>
                </Row>
                <Row label="Peso">
                  <span className="tabular-nums font-medium">{selected.peso}</span>
                </Row>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Confiança</div>
                  <ConfiancaBar value={selected.confianca} />
                </div>

                {selected.exemplos && selected.exemplos.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Exemplos reais encontrados</div>
                    <ul className="space-y-1 text-xs">
                      {selected.exemplos.map((ex, i) => (
                        <li key={i} className="rounded bg-muted/40 px-2 py-1 font-mono">
                          {ex}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.justificacao && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Justificação da IA</div>
                    <div className="text-xs rounded border bg-muted/20 p-2 italic">
                      {selected.justificacao}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function FonteCard({ icon, label, main, sub }: { icon: string; label: string; main: string; sub: string }) {
  return (
    <div className="rounded border p-2">
      <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
        <span>{icon}</span> {label}
      </div>
      <div className="text-lg font-semibold tabular-nums">{main}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}

type _Tipo = ConhecimentoTipo;
