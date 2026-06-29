import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Search, Sparkles, X, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import {
  startKnowledgeRun, getKnowledgeRunStatus, cancelKnowledgeRun,
} from "@/lib/biblioteca-mestra/knowledge-builder.functions";
import {
  CONHECIMENTO_ORIGENS,
  CONHECIMENTO_TIPOS,
  type ArtigoConhecimento,
  type ConhecimentoTipo,
  type ConhecimentoOrigem,
} from "@/lib/biblioteca-mestra/types";

type Props = { artigoId: string | null | undefined };

type EditState = Partial<ArtigoConhecimento> & {
  tipo: ConhecimentoTipo; termo: string; peso: number; confianca: number;
};

const tipoMeta = (t: ConhecimentoTipo) => CONHECIMENTO_TIPOS.find((x) => x.value === t)!;
const origemMeta = (o: ConhecimentoOrigem) =>
  CONHECIMENTO_ORIGENS.find((x) => x.value === o) ?? CONHECIMENTO_ORIGENS[0];

function confiancaColor(v: number) {
  if (v >= 85) return "bg-emerald-500";
  if (v >= 60) return "bg-amber-500";
  return "bg-destructive";
}
function confiancaLabel(v: number) {
  if (v >= 85) return "Muito elevada";
  if (v >= 60) return "Média";
  return "Baixa";
}

function formatRelativo(iso: string | null | undefined) {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  return d.toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ArtigoConhecimentoTab({ artigoId }: Props) {
  const qc = useQueryClient();
  const [filtroTipo, setFiltroTipo] = useState<ConhecimentoTipo | "todos">("todos");
  const [mostrarInativos, setMostrarInativos] = useState(true);
  const [busca, setBusca] = useState("");
  const [editor, setEditor] = useState<EditState | null>(null);
  const [removerId, setRemoverId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<ArtigoConhecimento | null>(null);
  const [confirmarGerar, setConfirmarGerar] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [resumoVisivel, setResumoVisivel] = useState<any | null>(null);

  const startRun = useServerFn(startKnowledgeRun);
  const getStatus = useServerFn(getKnowledgeRunStatus);
  const cancelRun = useServerFn(cancelKnowledgeRun);

  const { data: registos = [], isLoading } = useQuery({
    queryKey: ["bm-conhecimento", artigoId],
    queryFn: async () => {
      if (!artigoId) return [] as ArtigoConhecimento[];
      const { data, error } = await supabase
        .from("biblioteca_artigo_conhecimento")
        .select("*")
        .eq("artigo_mestre_id", artigoId)
        .order("tipo")
        .order("ocorrencias", { ascending: false })
        .order("termo");
      if (error) throw error;
      return (data ?? []) as ArtigoConhecimento[];
    },
    enabled: !!artigoId,
  });

  // Última run desta ficha
  const { data: ultimaRun } = useQuery({
    queryKey: ["bm-ultima-run", artigoId],
    queryFn: async () => {
      if (!artigoId) return null;
      const { data } = await supabase
        .from("biblioteca_knowledge_run")
        .select("*")
        .eq("scope_tipo", "artigo")
        .filter("scope_ids->>artigoId", "eq", artigoId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!artigoId,
  });

  // Polling enquanto há uma run em curso
  const { data: runStatus } = useQuery({
    queryKey: ["bm-run-status", runId],
    queryFn: async () => (runId ? await getStatus({ data: { runId } }) : null),
    enabled: !!runId,
    refetchInterval: 1500,
  });

  useEffect(() => {
    if (!runStatus) return;
    if (runStatus.estado === "concluido" || runStatus.estado === "erro" || runStatus.estado === "cancelado") {
      setRunId(null);
      qc.invalidateQueries({ queryKey: ["bm-conhecimento", artigoId] });
      qc.invalidateQueries({ queryKey: ["bm-ultima-run", artigoId] });
      if (runStatus.estado === "concluido") {
        setResumoVisivel(runStatus.resumo ?? { counts: runStatus.counts });
        toast.success("Conhecimento gerado com sucesso");
      } else if (runStatus.estado === "erro") {
        toast.error(runStatus.erro_msg ?? "Falha na geração");
      }
    }
  }, [runStatus, artigoId, qc]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return registos.filter((r) => {
      if (filtroTipo !== "todos" && r.tipo !== filtroTipo) return false;
      if (!mostrarInativos && !r.ativo) return false;
      if (q && !r.termo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [registos, filtroTipo, mostrarInativos, busca]);

  const stats = useMemo(() => {
    const ativos = registos.filter((r) => r.ativo);
    const perTipo: Record<string, number> = {};
    for (const t of CONHECIMENTO_TIPOS) perTipo[t.value] = 0;
    let somaPeso = 0, somaPesoConf = 0;
    for (const r of ativos) {
      perTipo[r.tipo] = (perTipo[r.tipo] ?? 0) + 1;
      const p = Math.abs(Number(r.peso) || 0);
      somaPeso += p;
      somaPesoConf += p * (Number(r.confianca) || 0);
    }
    const confiancaGlobal = somaPeso > 0 ? Math.round(somaPesoConf / somaPeso) : 0;
    const fontes = new Set(ativos.map((r) => r.origem));
    return { perTipo, total: ativos.length, totalGeral: registos.length, confiancaGlobal, fontes: fontes.size };
  }, [registos]);

  const maxOcorrencias = useMemo(
    () => registos.reduce((m, r) => Math.max(m, r.ocorrencias ?? 0), 0),
    [registos]
  );

  const upsert = useMutation({
    mutationFn: async (e: EditState) => {
      if (!artigoId) throw new Error("Artigo não guardado");
      const termo = e.termo.trim();
      if (!termo) throw new Error("Termo obrigatório");
      const payload = {
        artigo_mestre_id: artigoId,
        tipo: e.tipo,
        termo,
        peso: Number.isFinite(e.peso) ? e.peso : tipoMeta(e.tipo).pesoDefault,
        confianca: Math.max(0, Math.min(100, Number(e.confianca) || 0)),
        ativo: e.ativo ?? true,
        origem: e.origem ?? "utilizador",
      };
      if (e.id) {
        const { error } = await supabase.from("biblioteca_artigo_conhecimento").update(payload).eq("id", e.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("biblioteca_artigo_conhecimento").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-conhecimento", artigoId] });
      setEditor(null);
      toast.success("Guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async (r: ArtigoConhecimento) => {
      const { error } = await supabase
        .from("biblioteca_artigo_conhecimento")
        .update({ ativo: !r.ativo })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bm-conhecimento", artigoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("biblioteca_artigo_conhecimento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-conhecimento", artigoId] });
      setRemoverId(null);
      setDetalhe(null);
      toast.success("Removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!artigoId) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Guarda o artigo primeiro para começar a adicionar conhecimento.
      </div>
    );
  }

  const novo = () =>
    setEditor({
      tipo: "palavra_chave",
      termo: "",
      peso: CONHECIMENTO_TIPOS[0].pesoDefault,
      confianca: 100,
      ativo: true,
      origem: "utilizador",
    });

  const estadoChip = (() => {
    if (runId || runStatus?.estado === "em_curso" || runStatus?.estado === "pendente") {
      return { label: "Em geração", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40", dot: "bg-blue-500 animate-pulse" };
    }
    if (registos.length === 0) {
      return { label: "Ainda não gerado", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40", dot: "bg-amber-500" };
    }
    if (ultimaRun?.estado === "concluido") {
      return { label: "Gerado", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40", dot: "bg-emerald-500" };
    }
    return { label: "Editado manualmente", className: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40", dot: "bg-slate-400" };
  })();

  const iniciarGeracao = async () => {
    try {
      setConfirmarGerar(false);
      setResumoVisivel(null);
      const r = await startRun({
        data: { scope: { tipo: "artigo", artigoId }, modo: "regenerar" },
      });
      setRunId(r.runId);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar geração");
    }
  };

  const cancelar = async () => {
    if (!runId) return;
    try {
      await cancelRun({ data: { runId } });
    } catch {}
  };

  const emGeracao = !!runId;
  const progresso = runStatus?.total_artigos
    ? Math.round(((runStatus.processados ?? 0) / Math.max(1, runStatus.total_artigos)) * 100)
    : null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* Dashboard de estado */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="rounded-md border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Estado</div>
            <div className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${estadoChip.className}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${estadoChip.dot}`} />
              {estadoChip.label}
            </div>
          </div>
          <div className="rounded-md border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Confiança global</div>
            <div className="mt-1 flex items-center gap-2">
              <Progress value={stats.confiancaGlobal} className="h-1.5 flex-1" />
              <span className="text-sm font-semibold tabular-nums">{stats.confiancaGlobal || "—"}{stats.confiancaGlobal ? "%" : ""}</span>
            </div>
          </div>
          <div className="rounded-md border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Última geração</div>
            <div className="mt-1 text-sm font-medium">{formatRelativo(ultimaRun?.concluido_em ?? ultimaRun?.created_at ?? null)}</div>
          </div>
          <div className="rounded-md border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Fontes analisadas</div>
            <div className="mt-1 text-sm font-semibold tabular-nums">{stats.fontes}</div>
          </div>
          <div className="rounded-md border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Aprovado</div>
            <div className="mt-1 text-sm font-semibold tabular-nums">{stats.total}<span className="text-xs text-muted-foreground"> / {stats.totalGeral}</span></div>
          </div>
        </div>

        {/* Composição */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {CONHECIMENTO_TIPOS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setFiltroTipo(filtroTipo === t.value ? "todos" : t.value)}
              className={`rounded-md border bg-card p-2 text-left transition hover:bg-muted/40 ${filtroTipo === t.value ? "ring-1 ring-primary" : ""}`}
            >
              <div className={`text-[10px] uppercase tracking-wide ${t.className.split(" ").filter((c) => c.startsWith("text-")).join(" ")}`}>{t.labelShort}</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums">{stats.perTipo[t.value] ?? 0}</div>
            </button>
          ))}
          <div className="rounded-md border bg-muted/40 p-2 text-left">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
            <div className="mt-0.5 text-xl font-semibold tabular-nums">{stats.total}</div>
          </div>
        </div>

        {/* Banner: artigo sem histórico validado */}
        {resumoVisivel?.semHistorico && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <div className="font-semibold text-amber-700 dark:text-amber-400">⚠ Sem histórico validado</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Este Artigo Mestre ainda não possui descrições classificadas. A IA usou descrições semelhantes
              encontradas em mapas importados e em artigos vizinhos. A confiança inicial é inferior — valide
              classificações reais para reforçar o conhecimento.
            </div>
          </div>
        )}

        {/* Fontes analisadas na última geração */}
        {resumoVisivel?.fontes && (
          <div className="rounded-md border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Fontes analisadas na última geração</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div className="rounded border p-2">
                <div className="text-[10px] uppercase text-muted-foreground">📄 Validadas</div>
                <div className="text-lg font-semibold tabular-nums">{resumoVisivel.fontes.historico_validado ?? 0}</div>
              </div>
              <div className="rounded border p-2">
                <div className="text-[10px] uppercase text-muted-foreground">🤖 Auto-classificadas</div>
                <div className="text-lg font-semibold tabular-nums">{resumoVisivel.fontes.historico_auto ?? 0}</div>
              </div>
              <div className="rounded border p-2">
                <div className="text-[10px] uppercase text-muted-foreground">📥 Brutas (orçamentos)</div>
                <div className="text-lg font-semibold tabular-nums">{resumoVisivel.fontes.candidatos_brutos ?? 0}</div>
              </div>
              <div className="rounded border p-2">
                <div className="text-[10px] uppercase text-muted-foreground">🧭 Artigos vizinhos</div>
                <div className="text-lg font-semibold tabular-nums">{resumoVisivel.fontes.vizinhos_analisados ?? 0}</div>
              </div>
            </div>
          </div>
        )}

        {/* Banner de resumo da geração */}
        {resumoVisivel && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-emerald-700 dark:text-emerald-400">Conhecimento gerado com sucesso</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {CONHECIMENTO_TIPOS.map((t) => {
                  const n = resumoVisivel.counts?.[t.value] ?? resumoVisivel.perTipo?.[t.value] ?? 0;
                  if (!n) return null;
                  return <span key={t.value}>✔ {n} {t.labelShort}</span>;
                })}
                {typeof resumoVisivel.confiancaGlobal === "number" && (
                  <span className="ml-auto font-medium text-foreground">Confiança global: {resumoVisivel.confiancaGlobal}%</span>
                )}
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setResumoVisivel(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Banner de geração em curso */}
        {emGeracao && (
          <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-3 flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium">A gerar conhecimento IA...</div>
              {progresso !== null && <Progress value={progresso} className="h-1.5 mt-2" />}
              {runStatus?.ultimo_artigo && <div className="text-xs text-muted-foreground mt-1 truncate">{runStatus.ultimo_artigo}</div>}
            </div>
            <Button size="sm" variant="outline" onClick={cancelar}>Cancelar</Button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Pesquisar termo</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-7 h-9" placeholder="Filtrar..." />
            </div>
          </div>
          <div className="w-44">
            <Label className="text-xs">Tipo</Label>
            <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as typeof filtroTipo)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {CONHECIMENTO_TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 h-9">
            <Switch checked={mostrarInativos} onCheckedChange={setMostrarInativos} />
            <Label className="text-xs">Inativos</Label>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={novo} size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
            <Button onClick={() => setConfirmarGerar(true)} size="sm" disabled={emGeracao}>
              <Sparkles className="h-4 w-4 mr-1" />
              {registos.length ? "Regenerar Conhecimento IA" : "Gerar Conhecimento IA"}
            </Button>
          </div>
        </div>

        {/* Tabela */}
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-32">Tipo</th>
                <th className="text-left px-3 py-2 font-medium">Termo</th>
                <th className="text-left px-3 py-2 font-medium w-16">Peso</th>
                <th className="text-left px-3 py-2 font-medium w-16">Origem</th>
                <th className="text-left px-3 py-2 font-medium w-28">Ocorrências</th>
                <th className="text-left px-3 py-2 font-medium w-40">Confiança</th>
                <th className="text-left px-3 py-2 font-medium w-14">Ativo</th>
                <th className="text-right px-3 py-2 font-medium w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">A carregar...</td></tr>
              )}
              {!isLoading && filtrados.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">
                  {registos.length === 0
                    ? "Sem conhecimento. Usa o botão 'Gerar Conhecimento IA' para começar."
                    : "Nenhum registo corresponde aos filtros."}
                </td></tr>
              )}
              {filtrados.map((r) => {
                const tm = tipoMeta(r.tipo);
                const om = origemMeta(r.origem);
                const ocBarra = maxOcorrencias > 0 ? (r.ocorrencias / maxOcorrencias) * 100 : 0;
                return (
                  <tr
                    key={r.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => setDetalhe(r)}
                  >
                    <td className="px-3 py-1.5"><Badge variant="outline" className={tm.className}>{tm.label}</Badge></td>
                    <td className="px-3 py-1.5 font-medium">{r.termo}</td>
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{r.peso}</td>
                    <td className="px-3 py-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-lg cursor-help" aria-label={om.label}>{om.icon}</span>
                        </TooltipTrigger>
                        <TooltipContent>{om.label}</TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-medium w-10">{r.ocorrencias ?? 0}</span>
                        <div className="flex-1 h-1 bg-muted rounded overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${ocBarra}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden">
                              <div className={`h-full ${confiancaColor(Number(r.confianca))}`} style={{ width: `${r.confianca}%` }} />
                            </div>
                            <span className="text-xs tabular-nums w-9 text-right">{Number(r.confianca).toFixed(0)}%</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{confiancaLabel(Number(r.confianca))}</TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <Switch checked={r.ativo} onCheckedChange={() => toggleAtivo.mutate(r)} />
                    </td>
                    <td className="px-3 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => setEditor({ ...r })}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={() => setRemoverId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Confirmação Gerar */}
        <AlertDialog open={confirmarGerar} onOpenChange={setConfirmarGerar}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Gerar Conhecimento IA
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                <div>A IA irá analisar três fontes:</div>
                  <ul className="ml-1 space-y-0.5 text-foreground">
                    <li>📄 <span className="font-medium">Histórico validado</span> deste Artigo Mestre (peso alto)</li>
                    <li>📥 <span className="font-medium">Descrições brutas</span> de mapas importados, por similaridade textual (peso médio)</li>
                    <li>🧭 <span className="font-medium">Artigos vizinhos</span> da mesma subespecialidade, para diferenciação e termos negativos (peso baixo)</li>
                  </ul>
                  <div className="pt-2 text-xs text-muted-foreground">
                    Tempo estimado: ~15–20 segundos. Cada termo é etiquetado com a sua origem e nível de confiança. {registos.length > 0 && "Os termos gerados anteriormente pela IA serão substituídos; termos do utilizador são mantidos."}
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={iniciarGeracao}>
                <Sparkles className="h-4 w-4 mr-1" /> Gerar agora
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Editor */}
        <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editor?.id ? "Editar" : "Adicionar"} conhecimento</DialogTitle></DialogHeader>
            {editor && (
              <div className="space-y-3">
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={editor.tipo}
                    onValueChange={(v) => {
                      const tipo = v as ConhecimentoTipo;
                      setEditor({ ...editor, tipo, peso: editor.id ? editor.peso : tipoMeta(tipo).pesoDefault });
                    }}
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
                  <Label>Termo *</Label>
                  <Input value={editor.termo} onChange={(e) => setEditor({ ...editor, termo: e.target.value })} autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Peso</Label>
                    <Input type="number" value={editor.peso}
                      onChange={(e) => setEditor({ ...editor, peso: parseInt(e.target.value || "0", 10) })} />
                  </div>
                  <div>
                    <Label>Confiança (%)</Label>
                    <Input type="number" min={0} max={100} value={editor.confianca}
                      onChange={(e) => setEditor({ ...editor, confianca: parseFloat(e.target.value || "0") })} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editor.ativo ?? true} onCheckedChange={(v) => setEditor({ ...editor, ativo: v })} />
                  <Label>Ativo</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditor(null)}>Cancelar</Button>
              <Button onClick={() => editor && upsert.mutate(editor)} disabled={upsert.isPending}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sheet de detalhe */}
        <Sheet open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
          <SheetContent className="sm:max-w-md w-full overflow-y-auto">
            {detalhe && (() => {
              const tm = tipoMeta(detalhe.tipo);
              const om = origemMeta(detalhe.origem);
              return (
                <>
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <span className="text-2xl">{om.icon}</span>
                      <span className="break-words">{detalhe.termo}</span>
                    </SheetTitle>
                    <SheetDescription className="flex items-center gap-2">
                      <Badge variant="outline" className={tm.className}>{tm.label}</Badge>
                      {!detalhe.ativo && <Badge variant="outline">Inativo</Badge>}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-5 space-y-5 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Origem</div>
                      <div className="flex items-center gap-2"><span className="text-lg">{om.icon}</span><span>{om.label}</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Peso</div>
                        <div className="text-lg font-semibold tabular-nums">{detalhe.peso}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Confiança</div>
                        <div className="flex items-center gap-2">
                          <Progress value={detalhe.confianca} className="h-1.5 flex-1" />
                          <span className="text-sm font-semibold tabular-nums">{Number(detalhe.confianca).toFixed(0)}%</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{confiancaLabel(Number(detalhe.confianca))}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Encontrado em</div>
                      <div className="text-sm">
                        {detalhe.ocorrencias > 0
                          ? <><span className="font-semibold">{detalhe.ocorrencias}</span> ocorrência{detalhe.ocorrencias === 1 ? "" : "s"} em mapas de quantidades reais</>
                          : <span className="text-muted-foreground">Sem ocorrências reais registadas</span>}
                      </div>
                    </div>
                    {detalhe.exemplos && detalhe.exemplos.length > 0 && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Exemplos reais</div>
                        <ul className="space-y-1.5">
                          {detalhe.exemplos.map((ex, i) => (
                            <li key={i} className="rounded-md border bg-muted/30 px-2 py-1.5 text-xs">{ex}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Utilizado pela IA porque</div>
                      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        {detalhe.justificacao || <span className="text-muted-foreground italic">Sem justificação registada.</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t">
                      <Button size="sm" variant="outline" onClick={() => { setEditor({ ...detalhe }); setDetalhe(null); }}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleAtivo.mutate(detalhe)}>
                        {detalhe.ativo ? "Desativar" : "Ativar"}
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive ml-auto"
                        onClick={() => setRemoverId(detalhe.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </SheetContent>
        </Sheet>

        {/* Confirmação remover */}
        <AlertDialog open={!!removerId} onOpenChange={(o) => !o && setRemoverId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover conhecimento?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser revertida.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => removerId && remove.mutate(removerId)}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
