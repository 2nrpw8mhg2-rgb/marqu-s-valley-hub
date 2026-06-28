import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Plus, Search, HardHat } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/obras")({
  head: () => ({ meta: [{ title: "CRM de Obras — MV OS" }] }),
  component: ObrasPage,
});

const ESTADOS = [
  { v: "oportunidade", l: "Oportunidade" },
  { v: "em_curso", l: "Em curso" },
  { v: "concluida", l: "Concluída" },
  { v: "cancelada", l: "Cancelada" },
] as const;

function ObrasPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ["obras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = obras.filter((o) =>
    [o.nome, o.cliente, o.codigo, o.localizacao]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <PageHeader
        title="CRM de Obras"
        subtitle="Oportunidades, obras em curso e histórico"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-1.5" /> Nova obra
              </Button>
            </DialogTrigger>
            <NovaObraDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["obras"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); }} />
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
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Valor estimado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">A carregar...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <HardHat className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">Sem obras. Cria a primeira para começar.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((o) => (
                  <TableRow
                    key={o.id}
                    className="border-border cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate({ to: "/obras/$id", params: { id: o.id } })}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{o.codigo || "—"}</TableCell>
                    <TableCell className="font-medium">{o.nome}</TableCell>
                    <TableCell>{o.cliente || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{o.localizacao || "—"}</TableCell>
                    <TableCell><EstadoBadge estado={o.estado} /></TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.valor_estimado ? `€ ${Number(o.valor_estimado).toLocaleString("pt-PT")}` : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}

function NovaObraDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    codigo: "",
    nome: "",
    cliente: "",
    localizacao: "",
    estado: "oportunidade",
    valor_estimado: "",
    data_inicio: "",
    data_fim_prevista: "",
    descricao: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("obras").insert({
      codigo: form.codigo || null,
      nome: form.nome,
      cliente: form.cliente || null,
      localizacao: form.localizacao || null,
      estado: form.estado as any,
      valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
      data_inicio: form.data_inicio || null,
      data_fim_prevista: form.data_fim_prevista || null,
      descricao: form.descricao || null,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Obra criada");
    onClose();
  };

  return (
    <DialogContent className="bg-card border-border max-w-2xl">
      <DialogHeader><DialogTitle>Nova obra</DialogTitle></DialogHeader>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-1">
          <Label>Código</Label>
          <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="MV-2026-001" />
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label>Estado</Label>
          <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ESTADOS.map((e) => <SelectItem key={e.v} value={e.v}>{e.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Nome *</Label>
          <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </div>
        <div className="space-y-2"><Label>Cliente</Label><Input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></div>
        <div className="space-y-2"><Label>Localização</Label><Input value={form.localizacao} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} /></div>
        <div className="space-y-2"><Label>Valor estimado (€)</Label><Input type="number" step="0.01" value={form.valor_estimado} onChange={(e) => setForm({ ...form, valor_estimado: e.target.value })} /></div>
        <div className="space-y-2"><Label>Data início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
        <div className="space-y-2"><Label>Data fim prevista</Label><Input type="date" value={form.data_fim_prevista} onChange={(e) => setForm({ ...form, data_fim_prevista: e.target.value })} /></div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Descrição</Label>
          <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
        </div>
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? "A guardar..." : "Criar obra"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    oportunidade: { label: "Oportunidade", cls: "bg-chart-3/15 text-chart-3 border-chart-3/30" },
    em_curso: { label: "Em curso", cls: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] border-[color:var(--color-success)]/30" },
    concluida: { label: "Concluída", cls: "bg-muted text-muted-foreground border-border" },
    cancelada: { label: "Cancelada", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  const v = map[estado] ?? map.oportunidade;
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border whitespace-nowrap ${v.cls}`}>{v.label}</span>;
}
