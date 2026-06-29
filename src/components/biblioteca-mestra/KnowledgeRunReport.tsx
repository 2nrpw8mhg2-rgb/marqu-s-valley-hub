import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  ChevronDown,
  Terminal,
  Trash2,
  Plus,
} from "lucide-react";

import { toast } from "sonner";

type Props = {
  runId: string;
  report: KnowledgeRunReport;
  onClose: () => void;
  onRegenerar: () => void;
};

type EditDraft = {
  id?: string;
  artigoMestreId: string;
  artigoCodigo?: string;
  artigoDescricao?: string;
  tipo: ConhecimentoTipo;
  termo: string;
  peso: number;
  confianca: number;
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
  const [editor, setEditor] = useState<EditDraft | null>(null);
  const [removerTermo, setRemoverTermo] = useState<KnowledgeRunReportTermo | null>(null);
  const [overrides, setOverrides] = useState<Map<string, Partial<KnowledgeRunReportTermo>>>(new Map());
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<KnowledgeRunReportTermo[]>([]);
  const navigate = useNavigate();
  const aprovarFn = useServerFn(aprovarConhecimentoRun);

  const aprovar = useMutation({
    mutationFn: async () => await aprovarFn({ data: { runId } }),
    onSuccess: (r: any) => toast.success(`Conhecimento aprovado (${r.aprovados ?? 0} termos)`),
    onError: (e: Error) => toast.error(e.message),
  });

  const escopoTipo = report.escopo?.tipo ?? (report.artigo ? "artigo" : "especialidade");
  const isArtigoScope = escopoTipo === "artigo";

  const mergedTermos = useMemo<KnowledgeRunReportTermo[]>(() => {
    const base = (report.termos ?? [])
      .filter((t) => !deleted.has(t.id))
      .map((t) => ({ ...t, ...(overrides.get(t.id) ?? {}) }));
    return [...base, ...added];
  }, [report.termos, overrides, deleted, added]);

  const termosPorTipo = useMemo(() => {
    const acc: Record<string, KnowledgeRunReportTermo[]> = {};
    for (const t of mergedTermos) {
      (acc[t.tipo] ??= []).push(t);
    }
    return acc;
  }, [mergedTermos]);

  const termosPorArtigo = useMemo(() => {
    const acc = new Map<string, KnowledgeRunReportTermo[]>();
    for (const t of mergedTermos) {
      const k = t.artigoMestreId ?? "_";
      const arr = acc.get(k) ?? [];
      arr.push(t);
      acc.set(k, arr);
    }
    return acc;
  }, [mergedTermos]);

  const tipoPesoDefault = (t: ConhecimentoTipo) =>
    CONHECIMENTO_TIPOS.find((x) => x.value === t)?.pesoDefault ?? 10;

  const openEditor = (t: KnowledgeRunReportTermo) => {
    setEditor({
      id: t.id,
      artigoMestreId: t.artigoMestreId ?? report.artigo?.id ?? "",
      artigoCodigo: t.artigoCodigo,
      artigoDescricao: t.artigoDescricao,
      tipo: t.tipo,
      termo: t.termo,
      peso: t.peso,
      confianca: t.confianca,
    });
    setSelected(null);
  };

  const openCreate = (tipo: ConhecimentoTipo, artigoId: string, art?: { codigo?: string; descricao?: string }) => {
    setEditor({
      artigoMestreId: artigoId,
      artigoCodigo: art?.codigo,
      artigoDescricao: art?.descricao,
      tipo,
      termo: "",
      peso: tipoPesoDefault(tipo),
      confianca: 100,
    });
  };

  const saveEditor = useMutation({
    mutationFn: async (e: EditDraft) => {
      const termo = e.termo.trim();
      if (!termo) throw new Error("Termo obrigatório");
      if (!e.artigoMestreId) throw new Error("Sem artigo associado");
      const payload = {
        artigo_mestre_id: e.artigoMestreId,
        tipo: e.tipo,
        termo,
        peso: Number(e.peso),
        confianca: Math.max(0, Math.min(100, Number(e.confianca) || 0)),
        origem: "utilizador" as const,
        ativo: true,
      };
      if (e.id) {
        const { error } = await supabase
          .from("biblioteca_artigo_conhecimento")
          .update(payload)
          .eq("id", e.id);
        if (error) throw error;
        return { ...e, id: e.id, termo };
      }
      const { data, error } = await supabase
        .from("biblioteca_artigo_conhecimento")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return { ...e, id: data.id as string, termo };
    },
    onSuccess: (saved) => {
      if (editor?.id) {
        setOverrides((prev) => {
          const next = new Map(prev);
          next.set(saved.id!, { termo: saved.termo, peso: saved.peso, confianca: saved.confianca, tipo: saved.tipo });
          return next;
        });
        toast.success("Termo atualizado");
      } else {
        const novo: KnowledgeRunReportTermo = {
          id: saved.id!,
          tipo: saved.tipo,
          termo: saved.termo,
          peso: saved.peso,
          confianca: saved.confianca,
          origem: "utilizador",
          ocorrencias: 0,
          exemplos: [],
          justificacao: null,
          novo: true,
          artigoMestreId: saved.artigoMestreId,
          artigoCodigo: saved.artigoCodigo,
          artigoDescricao: saved.artigoDescricao,
        };
        setAdded((prev) => [...prev, novo]);
        toast.success("Termo adicionado");
      }
      setEditor(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTermo = useMutation({
    mutationFn: async (t: KnowledgeRunReportTermo) => {
      const { error } = await supabase
        .from("biblioteca_artigo_conhecimento")
        .delete()
        .eq("id", t.id);
      if (error) throw error;
      return t;
    },
    onSuccess: (t) => {
      // se for um termo adicionado localmente, remove de added
      setAdded((prev) => prev.filter((x) => x.id !== t.id));
      setDeleted((prev) => new Set(prev).add(t.id));
      setRemoverTermo(null);
      setSelected(null);
      toast.success("Termo eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const handleExport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const nome =
      report.escopo?.artigo?.codigo ||
      report.escopo?.subespecialidade ||
      report.escopo?.especialidade ||
      report.artigo?.codigo ||
      "execucao";
    a.href = url;
    a.download = `conhecimento-${nome}.json`.replace(/\s+/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEditar = () => {
    if (!report.artigo) return;
    navigate({
      to: "/biblioteca-mestra/artigos",
      search: { artigoId: report.artigo.id, tab: "conhecimento" } as any,
    });
  };

  const conf = report.confiancaGlobal.depois;
  const semTermos = (report.totalNovos ?? 0) === 0 && (report.total ?? 0) === 0;
  const falhou = Boolean(report.erro) || semTermos;

  // título e breadcrumb dinâmicos
  let titulo = "Relatório Final de Conhecimento";
  let breadcrumb = "";
  if (isArtigoScope) {
    const a = report.escopo?.artigo ?? report.artigo;
    titulo = a ? `${a.codigo} — ${a.descricao}` : titulo;
    breadcrumb = [report.escopo?.especialidade, report.escopo?.subespecialidade, report.artigo?.categoria]
      .filter(Boolean)
      .join(" › ");
  } else if (escopoTipo === "subespecialidade") {
    titulo = report.escopo?.subespecialidade || "Subespecialidade";
    breadcrumb = report.escopo?.especialidade ?? "";
  } else {
    titulo = report.escopo?.especialidade || "Especialidade";
  }

  const execucao = report.execucao;
  const artigos = report.artigos ?? [];

  return (
    <>
      <Card className={falhou ? "border-amber-500/50" : "border-emerald-500/40"}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              {falhou ? (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4" /> Geração sem termos
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Conhecimento gerado com sucesso
                </div>
              )}

              <CardTitle className="text-lg truncate">{titulo}</CardTitle>
              {breadcrumb && <div className="text-xs text-muted-foreground">{breadcrumb}</div>}
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
          {falhou && (
            <div className="rounded-md border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-sm">
              <div className="font-medium text-amber-700 dark:text-amber-300 mb-1">
                Não foi possível extrair termos nesta execução.
              </div>
              {report.erro && (
                <div className="text-xs text-muted-foreground break-words">
                  Detalhe: {report.erro}
                </div>
              )}
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={onRegenerar}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
                </Button>
              </div>
            </div>
          )}

          {/* Resumo da execução */}
          {execucao && (
            <section>
              <h3 className="text-sm font-medium mb-2">Resumo da execução</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <StatCard label="Artigos" value={`${execucao.processados} / ${execucao.totalArtigos}`} />
                <StatCard label="Saltados" value={execucao.saltados} />
                <StatCard label="Falhados" value={execucao.falhados} tone={execucao.falhados > 0 ? "warn" : undefined} />
                <StatCard label="Modo" value={execucao.modo} />
                <StatCard label="Termos gerados" value={report.totalNovos} tone="ok" />
              </div>
            </section>
          )}

          {/* Antes vs Depois */}
          <section>
            <h3 className="text-sm font-medium mb-2">Totais gerados (antes vs depois)</h3>
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

          {/* Conhecimento gerado */}
          <section>
            <h3 className="text-sm font-medium mb-2">Conhecimento gerado</h3>
            <Tabs defaultValue={isArtigoScope ? "tipo" : "tipo"}>
              <TabsList>
                <TabsTrigger value="tipo">Por Tipo</TabsTrigger>
                <TabsTrigger value="artigo" disabled={artigos.length === 0}>
                  Por Artigo Mestre {artigos.length > 0 && `(${artigos.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tipo" className="mt-3">
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
                        <AccordionContent className="px-3 pb-3 space-y-2">
                          <TermosChips lista={lista} onPick={setSelected} onEdit={openEditor} onDelete={setRemoverTermo} mostraArtigo={!isArtigoScope} />
                          {isArtigoScope && report.artigo && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => openCreate(t.value, report.artigo!.id, { codigo: report.artigo!.codigo, descricao: report.artigo!.descricao })}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Adicionar {t.label.toLowerCase()}
                            </Button>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </TabsContent>

              <TabsContent value="artigo" className="mt-3">
                <Accordion type="multiple" className="border rounded-md">
                  {artigos.map((art) => {
                    const lista = termosPorArtigo.get(art.id) ?? [];
                    return (
                      <AccordionItem key={art.id} value={art.id}>
                        <AccordionTrigger className="px-3 py-2 hover:no-underline">
                          <div className="flex items-center gap-2 flex-1 text-left min-w-0">
                            <span className="font-mono text-xs tabular-nums text-muted-foreground shrink-0">
                              {art.codigo}
                            </span>
                            <span className="text-sm truncate">{art.descricao}</span>
                            <div className="ml-auto flex items-center gap-1.5 shrink-0">
                              {art.falhou ? (
                                <Badge variant="destructive" className="text-[10px]">falhou</Badge>
                              ) : (
                                <>
                                  <Badge variant="outline" className="text-[10px] tabular-nums">
                                    {art.totalTermos} termos
                                  </Badge>
                                  {art.novos > 0 && (
                                    <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                                      +{art.novos} novos
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3 space-y-3">
                          {art.falhou && art.erro && (
                            <div className="text-xs text-destructive">Erro: {art.erro}</div>
                          )}
                          {CONHECIMENTO_TIPOS.map((t) => {
                            const sub = lista.filter((x) => x.tipo === t.value);
                            return (
                              <div key={t.value}>
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className={`text-[10px] ${t.className}`}>
                                    {t.labelShort}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground tabular-nums">({sub.length})</span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-1.5 text-[10px] ml-auto"
                                    onClick={() => openCreate(t.value, art.id, { codigo: art.codigo, descricao: art.descricao })}
                                  >
                                    <Plus className="h-3 w-3 mr-0.5" /> Adicionar
                                  </Button>
                                </div>
                                {sub.length > 0 ? (
                                  <TermosChips lista={sub} onPick={setSelected} onEdit={openEditor} onDelete={setRemoverTermo} mostraArtigo={false} />
                                ) : (
                                  <div className="text-[11px] text-muted-foreground italic">Sem termos.</div>
                                )}
                              </div>
                            );
                          })}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </TabsContent>
            </Tabs>

            <div className="text-[11px] text-muted-foreground mt-2">
              🟢 Novos termos · ⚪ Termos já existentes · clica num chip para ver detalhes
            </div>
          </section>

          {/* Logs técnicos */}
          {(report.log?.length ?? 0) > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-1.5 w-full justify-between">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5" /> Logs técnicos ({report.log?.length})
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="rounded-md border bg-muted/20 max-h-64 overflow-y-auto p-2 font-mono text-[11px] space-y-0.5">
                  {(report.log ?? []).slice().reverse().map((l, i) => (
                    <div key={i}>
                      <span className="text-muted-foreground">{new Date(l.ts).toLocaleTimeString()}</span>{" "}
                      {l.msg}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button onClick={() => aprovar.mutate()} disabled={aprovar.isPending || report.totalNovos === 0}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar conhecimento
            </Button>
            {isArtigoScope && report.artigo && (
              <Button variant="outline" onClick={handleEditar}>
                <Pencil className="h-4 w-4 mr-2" /> Editar conhecimento
              </Button>
            )}
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
                {selected.artigoCodigo && (
                  <Row label="Artigo Mestre">
                    <span className="text-xs">
                      <span className="font-mono">{selected.artigoCodigo}</span>{" "}
                      <span className="text-muted-foreground">{selected.artigoDescricao}</span>
                    </span>
                  </Row>
                )}
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

                <div className="flex gap-2 pt-3 border-t">
                  <Button size="sm" variant="outline" onClick={() => openEditor(selected)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setRemoverTermo(selected)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Eliminar
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Editor de termo (criar/editar) */}
      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editor?.id ? "Editar termo" : "Adicionar termo manualmente"}</DialogTitle>
          </DialogHeader>
          {editor && (
            <div className="space-y-3">
              {editor.artigoCodigo && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{editor.artigoCodigo}</span> {editor.artigoDescricao}
                </div>
              )}
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={editor.tipo}
                  onValueChange={(v) => setEditor({ ...editor, tipo: v as ConhecimentoTipo, peso: tipoPesoDefault(v as ConhecimentoTipo) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONHECIMENTO_TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Termo</Label>
                <Input
                  value={editor.termo}
                  onChange={(e) => setEditor({ ...editor, termo: e.target.value })}
                  placeholder="ex: betão armado"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Peso</Label>
                  <Input
                    type="number"
                    value={editor.peso}
                    onChange={(e) => setEditor({ ...editor, peso: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Confiança (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={editor.confianca}
                    onChange={(e) => setEditor({ ...editor, confianca: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditor(null)}>Cancelar</Button>
            <Button onClick={() => editor && saveEditor.mutate(editor)} disabled={saveEditor.isPending || !editor?.termo.trim()}>
              {editor?.id ? "Guardar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminação */}
      <AlertDialog open={!!removerTermo} onOpenChange={(o) => !o && setRemoverTermo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar termo?</AlertDialogTitle>
            <AlertDialogDescription>
              Vai eliminar definitivamente <span className="font-semibold">"{removerTermo?.termo}"</span> do conhecimento deste artigo. Esta ação não pode ser anulada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removerTermo && deleteTermo.mutate(removerTermo)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TermosChips({
  lista,
  onPick,
  onEdit,
  onDelete,
  mostraArtigo,
}: {
  lista: KnowledgeRunReportTermo[];
  onPick: (t: KnowledgeRunReportTermo) => void;
  onEdit: (t: KnowledgeRunReportTermo) => void;
  onDelete: (t: KnowledgeRunReportTermo) => void;
  mostraArtigo: boolean;
}) {
  if (lista.length === 0) {
    return <div className="text-xs text-muted-foreground">Sem termos.</div>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {lista.map((termo) => (
        <div
          key={termo.id}
          className={`group inline-flex items-stretch text-xs rounded border overflow-hidden transition-colors ${
            termo.novo
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-muted-foreground/20 bg-muted/40"
          }`}
        >
          <button
            type="button"
            onClick={() => onPick(termo)}
            className="px-2 py-1 hover:bg-black/5 dark:hover:bg-white/5 text-left"
            title={
              termo.justificacao ??
              (mostraArtigo && termo.artigoCodigo ? `${termo.artigoCodigo} — ${termo.artigoDescricao}` : undefined)
            }
          >
            {termo.novo ? <span className="mr-1">🟢</span> : <span className="mr-1 text-muted-foreground">⚪</span>}
            {termo.termo}
            {mostraArtigo && termo.artigoCodigo && (
              <span className="ml-1 text-[10px] text-muted-foreground font-mono">· {termo.artigoCodigo}</span>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(termo); }}
            className="px-1.5 border-l border-current/10 opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5"
            title="Editar termo"
            aria-label="Editar"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(termo); }}
            className="px-1.5 border-l border-current/10 opacity-60 hover:opacity-100 hover:bg-destructive/10 text-destructive"
            title="Eliminar termo"
            aria-label="Eliminar"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
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

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "ok" | "warn";
}) {
  const cls =
    tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : "";
  return (
    <div className="rounded border p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

type _Tipo = ConhecimentoTipo;
