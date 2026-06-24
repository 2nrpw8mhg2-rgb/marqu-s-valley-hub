import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Plus, Sparkles, MoreHorizontal, Trash2, Copy, Pencil, Send, FolderOpen, ShoppingCart,
} from "lucide-react";
import { ESPECIALIDADES, inferirEspecialidade, classificarArtigo, CONFIANCA_MINIMA, validarArtigoParaEspecialidade, type Especialidade } from "@/lib/procurement/especialidades";

export const Route = createFileRoute("/_app/procurement/pacotes")({
  head: () => ({ meta: [{ title: "Pacotes de Consulta — Procurement — MV OS" }] }),
  component: PacotesRoutePage,
});

function PacotesRoutePage() {
  const isDetailRoute = useRouterState({
    select: (state) => state.location.pathname.startsWith("/procurement/pacotes/") && state.location.pathname !== "/procurement/pacotes/",
  });

  return isDetailRoute ? <Outlet /> : <PacotesListPage />;
}

const ESTADO_LABEL: Record<string, string> = {
  por_preparar: "Por preparar",
  preparado: "Preparado",
  enviado: "Enviado",
  em_analise: "Em análise",
  adjudicado: "Adjudicado",
  cancelado: "Cancelado",
};
const ESTADO_VARIANT: Record<string, string> = {
  por_preparar: "bg-muted text-muted-foreground",
  preparado: "bg-blue-500/15 text-blue-600",
  enviado: "bg-amber-500/15 text-amber-600",
  em_analise: "bg-purple-500/15 text-purple-600",
  adjudicado: "bg-emerald-500/15 text-emerald-600",
  cancelado: "bg-red-500/15 text-red-600",
};

function fmtEUR(n: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n || 0);
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-PT");
}

function PacotesListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [orcamentoFiltro, setOrcamentoFiltro] = useState<string>("todos");
  const [novoOpen, setNovoOpen] = useState(false);
  const [gerarOpen, setGerarOpen] = useState(false);
  const [editPacote, setEditPacote] = useState<any | null>(null);
  const [eliminarId, setEliminarId] = useState<string | null>(null);

  const { data: orcamentos = [] } = useQuery({
    queryKey: ["orcamentos-procurement-filtro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id, nome, versao, obra:obras(nome, codigo)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pacotes = [], isLoading } = useQuery({
    queryKey: ["procurement-pacotes", orcamentoFiltro],
    queryFn: async () => {
      let q = supabase
        .from("procurement_pacotes")
        .select("*, orcamento:orcamentos(id, nome, versao, obra:obras(nome, codigo)), artigos:procurement_pacote_artigos(id, quantidade, preco_seco_estimado)")
        .order("updated_at", { ascending: false });
      if (orcamentoFiltro !== "todos") q = q.eq("orcamento_id", orcamentoFiltro);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const resumo = useMemo(() => {
    const totalArtigos = (p: any) => p.artigos?.length ?? 0;
    const totalValor = (p: any) =>
      (p.artigos ?? []).reduce((s: number, a: any) => s + Number(a.quantidade ?? 0) * Number(a.preco_seco_estimado ?? 0), 0);
    return {
      total: pacotes.length,
      porPreparar: pacotes.filter((p: any) => p.estado === "por_preparar").length,
      enviados: pacotes.filter((p: any) => p.estado === "enviado").length,
      adjudicados: pacotes.filter((p: any) => p.estado === "adjudicado").length,
      valor: pacotes.reduce((s: number, p: any) => s + totalValor(p), 0),
      por: (p: any) => ({ artigos: totalArtigos(p), valor: totalValor(p) }),
    };
  }, [pacotes]);

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("procurement_pacotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pacote eliminado");
      qc.invalidateQueries({ queryKey: ["procurement-pacotes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const prepararEnvio = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("procurement_pacotes").update({ estado: "preparado" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pacote marcado como preparado");
      qc.invalidateQueries({ queryKey: ["procurement-pacotes"] });
    },
  });

  const duplicar = useMutation({
    mutationFn: async (p: any) => {
      const { data: novo, error } = await supabase
        .from("procurement_pacotes")
        .insert({
          orcamento_id: p.orcamento_id, obra_id: p.obra_id,
          nome: `${p.nome} (cópia)`, especialidade: p.especialidade,
          observacoes: p.observacoes, estado: "por_preparar",
        })
        .select("id").single();
      if (error) throw error;
      const { data: artigos } = await supabase
        .from("procurement_pacote_artigos").select("*").eq("pacote_id", p.id);
      if (artigos && artigos.length > 0) {
        const rows = artigos.filter((a: any) => validarArtigoParaEspecialidade({
          descricao: a.descricao,
          codigo: a.codigo,
          capitulo: a.capitulo,
          subcapitulo: a.subcapitulo,
        }, p.especialidade).valido).map((a: any) => ({
          pacote_id: novo.id, artigo_id: a.artigo_id, codigo: a.codigo, descricao: a.descricao,
          unidade: a.unidade, quantidade: a.quantidade, capitulo: a.capitulo, subcapitulo: a.subcapitulo,
          preco_seco_estimado: a.preco_seco_estimado, categoria_custo: a.categoria_custo,
          especialidade: a.especialidade,
        }));
        if (rows.length > 0) {
          const { error: ie } = await supabase.from("procurement_pacote_artigos").insert(rows);
          if (ie) throw ie;
        }
      }
      return novo.id;
    },
    onSuccess: () => {
      toast.success("Pacote duplicado");
      qc.invalidateQueries({ queryKey: ["procurement-pacotes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Pacotes de Consulta"
        subtitle="Organiza o orçamento em pacotes por especialidade prontos a consultar ao mercado"
        actions={
          <>
            <Button variant="outline" onClick={() => setGerarOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" /> Gerar automaticamente
            </Button>
            <Button onClick={() => setNovoOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Novo pacote
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        {/* Resumo */}
        <div className="grid gap-3 md:grid-cols-5">
          <SummaryCard label="Total de pacotes" value={resumo.total.toString()} />
          <SummaryCard label="Por preparar" value={resumo.porPreparar.toString()} tone="muted" />
          <SummaryCard label="Enviados" value={resumo.enviados.toString()} tone="amber" />
          <SummaryCard label="Adjudicados" value={resumo.adjudicados.toString()} tone="emerald" />
          <SummaryCard label="Valor em consulta" value={fmtEUR(resumo.valor)} tone="primary" />
        </div>

        {/* Filtro */}
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Filtrar por orçamento</Label>
            <Select value={orcamentoFiltro} onValueChange={setOrcamentoFiltro}>
              <SelectTrigger className="w-[360px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os orçamentos</SelectItem>
                {orcamentos.map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.obra?.codigo ? `${o.obra.codigo} · ` : ""}{o.nome} (v{o.versao})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Tabela */}
        <Card>
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">A carregar...</div>
          ) : pacotes.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Ainda não há pacotes. Gera automaticamente a partir de um orçamento ou cria um novo.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pacote geral</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Orçamento</TableHead>
                  <TableHead className="text-right">Artigos</TableHead>
                  <TableHead className="text-right">Valor estimado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pacotes.map((p: any) => {
                  const r = resumo.por(p);
                  return (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate({ to: "/procurement/pacotes/$id", params: { id: p.id } })}>
                      <TableCell className="font-medium">
                        <div>{(p as any).grupo_consulta ?? p.nome}</div>
                        {(p as any).grupo_consulta && (
                          <div className="text-xs text-muted-foreground">{p.nome}</div>
                        )}
                      </TableCell>
                      <TableCell>{p.especialidade}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.orcamento?.obra?.codigo ? `${p.orcamento.obra.codigo} · ` : ""}{p.orcamento?.nome}
                      </TableCell>
                      <TableCell className="text-right">{r.artigos}</TableCell>
                      <TableCell className="text-right">{fmtEUR(r.valor)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-md ${ESTADO_VARIANT[p.estado]}`}>
                          {ESTADO_LABEL[p.estado]}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(p.created_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(p.updated_at)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => navigate({ to: "/procurement/pacotes/$id", params: { id: p.id } })}>
                              <FolderOpen className="h-4 w-4 mr-2" /> Abrir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditPacote(p)}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicar.mutate(p)}><Copy className="h-4 w-4 mr-2" /> Duplicar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => prepararEnvio.mutate(p.id)}><Send className="h-4 w-4 mr-2" /> Preparar envio</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setEliminarId(p.id)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <NovoPacoteDialog
        open={novoOpen} onOpenChange={setNovoOpen}
        orcamentos={orcamentos}
        onCreated={() => qc.invalidateQueries({ queryKey: ["procurement-pacotes"] })}
      />
      <GerarPacotesDialog
        open={gerarOpen} onOpenChange={setGerarOpen}
        orcamentos={orcamentos}
        onCreated={() => qc.invalidateQueries({ queryKey: ["procurement-pacotes"] })}
      />
      <EditPacoteDialog
        pacote={editPacote} onOpenChange={(v: boolean) => !v && setEditPacote(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["procurement-pacotes"] })}
      />
      <AlertDialog open={!!eliminarId} onOpenChange={(v) => !v && setEliminarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar pacote?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Os artigos associados ao pacote serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (eliminarId) eliminar.mutate(eliminarId); setEliminarId(null); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "muted" | "amber" | "emerald" | "primary" }) {
  const toneCls = {
    default: "text-foreground",
    muted: "text-muted-foreground",
    amber: "text-amber-600",
    emerald: "text-emerald-600",
    primary: "text-primary",
  }[tone];
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</p>
    </Card>
  );
}

function NovoPacoteDialog({ open, onOpenChange, orcamentos, onCreated }: any) {
  const [nomeGeral, setNomeGeral] = useState("");
  const [orcamentoId, setOrcamentoId] = useState<string>("");
  const [selecionadas, setSelecionadas] = useState<Set<Especialidade>>(new Set());
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);

  function resetState() {
    setNomeGeral(""); setOrcamentoId(""); setSelecionadas(new Set()); setCounts(null);
  }

  async function onOrcamentoChange(id: string) {
    setOrcamentoId(id);
    setCounts(null);
    setSelecionadas(new Set());
    if (!id) return;
    const orc = orcamentos.find((o: any) => o.id === id);
    if (orc && !nomeGeral.trim()) {
      setNomeGeral(`Consulta ao Mercado — ${orc.obra?.nome ?? orc.nome} — V1`);
    }
    const { data: artigos, error } = await supabase
      .from("orcamento_artigos")
      .select("descricao, codigo, capitulo:orcamento_capitulos(codigo, descricao)")
      .eq("orcamento_id", id);
    if (error) { toast.error(error.message); return; }
    const c: Record<string, number> = {};
    (artigos ?? []).forEach((a: any) => {
      const esp = inferirEspecialidade({
        descricao: a.descricao, codigo: a.codigo, capituloCodigo: a.capitulo?.codigo, capitulo: a.capitulo?.descricao,
      });
      c[esp] = (c[esp] ?? 0) + 1;
    });
    setCounts(c);
  }

  function toggleEsp(esp: Especialidade) {
    setSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(esp)) next.delete(esp); else next.add(esp);
      return next;
    });
  }

  async function submit() {
    if (!orcamentoId) { toast.error("Seleciona um orçamento"); return; }
    if (!nomeGeral.trim()) { toast.error("Define o nome do pacote geral"); return; }
    if (selecionadas.size === 0) { toast.error("Seleciona pelo menos uma especialidade"); return; }
    setLoading(true);
    try {
      const orc = orcamentos.find((o: any) => o.id === orcamentoId);
      const { data: artigos, error } = await supabase
        .from("orcamento_artigos")
        .select("id, codigo, descricao, unidade, quantidade, preco_unitario, custo_mao_obra, custo_tarefeiros, custo_subempreitadas, custo_materiais, custo_equipamentos, custo_transportes, custo_encargos_gerais, custo_outros, capitulo:orcamento_capitulos(codigo, descricao)")
        .eq("orcamento_id", orcamentoId);
      if (error) throw error;

      const grupos = new Map<Especialidade, any[]>();
      const revisaoManual: Array<{ artigo: any; sugerida: Especialidade; confianca: number; motivo: string; pacote: Especialidade }> = [];
      let excluidos = 0;
      (artigos ?? []).forEach((a: any) => {
        const res = classificarArtigo({
          descricao: a.descricao, codigo: a.codigo, capituloCodigo: a.capitulo?.codigo, capitulo: a.capitulo?.descricao,
        });
        // Só inclui no pacote se a especialidade classificada coincide e a confiança é alta
        if (!selecionadas.has(res.especialidade)) { excluidos++; return; }
        if (res.confianca < CONFIANCA_MINIMA) {
          revisaoManual.push({ artigo: a, sugerida: res.especialidade, confianca: res.confianca, motivo: res.motivo, pacote: res.especialidade });
          return;
        }
        if (!grupos.has(res.especialidade)) grupos.set(res.especialidade, []);
        grupos.get(res.especialidade)!.push(a);
      });

      let criados = 0;
      let totalIncluidos = 0;
      for (const esp of selecionadas) {
        const items = grupos.get(esp) ?? [];
        const { data: novo, error: e1 } = await supabase
          .from("procurement_pacotes")
          .insert({
            orcamento_id: orcamentoId, obra_id: (orc as any)?.obra?.id ?? null,
            nome: `${nomeGeral.trim()} — ${esp}`,
            especialidade: esp, estado: "por_preparar",
            grupo_consulta: nomeGeral.trim(),
          } as any).select("id").single();
        if (e1) throw e1;
        if (items.length > 0) {
          const rows = items.map((a: any) => {
            const custoTotal = Number(a.custo_mao_obra ?? 0) + Number(a.custo_tarefeiros ?? 0)
              + Number(a.custo_subempreitadas ?? 0) + Number(a.custo_materiais ?? 0)
              + Number(a.custo_equipamentos ?? 0) + Number(a.custo_transportes ?? 0)
              + Number(a.custo_encargos_gerais ?? 0) + Number(a.custo_outros ?? 0);
            return {
              pacote_id: novo.id, artigo_id: a.id, codigo: a.codigo, descricao: a.descricao,
              unidade: a.unidade, quantidade: a.quantidade,
              capitulo: a.capitulo?.descricao ?? null, subcapitulo: null,
              preco_seco_estimado: custoTotal > 0 ? custoTotal : Number(a.preco_unitario ?? 0),
              categoria_custo: null, especialidade: esp,
            };
          });
          const { error: e2 } = await supabase.from("procurement_pacote_artigos").insert(rows);
          if (e2) throw e2;
          totalIncluidos += rows.length;
        }
        criados++;
      }
      const partes = [`${criados} pacote(s) criado(s)`, `${totalIncluidos} artigo(s) incluído(s)`];
      if (revisaoManual.length) partes.push(`${revisaoManual.length} para revisão manual`);
      if (excluidos) partes.push(`${excluidos} excluído(s) (outras especialidades)`);
      toast.success(partes.join(" · "));
      if (revisaoManual.length) {
        console.warn("[Procurement] Artigos com baixa confiança (revisão manual):", revisaoManual);
      }
      onCreated?.();
      onOpenChange(false);
      resetState();
    } catch (e: any) {
      toast.error(e.message ?? "Erro a criar pacotes");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo pacote de consulta</DialogTitle>
          <DialogDescription>
            Escolhe o orçamento, dá um nome ao pacote geral e seleciona as especialidades. O sistema cria um pacote independente por especialidade, com os artigos do mapa de quantidades correspondentes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Orçamento</Label>
            <Select value={orcamentoId} onValueChange={onOrcamentoChange}>
              <SelectTrigger><SelectValue placeholder="Seleciona um orçamento..." /></SelectTrigger>
              <SelectContent>
                {orcamentos.map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>{o.obra?.codigo ? `${o.obra.codigo} · ` : ""}{o.nome} (v{o.versao})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nome do pacote geral de consulta</Label>
            <Input value={nomeGeral} onChange={e => setNomeGeral(e.target.value)} placeholder='Ex.: "Consulta ao Mercado — Moradia Sonega — V1"' />
          </div>
          <div>
            <Label>Especialidades a consultar</Label>
            {!orcamentoId ? (
              <p className="text-xs text-muted-foreground mt-2">Seleciona primeiro um orçamento para ver as especialidades disponíveis.</p>
            ) : (
              <div className="mt-2 rounded-md border max-h-64 overflow-auto divide-y">
                {ESPECIALIDADES.map(esp => {
                  const n = counts?.[esp] ?? 0;
                  const checked = selecionadas.has(esp);
                  return (
                    <label
                      key={esp}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEsp(esp)}
                        />
                        {esp}
                      </span>
                      <Badge variant={n > 0 ? "secondary" : "outline"}>{n} art.</Badge>
                    </label>
                  );
                })}
              </div>
            )}
            {orcamentoId && counts && (
              <div className="flex gap-2 mt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelecionadas(new Set(ESPECIALIDADES))}>
                  Selecionar todas
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelecionadas(new Set())}>
                  Limpar
                </Button>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? "A criar..." : `Criar ${selecionadas.size || ""} pacote(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPacoteDialog({ pacote, onOpenChange, onSaved }: any) {
  const [nome, setNome] = useState("");
  const [especialidade, setEspecialidade] = useState("Outros");
  const [estado, setEstado] = useState<string>("por_preparar");
  useMemo(() => {
    if (pacote) { setNome(pacote.nome); setEspecialidade(pacote.especialidade); setEstado(pacote.estado); }
  }, [pacote?.id]);

  async function submit() {
    if (!pacote) return;
    const { error } = await supabase.from("procurement_pacotes")
      .update({ nome, especialidade, estado: estado as any })
      .eq("id", pacote.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pacote atualizado");
    onSaved?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={!!pacote} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar pacote</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
          <div>
            <Label>Especialidade</Label>
            <Select value={especialidade} onValueChange={setEspecialidade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ESPECIALIDADES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ESTADO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GerarPacotesDialog({ open, onOpenChange, orcamentos, onCreated }: any) {
  const [orcamentoId, setOrcamentoId] = useState<string>("");
  const [skipExistentes, setSkipExistentes] = useState(true);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Record<string, number> | null>(null);

  async function carregarPreview(id: string) {
    setOrcamentoId(id);
    setPreview(null);
    if (!id) return;
    const { data: artigos, error } = await supabase
      .from("orcamento_artigos")
      .select("descricao, codigo, capitulo:orcamento_capitulos(codigo, descricao)")
      .eq("orcamento_id", id);
    if (error) { toast.error(error.message); return; }
    const counts: Record<string, number> = {};
    (artigos ?? []).forEach((a: any) => {
      const esp = inferirEspecialidade({
        descricao: a.descricao, codigo: a.codigo, capituloCodigo: a.capitulo?.codigo, capitulo: a.capitulo?.descricao,
      });
      counts[esp] = (counts[esp] ?? 0) + 1;
    });
    setPreview(counts);
  }

  async function gerar() {
    if (!orcamentoId) { toast.error("Seleciona um orçamento"); return; }
    setLoading(true);
    try {
      const orc = orcamentos.find((o: any) => o.id === orcamentoId);
      const { data: artigos, error } = await supabase
        .from("orcamento_artigos")
        .select("id, codigo, descricao, unidade, quantidade, preco_unitario, custo_mao_obra, custo_tarefeiros, custo_subempreitadas, custo_materiais, custo_equipamentos, custo_transportes, custo_encargos_gerais, custo_outros, capitulo:orcamento_capitulos(codigo, descricao)")
        .eq("orcamento_id", orcamentoId);
      if (error) throw error;

      let jaIncluidos = new Set<string>();
      if (skipExistentes) {
        const { data: existentes } = await supabase
          .from("procurement_pacote_artigos")
          .select("artigo_id, pacote:procurement_pacotes!inner(orcamento_id)")
          .eq("pacote.orcamento_id", orcamentoId);
        jaIncluidos = new Set((existentes ?? []).map((x: any) => x.artigo_id).filter(Boolean));
      }

      const grupos = new Map<Especialidade, any[]>();
      (artigos ?? []).forEach((a: any) => {
        if (jaIncluidos.has(a.id)) return;
        const res = classificarArtigo({
          descricao: a.descricao, codigo: a.codigo, capituloCodigo: a.capitulo?.codigo, capitulo: a.capitulo?.descricao,
        });
        if (res.confianca < CONFIANCA_MINIMA) return;
        const esp = res.especialidade;
        if (!grupos.has(esp)) grupos.set(esp, []);
        grupos.get(esp)!.push(a);
      });

      if (grupos.size === 0) {
        toast.info("Não há artigos novos para agrupar.");
        setLoading(false);
        return;
      }

      let totalCriados = 0;
      for (const [esp, items] of grupos) {
        const { data: novo, error: e1 } = await supabase
          .from("procurement_pacotes")
          .insert({
            orcamento_id: orcamentoId, obra_id: (orc as any)?.obra?.id ?? null,
            nome: `${esp} — ${orc?.nome ?? "Orçamento"}`,
            especialidade: esp, estado: "por_preparar",
          }).select("id").single();
        if (e1) throw e1;
        const rows = items.map((a: any) => {
          const custoTotal = Number(a.custo_mao_obra ?? 0) + Number(a.custo_tarefeiros ?? 0)
            + Number(a.custo_subempreitadas ?? 0) + Number(a.custo_materiais ?? 0)
            + Number(a.custo_equipamentos ?? 0) + Number(a.custo_transportes ?? 0)
            + Number(a.custo_encargos_gerais ?? 0) + Number(a.custo_outros ?? 0);
          return {
            pacote_id: novo.id, artigo_id: a.id, codigo: a.codigo, descricao: a.descricao,
            unidade: a.unidade, quantidade: a.quantidade,
            capitulo: a.capitulo?.descricao ?? null, subcapitulo: null,
            preco_seco_estimado: custoTotal > 0 ? custoTotal : Number(a.preco_unitario ?? 0),
            categoria_custo: null, especialidade: esp,
          };
        });
        const { error: e2 } = await supabase.from("procurement_pacote_artigos").insert(rows);
        if (e2) throw e2;
        totalCriados++;
      }
      toast.success(`${totalCriados} pacote(s) criado(s)`);
      onCreated?.();
      onOpenChange(false);
      setOrcamentoId(""); setPreview(null);
    } catch (e: any) {
      toast.error(e.message ?? "Erro a gerar pacotes");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Gerar pacotes automaticamente</DialogTitle>
          <DialogDescription>
            O sistema vai agrupar os artigos do orçamento por especialidade (eletricidade, canalizações, etc.) e criar um pacote por grupo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Orçamento</Label>
            <Select value={orcamentoId} onValueChange={carregarPreview}>
              <SelectTrigger><SelectValue placeholder="Seleciona um orçamento..." /></SelectTrigger>
              <SelectContent>
                {orcamentos.map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>{o.obra?.codigo ? `${o.obra.codigo} · ` : ""}{o.nome} (v{o.versao})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={skipExistentes} onChange={e => setSkipExistentes(e.target.checked)} />
            Ignorar artigos já incluídos noutros pacotes deste orçamento
          </label>
          {preview && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pré-visualização</Label>
              <div className="mt-2 rounded-md border divide-y">
                {Object.entries(preview).sort((a, b) => b[1] - a[1]).map(([esp, n]) => (
                  <div key={esp} className="flex justify-between px-3 py-1.5 text-sm">
                    <span>{esp}</span>
                    <Badge variant="secondary">{n} art.</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={gerar} disabled={loading || !orcamentoId}>
            <Sparkles className="h-4 w-4 mr-2" /> {loading ? "A gerar..." : "Gerar pacotes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
