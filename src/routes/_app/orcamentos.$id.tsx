import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImportMQDialog } from "@/components/orcamentos/ImportMQDialog";
import { exportToExcel, exportToPDF, type ExportData } from "@/lib/orcamento-export";
import { fmtEUR, fmtNum, lineTotal } from "@/lib/orcamento-utils";
import type { ParsedRow } from "@/lib/mq-parser";
import { Upload, FileDown, FileSpreadsheet, Trash2, Plus, ArrowLeft, GitBranch, Save, Layers } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/orcamentos/$id")({
  head: () => ({ meta: [{ title: "Editor de orçamento — MV OS" }] }),
  component: OrcamentoEditor,
});

type Cap = { id: string; codigo: string | null; descricao: string; ordem: number };
type Art = {
  id: string;
  capitulo_id: string | null;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  preco_unitario: number;
  margem_pct: number;
  ordem: number;
  _dirty?: boolean;
  _new?: boolean;
};

const ESTADOS = ["rascunho", "enviado", "adjudicado", "perdido", "cancelado"] as const;

function OrcamentoEditor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["orcamento", id],
    queryFn: async () => {
      const { data: orc, error: e1 } = await supabase
        .from("orcamentos")
        .select("*, obra:obras(id, nome, codigo, cliente)")
        .eq("id", id).single();
      if (e1) throw e1;
      const { data: caps, error: e2 } = await supabase
        .from("orcamento_capitulos").select("*").eq("orcamento_id", id).order("ordem");
      if (e2) throw e2;
      const { data: arts, error: e3 } = await supabase
        .from("orcamento_artigos").select("*").eq("orcamento_id", id).order("ordem");
      if (e3) throw e3;
      return { orcamento: orc, capitulos: caps as Cap[], artigos: (arts as any[]).map(a => ({ ...a, quantidade: Number(a.quantidade), preco_unitario: Number(a.preco_unitario), margem_pct: Number(a.margem_pct) })) as Art[] };
    },
  });

  const [capsState, setCapsState] = useState<Cap[]>([]);
  const [artsState, setArtsState] = useState<Art[]>([]);
  const [meta, setMeta] = useState({ nome: "", estado: "rascunho", margem_global_pct: 0, observacoes: "" });
  useEffect(() => {
    if (!data) return;
    setCapsState(data.capitulos);
    setArtsState(data.artigos);
    setMeta({
      nome: data.orcamento.nome,
      estado: data.orcamento.estado,
      margem_global_pct: Number(data.orcamento.margem_global_pct),
      observacoes: data.orcamento.observacoes ?? "",
    });
  }, [data]);

  const totals = useMemo(() => {
    const subtotal = artsState.reduce((acc, a) => acc + lineTotal(a), 0);
    const total = subtotal * (1 + (meta.margem_global_pct || 0) / 100);
    return { subtotal, total };
  }, [artsState, meta.margem_global_pct]);

  const updateArt = (idx: number, patch: Partial<Art>) => {
    setArtsState((prev) => prev.map((a, i) => i === idx ? { ...a, ...patch, _dirty: true } : a));
  };

  const addArt = (capId: string | null) => {
    const ordem = Math.max(0, ...artsState.filter(a => a.capitulo_id === capId).map(a => a.ordem)) + 10;
    setArtsState((prev) => [...prev, {
      id: crypto.randomUUID(), _new: true, _dirty: true,
      capitulo_id: capId, codigo: null, descricao: "Novo artigo", unidade: null,
      quantidade: 0, preco_unitario: 0, margem_pct: 0, ordem,
    }]);
  };

  const removeArt = async (idx: number) => {
    const a = artsState[idx];
    if (!a._new) {
      await supabase.from("orcamento_artigos").delete().eq("id", a.id);
    }
    setArtsState((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: e1 } = await supabase.from("orcamentos").update({
        nome: meta.nome,
        estado: meta.estado as any,
        margem_global_pct: meta.margem_global_pct,
        observacoes: meta.observacoes || null,
      }).eq("id", id);
      if (e1) throw e1;

      const toInsert = artsState.filter(a => a._new).map(({ id: _id, _new, _dirty, ...rest }) => ({ ...rest, orcamento_id: id }));
      const toUpdate = artsState.filter(a => !a._new && a._dirty);

      if (toInsert.length) {
        const { error } = await supabase.from("orcamento_artigos").insert(toInsert);
        if (error) throw error;
      }
      for (const a of toUpdate) {
        const { _dirty, _new, ...rest } = a;
        const { error } = await supabase.from("orcamento_artigos").update(rest).eq("id", a.id);
        if (error) throw error;
      }

      // alimenta biblioteca de artigos (best-effort, sem unique)
      for (const a of artsState) {
        if (!a.descricao || !a.preco_unitario) continue;
        const { data: existing } = await supabase
          .from("artigos_biblioteca")
          .select("id")
          .eq("descricao", a.descricao)
          .maybeSingle();
        const payload = {
          codigo: a.codigo, descricao: a.descricao, unidade: a.unidade,
          preco_referencia: a.preco_unitario, ultima_obra_id: data?.orcamento.obra_id,
        };
        if (existing?.id) {
          await supabase.from("artigos_biblioteca").update(payload).eq("id", existing.id);
        } else {
          await supabase.from("artigos_biblioteca").insert(payload);
        }
      }

      toast.success("Orçamento guardado");
      qc.invalidateQueries({ queryKey: ["orcamento", id] });
      qc.invalidateQueries({ queryKey: ["orcamentos-list"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const handleImport = async (rows: ParsedRow[]) => {
    // wipe existing
    await supabase.from("orcamento_artigos").delete().eq("orcamento_id", id);
    await supabase.from("orcamento_capitulos").delete().eq("orcamento_id", id);

    const caps: { id: string; codigo: string | null; descricao: string; ordem: number; orcamento_id: string }[] = [];
    const arts: { id: string; orcamento_id: string; capitulo_id: string | null; codigo: string | null; descricao: string; unidade: string | null; quantidade: number; preco_unitario: number; margem_pct: number; ordem: number }[] = [];

    let currentCapId: string | null = null;
    let capOrdem = 0, artOrdem = 0;

    for (const r of rows) {
      if (r.isCapitulo) {
        const capId = crypto.randomUUID();
        caps.push({ id: capId, orcamento_id: id, codigo: r.codigo, descricao: r.descricao, ordem: (capOrdem += 10) });
        currentCapId = capId;
      } else {
        arts.push({
          id: crypto.randomUUID(), orcamento_id: id, capitulo_id: currentCapId,
          codigo: r.codigo, descricao: r.descricao, unidade: r.unidade,
          quantidade: r.quantidade, preco_unitario: r.preco_unitario, margem_pct: 0, ordem: (artOrdem += 10),
        });
      }
    }
    if (caps.length) {
      const { error } = await supabase.from("orcamento_capitulos").insert(caps);
      if (error) throw error;
    }
    if (arts.length) {
      const { error } = await supabase.from("orcamento_artigos").insert(arts);
      if (error) throw error;
    }
    qc.invalidateQueries({ queryKey: ["orcamento", id] });
  };

  const novaVersao = async () => {
    if (!data) return;
    const { data: ult } = await supabase.from("orcamentos").select("versao").eq("obra_id", data.orcamento.obra_id).order("versao", { ascending: false }).limit(1);
    const versao = (ult?.[0]?.versao ?? 0) + 1;
    const { data: novo, error } = await supabase.from("orcamentos").insert({
      obra_id: data.orcamento.obra_id, nome: `${meta.nome} (v${versao})`, versao,
      margem_global_pct: meta.margem_global_pct, observacoes: meta.observacoes,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    // clone capitulos + artigos
    const capMap = new Map<string, string>();
    if (capsState.length) {
      const newCaps = capsState.map(c => { const nid = crypto.randomUUID(); capMap.set(c.id, nid); return { id: nid, orcamento_id: novo.id, codigo: c.codigo, descricao: c.descricao, ordem: c.ordem }; });
      await supabase.from("orcamento_capitulos").insert(newCaps);
    }
    if (artsState.length) {
      const newArts = artsState.map(a => ({
        orcamento_id: novo.id,
        capitulo_id: a.capitulo_id ? capMap.get(a.capitulo_id) ?? null : null,
        codigo: a.codigo, descricao: a.descricao, unidade: a.unidade,
        quantidade: a.quantidade, preco_unitario: a.preco_unitario, margem_pct: a.margem_pct, ordem: a.ordem,
      }));
      await supabase.from("orcamento_artigos").insert(newArts);
    }
    toast.success(`Versão v${versao} criada`);
    navigate({ to: "/orcamentos/$id", params: { id: novo.id } });
  };

  const doExportPDF = () => {
    if (!data) return;
    const payload: ExportData = {
      orcamento: { nome: meta.nome, versao: data.orcamento.versao, estado: meta.estado, observacoes: meta.observacoes, margem_global_pct: meta.margem_global_pct },
      obra: { nome: data.orcamento.obra?.nome ?? "", codigo: data.orcamento.obra?.codigo ?? null, cliente: data.orcamento.obra?.cliente ?? null },
      capitulos: capsState, artigos: artsState,
    };
    exportToPDF(payload);
  };
  const doExportExcel = () => {
    if (!data) return;
    const payload: ExportData = {
      orcamento: { nome: meta.nome, versao: data.orcamento.versao, estado: meta.estado, observacoes: meta.observacoes, margem_global_pct: meta.margem_global_pct },
      obra: { nome: data.orcamento.obra?.nome ?? "", codigo: data.orcamento.obra?.codigo ?? null, cliente: data.orcamento.obra?.cliente ?? null },
      capitulos: capsState, artigos: artsState,
    };
    exportToExcel(payload);
  };

  if (isLoading || !data) {
    return <div className="p-12 text-center text-muted-foreground">A carregar...</div>;
  }

  // group artigos by capitulo
  const grouped = capsState.map(c => ({ cap: c, items: artsState.map((a, i) => ({ a, i })).filter(x => x.a.capitulo_id === c.id).sort((a, b) => a.a.ordem - b.a.ordem) }));
  const semCap = artsState.map((a, i) => ({ a, i })).filter(x => !x.a.capitulo_id || !capsState.find(c => c.id === x.a.capitulo_id));

  return (
    <>
      <PageHeader
        title={meta.nome || "Orçamento"}
        subtitle={`${data.orcamento.obra?.codigo ? data.orcamento.obra.codigo + " · " : ""}${data.orcamento.obra?.nome ?? ""} · v${data.orcamento.versao}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/orcamentos"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Lista</Button></Link>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" /> Importar MQ</Button>
            <Button variant="outline" size="sm" onClick={novaVersao}><GitBranch className="h-4 w-4 mr-1" /> Nova versão</Button>
            <Button variant="outline" size="sm" onClick={doExportExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={doExportPDF}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Save className="h-4 w-4 mr-1" /> {saving ? "A guardar..." : "Guardar"}
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        <Card className="bg-card border-border p-4 grid sm:grid-cols-4 gap-4">
          <div className="space-y-1.5"><Label>Nome</Label><Input value={meta.nome} onChange={(e) => setMeta({ ...meta, nome: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select value={meta.estado} onValueChange={(v) => setMeta({ ...meta, estado: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Margem global %</Label>
            <div className="flex gap-1">
              <Input type="number" step="0.1" value={meta.margem_global_pct} onChange={(e) => setMeta({ ...meta, margem_global_pct: Number(e.target.value) })} />
              <Button
                variant="outline"
                size="sm"
                title="Aplicar esta margem a todas as linhas"
                onClick={() => {
                  const m = meta.margem_global_pct || 0;
                  setArtsState((prev) => prev.map((a) => ({ ...a, margem_pct: m, _dirty: true })));
                  setMeta((mt) => ({ ...mt, margem_global_pct: 0 }));
                  toast.success(`Margem de ${m}% aplicada a todas as linhas`);
                }}
              >Aplicar</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Total proposta</Label>
            <div className="h-9 flex items-center px-3 rounded-md bg-primary/10 text-primary font-semibold tabular-nums">{fmtEUR(totals.total)}</div>
          </div>
        </Card>

        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 w-24">Código</th>
                  <th className="text-left px-3 py-2">Descrição</th>
                  <th className="text-left px-3 py-2 w-20">Un.</th>
                  <th className="text-right px-3 py-2 w-24">Qtd.</th>
                  <th className="text-right px-3 py-2 w-28">P. Unit.</th>
                  <th className="text-right px-3 py-2 w-20">Marg.%</th>
                  <th className="text-right px-3 py-2 w-28">Total</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {grouped.length === 0 && semCap.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-16 text-muted-foreground">
                    Vazio. <button onClick={() => setImportOpen(true)} className="text-primary underline">Importa um MQ</button> ou adiciona artigos manualmente.
                  </td></tr>
                )}
                {grouped.map(({ cap, items }) => (
                  <CapGroup key={cap.id} cap={cap} items={items} updateArt={updateArt} removeArt={removeArt} addArt={() => addArt(cap.id)} />
                ))}
                {semCap.length > 0 && (
                  <CapGroup
                    cap={{ id: "", codigo: null, descricao: "Sem capítulo", ordem: 9999 }}
                    items={semCap} updateArt={updateArt} removeArt={removeArt} addArt={() => addArt(null)}
                  />
                )}
                <tr className="bg-muted/30">
                  <td colSpan={6} className="text-right px-3 py-2 font-medium">Subtotal</td>
                  <td className="text-right px-3 py-2 tabular-nums font-medium">{fmtEUR(totals.subtotal)}</td>
                  <td></td>
                </tr>
                <tr className="bg-muted/30">
                  <td colSpan={6} className="text-right px-3 py-2 text-muted-foreground">Margem global {meta.margem_global_pct}%</td>
                  <td className="text-right px-3 py-2 tabular-nums">{fmtEUR(totals.total - totals.subtotal)}</td>
                  <td></td>
                </tr>
                <tr className="bg-primary/10">
                  <td colSpan={6} className="text-right px-3 py-3 font-semibold">TOTAL</td>
                  <td className="text-right px-3 py-3 tabular-nums font-semibold text-primary">{fmtEUR(totals.total)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <ImportMQDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
    </>
  );
}

function CapGroup({ cap, items, updateArt, removeArt, addArt }: {
  cap: Cap;
  items: { a: Art; i: number }[];
  updateArt: (i: number, patch: Partial<Art>) => void;
  removeArt: (i: number) => void;
  addArt: () => void;
}) {
  return (
    <>
      <tr className="bg-primary/5 border-t border-border">
        <td className="px-3 py-2 font-mono text-xs text-primary">{cap.codigo}</td>
        <td colSpan={6} className="px-3 py-2 font-semibold uppercase tracking-wide text-sm">{cap.descricao}</td>
        <td className="px-2">
          <Button size="icon" variant="ghost" onClick={addArt} title="Adicionar artigo"><Plus className="h-3.5 w-3.5" /></Button>
        </td>
      </tr>
      {items.map(({ a, i }) => (
        <tr key={a.id} className="border-t border-border hover:bg-muted/20">
          <td className="px-2"><Input className="h-8 text-xs font-mono" value={a.codigo ?? ""} onChange={(e) => updateArt(i, { codigo: e.target.value })} /></td>
          <td className="px-2"><Input className="h-8 text-xs" value={a.descricao} onChange={(e) => updateArt(i, { descricao: e.target.value })} /></td>
          <td className="px-2"><Input className="h-8 text-xs" value={a.unidade ?? ""} onChange={(e) => updateArt(i, { unidade: e.target.value })} /></td>
          <td className="px-2"><Input className="h-8 text-xs text-right tabular-nums" type="number" step="0.01" value={a.quantidade} onChange={(e) => updateArt(i, { quantidade: Number(e.target.value) })} /></td>
          <td className="px-2"><Input className="h-8 text-xs text-right tabular-nums" type="number" step="0.01" value={a.preco_unitario} onChange={(e) => updateArt(i, { preco_unitario: Number(e.target.value) })} /></td>
          <td className="px-2"><Input className="h-8 text-xs text-right tabular-nums" type="number" step="0.1" value={a.margem_pct} onChange={(e) => updateArt(i, { margem_pct: Number(e.target.value) })} /></td>
          <td className="px-3 py-1 text-right tabular-nums text-xs font-medium">{fmtNum(lineTotal(a))} €</td>
          <td className="px-1"><Button size="icon" variant="ghost" onClick={() => removeArt(i)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></td>
        </tr>
      ))}
    </>
  );
}
