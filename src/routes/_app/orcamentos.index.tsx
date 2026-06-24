import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Calculator, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { fmtEUR, lineTotal } from "@/lib/orcamento-utils";

export const Route = createFileRoute("/_app/orcamentos")({
  head: () => ({ meta: [{ title: "Orçamentos — MV OS" }] }),
  component: OrcamentosPage,
});

const ESTADOS = [
  { v: "rascunho", l: "Rascunho", c: "bg-muted text-muted-foreground border-border" },
  { v: "enviado", l: "Enviado", c: "bg-chart-3/15 text-chart-3 border-chart-3/30" },
  { v: "adjudicado", l: "Adjudicado", c: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] border-[color:var(--color-success)]/30" },
  { v: "perdido", l: "Perdido", c: "bg-destructive/15 text-destructive border-destructive/30" },
  { v: "cancelada", l: "Cancelado", c: "bg-muted text-muted-foreground/70 border-border" },
] as const;

function OrcamentosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["orcamentos-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*, obra:obras(id, nome, codigo, cliente), artigos:orcamento_artigos(quantidade, preco_unitario, margem_pct)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = rows.filter((o: any) =>
    [o.nome, o.obra?.nome, o.obra?.codigo, o.obra?.cliente]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <PageHeader
        title="Orçamentos"
        subtitle="Propostas comerciais, mapas de quantidades e versões"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-1.5" /> Novo orçamento
              </Button>
            </DialogTrigger>
            <NovoOrcamentoDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["orcamentos-list"] }); }} />
          </Dialog>
        }
      />

      <div className="p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card className="bg-card border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Orçamento</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">A carregar...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <Calculator className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">Sem orçamentos. Cria o primeiro para importar um MQ.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((o: any) => {
                  const subtotal = (o.artigos ?? []).reduce((acc: number, a: any) => acc + lineTotal({
                    quantidade: Number(a.quantidade), preco_unitario: Number(a.preco_unitario), margem_pct: Number(a.margem_pct),
                  }), 0);
                  const total = subtotal * (1 + Number(o.margem_global_pct || 0) / 100);
                  const est = ESTADOS.find(e => e.v === o.estado) ?? ESTADOS[0];
                  return (
                    <TableRow key={o.id} className="border-border">
                      <TableCell className="font-medium">{o.nome}</TableCell>
                      <TableCell>
                        {o.obra ? <span className="text-muted-foreground"><span className="font-mono text-xs">{o.obra.codigo || ""}</span> {o.obra.nome}</span> : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{o.obra?.cliente || "—"}</TableCell>
                      <TableCell><span className="font-mono text-xs">v{o.versao}</span></TableCell>
                      <TableCell>
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${est.c}`}>{est.l}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtEUR(total)}</TableCell>
                      <TableCell className="text-right">
                        <Link to="/orcamentos/$id" params={{ id: o.id }}>
                          <Button size="sm" variant="ghost"><ArrowRight className="h-4 w-4" /></Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}

function NovoOrcamentoDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [obraId, setObraId] = useState("");
  const [nome, setNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: obras = [] } = useQuery({
    queryKey: ["obras-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, nome, codigo").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obraId) { toast.error("Escolhe uma obra"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: existentes } = await supabase.from("orcamentos").select("versao").eq("obra_id", obraId).order("versao", { ascending: false }).limit(1);
    const versao = (existentes?.[0]?.versao ?? 0) + 1;
    const { data, error } = await supabase.from("orcamentos").insert({
      obra_id: obraId, nome, observacoes: observacoes || null, versao, created_by: user?.id,
    }).select("id").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Orçamento criado");
    onClose();
    navigate({ to: "/orcamentos/$id", params: { id: data.id } });
  };

  return (
    <DialogContent className="bg-card border-border max-w-lg">
      <DialogHeader><DialogTitle>Novo orçamento</DialogTitle></DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2">
          <Label>Obra *</Label>
          <Select value={obraId} onValueChange={setObraId}>
            <SelectTrigger><SelectValue placeholder="Escolhe uma obra" /></SelectTrigger>
            <SelectContent>
              {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.codigo ? `${o.codigo} · ` : ""}{o.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {obras.length === 0 && <p className="text-xs text-muted-foreground">Cria primeiro uma obra em CRM de Obras.</p>}
        </div>
        <div className="space-y-2">
          <Label>Nome do orçamento *</Label>
          <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Proposta inicial" />
        </div>
        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? "A criar..." : "Criar e abrir editor"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
