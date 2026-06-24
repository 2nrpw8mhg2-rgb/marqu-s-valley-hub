import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Save, Send, Trash2, Search, FileSpreadsheet, FileText, Users, Sparkles, AlertTriangle, CheckCircle2, MoreHorizontal, ArrowRightLeft } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useServerFn } from "@tanstack/react-start";
import { ESPECIALIDADES, validarArtigoParaEspecialidade } from "@/lib/procurement/especialidades";
import { reanalisarPacote, registarCorrecao } from "@/lib/procurement/classifier.functions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/procurement/pacotes/$id")({
  head: () => ({ meta: [{ title: "Pacote — Procurement — MV OS" }] }),
  component: PacoteDetailPage,
});

const ESTADO_LABEL: Record<string, string> = {
  por_preparar: "Por preparar", preparado: "Preparado", enviado: "Enviado",
  em_analise: "Em análise", adjudicado: "Adjudicado", cancelado: "Cancelado",
};

function fmtEUR(n: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n || 0);
}

function sanitizeFilename(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80);
}

function compareCodigo(a: string, b: string) {
  const pa = (a || "").split(".").map((p) => parseInt(p, 10));
  const pb = (b || "").split(".").map((p) => parseInt(p, 10));
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const va = isNaN(pa[i]) ? 0 : pa[i];
    const vb = isNaN(pb[i]) ? 0 : pb[i];
    if (va !== vb) return va - vb;
  }
  return (a || "").localeCompare(b || "");
}

function exportarExcel(
  nome: string,
  especialidade: string,
  artigos: any[],
  obraInfo?: { nome?: string; codigo?: string | null; cliente?: string | null },
  orcamentoInfo?: { nome?: string; versao?: number },
) {
  try {
    const rows: any[][] = [];
    rows.push(["Obra", obraInfo?.nome ?? "", "", "Código obra", obraInfo?.codigo ?? ""]);
    rows.push(["Cliente", obraInfo?.cliente ?? "", "", "Especialidade", especialidade]);
    rows.push([
      "Orçamento",
      orcamentoInfo?.nome ? `${orcamentoInfo.nome}${orcamentoInfo.versao ? ` (v${orcamentoInfo.versao})` : ""}` : "",
      "",
      "Pacote",
      nome,
    ]);
    rows.push([]);
    rows.push(["Código", "Descrição", "Un.", "Qtd.", "Preço unit.", "Total", "Observações"]);
    const headerRowIdx = rows.length - 1;

    // group by capitulo text
    const grupos = new Map<string, any[]>();
    for (const a of artigos) {
      const k = (a.capitulo as string) || "OUTROS";
      const arr = grupos.get(k) ?? [];
      arr.push(a);
      grupos.set(k, arr);
    }
    const capKeys = [...grupos.keys()].sort((x, y) => {
      const ax = grupos.get(x)![0]?.codigo ?? "";
      const ay = grupos.get(y)![0]?.codigo ?? "";
      return compareCodigo(ax, ay);
    });

    const bandRows: number[] = [];
    let total = 0;
    for (const cap of capKeys) {
      bandRows.push(rows.length);
      rows.push(["", cap.toUpperCase(), "", "", "", "", ""]);
      const arts = grupos.get(cap)!.sort((a, b) => compareCodigo(a.codigo ?? "", b.codigo ?? ""));
      for (const a of arts) {
        const qtd = Number(a.quantidade ?? 0);
        const pu = Number(a.preco_seco_estimado ?? 0);
        const t = qtd * pu;
        total += t;
        rows.push([
          a.codigo ?? "",
          a.descricao ?? "",
          a.unidade ?? "",
          qtd,
          pu || "",
          t || "",
          "",
        ]);
      }
    }
    rows.push([]);
    rows.push(["", "", "", "", "", "TOTAL", total]);
    const totalRowIdx = rows.length - 1;

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 60 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 30 }];

    // basic styling (header bold via cell.s requires cell-styles fork; xlsx community ignores it,
    // but we still set number formats which ARE preserved)
    for (let r = headerRowIdx + 1; r <= totalRowIdx; r++) {
      const qCell = XLSX.utils.encode_cell({ r, c: 3 });
      const puCell = XLSX.utils.encode_cell({ r, c: 4 });
      const tCell = XLSX.utils.encode_cell({ r, c: 5 });
      if (ws[qCell] && typeof ws[qCell].v === "number") ws[qCell].z = "#,##0.00";
      if (ws[puCell] && typeof ws[puCell].v === "number") ws[puCell].z = "#,##0.00 €";
      if (ws[tCell] && typeof ws[tCell].v === "number") ws[tCell].z = "#,##0.00 €";
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (especialidade || "Pacote").slice(0, 31));
    XLSX.writeFile(wb, `${sanitizeFilename(nome)}.xlsx`);
  } catch (err) {
    console.error("Falha a exportar Excel", err);
    toast.error("Não foi possível gerar o Excel");
  }
}

function exportarPDF(nome: string, especialidade: string, orcamentoNome: string | undefined, artigos: any[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(nome, 14, 14);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Especialidade: ${especialidade}${orcamentoNome ? "  ·  Orçamento: " + orcamentoNome : ""}`, 14, 21);
  autoTable(doc, {
    startY: 26,
    head: [["Código", "Descrição", "Unidade", "Quantidade", "Preço unitário", "Total", "Observações"]],
    body: artigos.map((a) => [
      a.codigo ?? "",
      a.descricao ?? "",
      a.unidade ?? "",
      Number(a.quantidade ?? 0).toLocaleString("pt-PT"),
      "", "", "",
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: 22 }, 1: { cellWidth: 110 }, 2: { cellWidth: 18 },
      3: { cellWidth: 22, halign: "right" }, 4: { cellWidth: 28 }, 5: { cellWidth: 24 }, 6: { cellWidth: 40 },
    },
  });
  doc.save(`${sanitizeFilename(nome)}.pdf`);
}

function PacoteDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [adicionarOpen, setAdicionarOpen] = useState(false);
  const [auditoriaOpen, setAuditoriaOpen] = useState(false);
  const [auditoria, setAuditoria] = useState<{ sinalizados: any[]; sugeridos: any[] } | null>(null);
  const [reanalising, setReanalising] = useState(false);
  const [moverState, setMoverState] = useState<{ artigo: any | null; destinoId: string }>({ artigo: null, destinoId: "" });
  const [movendo, setMovendo] = useState(false);
  const reanalisar = useServerFn(reanalisarPacote);
  const registar = useServerFn(registarCorrecao);



  const { data: pacote, isLoading } = useQuery({
    queryKey: ["procurement-pacote", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procurement_pacotes")
        .select("*, orcamento:orcamentos(id, nome, versao, obra:obras(id, nome, codigo))")
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: artigos = [] } = useQuery({
    queryKey: ["procurement-pacote-artigos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procurement_pacote_artigos")
        .select("*").eq("pacote_id", id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [nome, setNome] = useState("");
  const [especialidade, setEspecialidade] = useState("Outros");
  const [estado, setEstado] = useState("por_preparar");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (pacote) {
      setNome(pacote.nome); setEspecialidade(pacote.especialidade);
      setEstado(pacote.estado); setObservacoes(pacote.observacoes ?? "");
    }
  }, [pacote?.id]);

  const totalValor = useMemo(
    () => artigos.reduce((s: number, a: any) => s + Number(a.quantidade ?? 0) * Number(a.preco_seco_estimado ?? 0), 0),
    [artigos],
  );

  async function salvarHeader() {
    const { error } = await supabase.from("procurement_pacotes")
      .update({ nome, especialidade, estado: estado as any, observacoes })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pacote guardado");
    qc.invalidateQueries({ queryKey: ["procurement-pacote", id] });
    qc.invalidateQueries({ queryKey: ["procurement-pacotes"] });
  }

  async function removerArtigo(artigoId: string) {
    const art = artigos.find((a: any) => a.id === artigoId);
    const { error } = await supabase.from("procurement_pacote_artigos").delete().eq("id", artigoId);
    if (error) { toast.error(error.message); return; }
    if (art) {
      registar({ data: {
        artigo: { codigo: art.codigo, descricao: art.descricao, capitulo: art.capitulo, subcapitulo: art.subcapitulo },
        especialidadeAnterior: especialidade,
        especialidadeFinal: "__removido__",
        confiancaAnterior: art.confianca ?? null,
        obraId: (pacote?.orcamento as any)?.obra?.id ?? null,
        acao: "remove",
      }}).catch(() => {});
    }
    qc.invalidateQueries({ queryKey: ["procurement-pacote-artigos", id] });
  }

  async function atualizarArtigo(artigoId: string, patch: { quantidade?: number; preco_seco_estimado?: number }) {
    const { error } = await supabase.from("procurement_pacote_artigos").update(patch).eq("id", artigoId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["procurement-pacote-artigos", id] });
  }

  const { data: outrosPacotes = [] } = useQuery({
    queryKey: ["procurement-pacotes-do-orcamento", pacote?.orcamento_id],
    enabled: !!pacote?.orcamento_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procurement_pacotes")
        .select("id, nome, especialidade")
        .eq("orcamento_id", pacote!.orcamento_id)
        .neq("id", id)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function confirmarMover() {
    const art = moverState.artigo;
    const destinoId = moverState.destinoId;
    if (!art || !destinoId) return;
    const destino = outrosPacotes.find((p: any) => p.id === destinoId);
    if (!destino) return;
    setMovendo(true);
    // 1) update pacote_id + especialidade do artigo
    const { error } = await supabase
      .from("procurement_pacote_artigos")
      .update({
        pacote_id: destinoId,
        especialidade: destino.especialidade,
        sinalizado_revisao: false,
        motivo: `Movido manualmente de "${especialidade}" para "${destino.especialidade}"`,
        confianca: 1,
      })
      .eq("id", art.id);
    setMovendo(false);
    if (error) { toast.error(error.message); return; }
    // 2) aprendizagem
    registar({ data: {
      artigo: { codigo: art.codigo, descricao: art.descricao, capitulo: art.capitulo, subcapitulo: art.subcapitulo },
      especialidadeAnterior: especialidade,
      especialidadeFinal: destino.especialidade,
      confiancaAnterior: art.confianca ?? null,
      obraId: (pacote?.orcamento as any)?.obra?.id ?? null,
      acao: "move",
    }}).catch(() => {});
    toast.success(`Artigo movido para "${destino.nome}"`);
    setMoverState({ artigo: null, destinoId: "" });
    qc.invalidateQueries({ queryKey: ["procurement-pacote-artigos", id] });
    qc.invalidateQueries({ queryKey: ["procurement-pacote-artigos", destinoId] });
    qc.invalidateQueries({ queryKey: ["procurement-pacotes"] });
  }

  async function correrAuditoria() {
    setReanalising(true);
    try {
      const res: any = await reanalisar({ data: { pacoteId: id } });
      setAuditoria(res);
      setAuditoriaOpen(true);
      qc.invalidateQueries({ queryKey: ["procurement-pacote-artigos", id] });
      if (res.sinalizados.length === 0 && res.sugeridos.length === 0) {
        toast.success("Pacote tecnicamente correto — sem sinalizações");
      } else {
        toast.info(`${res.sinalizados.length} artigo(s) a rever · ${res.sugeridos.length} sugestão(ões) em falta`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Falha na auditoria");
    } finally {
      setReanalising(false);
    }
  }


  async function prepararEnvio() {
    setEstado("preparado");
    const { error } = await supabase.from("procurement_pacotes").update({ estado: "preparado" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pacote pronto para envio (módulo de envio chega no próximo passo)");
    qc.invalidateQueries({ queryKey: ["procurement-pacote", id] });
  }

  if (isLoading || !pacote) {
    return <div className="p-12 text-center text-muted-foreground">A carregar pacote...</div>;
  }

  return (
    <>
      <PageHeader
        title={nome || "Pacote"}
        subtitle={
          pacote.orcamento
            ? `${pacote.orcamento.obra?.codigo ? pacote.orcamento.obra.codigo + " · " : ""}${pacote.orcamento.nome} (v${pacote.orcamento.versao})`
            : "Pacote de consulta"
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/procurement/pacotes"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Link>
            </Button>
            <Button variant="outline" onClick={() => exportarExcel(nome || "pacote", especialidade, artigos, { nome: pacote.orcamento?.obra?.nome, codigo: pacote.orcamento?.obra?.codigo, cliente: (pacote.orcamento?.obra as any)?.cliente ?? null }, { nome: pacote.orcamento?.nome, versao: pacote.orcamento?.versao })} disabled={artigos.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" onClick={() => exportarPDF(nome || "pacote", especialidade, pacote.orcamento?.nome, artigos)} disabled={artigos.length === 0}>
              <FileText className="h-4 w-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" onClick={correrAuditoria} disabled={reanalising || artigos.length === 0}>
              <Sparkles className="h-4 w-4 mr-2" /> {reanalising ? "A reanalisar..." : "Reanalisar pacote"}
            </Button>
            <Button onClick={salvarHeader}><Save className="h-4 w-4 mr-2" /> Guardar</Button>
            <Button variant="default" onClick={prepararEnvio} disabled={artigos.length === 0}>
              <Send className="h-4 w-4 mr-2" /> Preparar envio
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        <Card className="p-4 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label>Nome do pacote</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} />
          </div>
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
          <div className="md:col-span-4">
            <Label>Observações internas</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <h2 className="text-sm font-semibold">Artigos do pacote</h2>
              <p className="text-xs text-muted-foreground">{artigos.length} artigo(s) · Total estimado {fmtEUR(totalValor)}</p>
            </div>
            <Button size="sm" onClick={() => setAdicionarOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar artigos
            </Button>
          </div>
          {artigos.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Pacote vazio. Adiciona artigos do orçamento associado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Capítulo</TableHead>
                  <TableHead>Un.</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preço seco</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artigos.map((a: any) => {
                  const conf = a.confianca != null ? Number(a.confianca) : null;
                  const confTone =
                    conf == null ? "bg-muted text-muted-foreground"
                    : conf >= 0.85 ? "bg-emerald-500/15 text-emerald-700"
                    : conf >= 0.7 ? "bg-amber-500/15 text-amber-700"
                    : "bg-red-500/15 text-red-700";
                  return (
                  <TableRow key={a.id} className={a.sinalizado_revisao ? "bg-red-500/5" : undefined}>
                    <TableCell className="font-mono text-xs">{a.codigo ?? "—"}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm">{a.descricao}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {a.sinalizado_revisao && (
                          <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-600">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Rever
                          </Badge>
                        )}
                        {conf != null && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded ${confTone}`}>
                                  {Math.round(conf * 100)}%
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">{a.motivo ?? "Sem motivo registado"}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {a.especialidade && a.especialidade !== especialidade && (
                          <Badge variant="outline" className="text-[10px]">Sugerida: {a.especialidade}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.capitulo ?? "—"}</TableCell>
                    <TableCell className="text-sm">{a.unidade ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number" step="0.01" defaultValue={a.quantidade}
                        className="w-24 text-right ml-auto"
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== Number(a.quantidade)) atualizarArtigo(a.id, { quantidade: v });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number" step="0.01" defaultValue={a.preco_seco_estimado}
                        className="w-28 text-right ml-auto"
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== Number(a.preco_seco_estimado)) atualizarArtigo(a.id, { preco_seco_estimado: v });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {fmtEUR(Number(a.quantidade ?? 0) * Number(a.preco_seco_estimado ?? 0))}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removerArtigo(a.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <AdicionarArtigosDialog
        open={adicionarOpen} onOpenChange={setAdicionarOpen}
        pacoteId={id} orcamentoId={pacote.orcamento_id} especialidade={especialidade}
        artigosJaIncluidos={new Set(artigos.map((a: any) => a.artigo_id).filter(Boolean))}
        onAdded={() => qc.invalidateQueries({ queryKey: ["procurement-pacote-artigos", id] })}
      />

      <Dialog open={auditoriaOpen} onOpenChange={setAuditoriaOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Auditoria do pacote — {especialidade}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 max-h-[60vh] overflow-auto">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Artigos a rever ({auditoria?.sinalizados.length ?? 0})
              </h3>
              {auditoria && auditoria.sinalizados.length > 0 ? (
                <div className="space-y-2">
                  {auditoria.sinalizados.map((s: any) => (
                    <div key={s.pacoteArtigoId} className="rounded-md border p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-xs text-muted-foreground">{s.codigo}</div>
                          <div>{s.descricao}</div>
                          <div className="text-xs text-muted-foreground mt-1">{s.motivo}</div>
                          {s.sugestao && (
                            <Badge variant="outline" className="mt-1 text-[10px]">Sugestão: {s.sugestao}</Badge>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removerArtigo(s.pacoteArtigoId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Nenhum artigo a rever.
                </p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Plus className="h-4 w-4 text-emerald-600" />
                Artigos em falta sugeridos ({auditoria?.sugeridos.length ?? 0})
              </h3>
              {auditoria && auditoria.sugeridos.length > 0 ? (
                <div className="space-y-2">
                  {auditoria.sugeridos.map((s: any) => (
                    <div key={s.artigoId} className="rounded-md border p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-xs text-muted-foreground">{s.codigo}</div>
                          <div>{s.descricao}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Confiança {Math.round(s.confianca * 100)}% · {s.motivo}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Usa "Adicionar artigos" para os incluir manualmente.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Nenhum artigo em falta.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setAuditoriaOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>

  );
}

function AdicionarArtigosDialog({
  open, onOpenChange, pacoteId, orcamentoId, especialidade, artigosJaIncluidos, onAdded,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  pacoteId: string; orcamentoId: string; especialidade: string;
  artigosJaIncluidos: Set<string>; onAdded: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: artigos = [] } = useQuery({
    queryKey: ["orcamento-artigos-disponiveis", orcamentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamento_artigos")
        .select("id, codigo, descricao, unidade, quantidade, preco_unitario, custo_mao_obra, custo_tarefeiros, custo_subempreitadas, custo_materiais, custo_equipamentos, custo_transportes, custo_encargos_gerais, custo_outros, capitulo:orcamento_capitulos(codigo, descricao)")
        .eq("orcamento_id", orcamentoId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const disponiveis = useMemo(() => {
    const q = search.toLowerCase();
    return artigos
      .filter((a: any) => !artigosJaIncluidos.has(a.id))
      .filter((a: any) => {
        const { valido } = validarArtigoParaEspecialidade({
          descricao: a.descricao,
          codigo: a.codigo,
          capituloCodigo: a.capitulo?.codigo,
          capitulo: a.capitulo?.descricao,
        }, especialidade);
        return valido;
      })
      .filter((a: any) => !q || a.descricao?.toLowerCase().includes(q) || a.codigo?.toLowerCase().includes(q));
  }, [artigos, artigosJaIncluidos, especialidade, search]);

  function toggle(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const registar = useServerFn(registarCorrecao);

  async function adicionar() {
    if (selecionados.size === 0) return;
    setSaving(true);
    const { pertenceAoPacote } = await import("@/lib/procurement/classifier");
    const escolhidos = artigos.filter((a: any) => selecionados.has(a.id));
    const rows = escolhidos.map((a: any) => {
      const custoTotal = Number(a.custo_mao_obra ?? 0) + Number(a.custo_tarefeiros ?? 0)
        + Number(a.custo_subempreitadas ?? 0) + Number(a.custo_materiais ?? 0)
        + Number(a.custo_equipamentos ?? 0) + Number(a.custo_transportes ?? 0)
        + Number(a.custo_encargos_gerais ?? 0) + Number(a.custo_outros ?? 0);
      const r = pertenceAoPacote({
        descricao: a.descricao, codigo: a.codigo,
        capitulo: a.capitulo?.descricao, capituloCodigo: a.capitulo?.codigo,
      }, especialidade);
      return {
        pacote_id: pacoteId, artigo_id: a.id, codigo: a.codigo, descricao: a.descricao,
        unidade: a.unidade, quantidade: a.quantidade,
        capitulo: a.capitulo?.descricao ?? null, subcapitulo: null,
        preco_seco_estimado: custoTotal > 0 ? custoTotal : Number(a.preco_unitario ?? 0),
        categoria_custo: null, especialidade,
        confianca: r.confianca, motivo: r.motivo, sinalizado_revisao: !r.pertence,
      };
    });
    const { error } = await supabase.from("procurement_pacote_artigos").insert(rows);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    // Aprendizagem: cada adição manual é uma decisão do utilizador
    for (const a of escolhidos) {
      registar({ data: {
        artigo: { codigo: a.codigo, descricao: a.descricao, capitulo: a.capitulo?.descricao, subcapitulo: null },
        especialidadeAnterior: null,
        especialidadeFinal: especialidade,
        confiancaAnterior: null,
        obraId: null,
        acao: "add",
      }}).catch(() => {});
    }
    toast.success(`${rows.length} artigo(s) adicionado(s)`);
    setSelecionados(new Set()); setSearch("");
    onAdded(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Adicionar artigos ao pacote</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Pesquisar por código ou descrição..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Capítulo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">PV unit.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disponiveis.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem artigos disponíveis.</TableCell></TableRow>
                ) : disponiveis.map((a: any) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => toggle(a.id)}>
                    <TableCell><Checkbox checked={selecionados.has(a.id)} onCheckedChange={() => toggle(a.id)} /></TableCell>
                    <TableCell className="font-mono text-xs">{a.codigo ?? "—"}</TableCell>
                    <TableCell className="text-sm max-w-md truncate">{a.descricao}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.capitulo?.descricao ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">{Number(a.quantidade).toFixed(2)}</TableCell>
                    <TableCell className="text-right text-sm">{fmtEUR(Number(a.preco_unitario))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter>
          <span className="mr-auto text-sm text-muted-foreground">{selecionados.size} selecionado(s)</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={adicionar} disabled={saving || selecionados.size === 0}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
