import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import type { Especialidade, Subespecialidade } from "@/lib/biblioteca-mestra/types";

export const Route = createFileRoute("/_app/biblioteca-mestra/subespecialidades")({
  head: () => ({ meta: [{ title: "Subespecialidades — Biblioteca Mestra — MV OS" }] }),
  component: SubesPage,
});

function SubesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [espFilter, setEspFilter] = useState<string>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Subespecialidade> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: esps = [] } = useQuery({
    queryKey: ["bm-esp"],
    queryFn: async () => {
      const { data, error } = await supabase.from("biblioteca_especialidades").select("*").order("ordem");
      if (error) throw error;
      return data as Especialidade[];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["bm-sub"],
    queryFn: async () => {
      const { data, error } = await supabase.from("biblioteca_subespecialidades").select("*").order("ordem").order("nome");
      if (error) throw error;
      return data as Subespecialidade[];
    },
  });

  const espMap = useMemo(() => new Map(esps.map((e) => [e.id, e])), [esps]);

  const filtered = rows.filter((r) => {
    if (espFilter !== "all" && r.especialidade_id !== espFilter) return false;
    if (search.trim()) {
      const t = search.toLowerCase();
      return (
        r.nome.toLowerCase().includes(t) ||
        (r.codigo ?? "").toLowerCase().includes(t) ||
        (r.descricao ?? "").toLowerCase().includes(t)
      );
    }
    return true;
  });

  const save = useMutation({
    mutationFn: async (s: Partial<Subespecialidade>) => {
      if (!s.nome?.trim()) throw new Error("Nome obrigatório");
      if (!s.especialidade_id) throw new Error("Especialidade obrigatória");
      const payload = {
        especialidade_id: s.especialidade_id,
        nome: s.nome.trim(),
        codigo: s.codigo ?? null,
        descricao: s.descricao ?? null,
        ordem: s.ordem ?? 0,
        ativa: s.ativa ?? true,
      };
      if (s.id) {
        const { error } = await supabase.from("biblioteca_subespecialidades").update(payload).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("biblioteca_subespecialidades").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-sub"] });
      setEditOpen(false);
      setEditing(null);
      toast.success("Guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("biblioteca_subespecialidades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bm-sub"] }); setDeleteId(null); toast.success("Eliminada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Subespecialidades"
        subtitle="Agrupamentos dentro de cada especialidade"
        actions={
          <Button onClick={() => { setEditing({ ativa: true, especialidade_id: espFilter !== "all" ? espFilter : esps[0]?.id }); setEditOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={espFilter} onValueChange={setEspFilter}>
            <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as especialidades</SelectItem>
              {esps.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Especialidade</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-20">Estado</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">A carregar...</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Sem subespecialidades</TableCell></TableRow>}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{espMap.get(r.especialidade_id)?.nome ?? "—"}</TableCell>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell className="font-mono text-xs">{r.codigo ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.descricao ?? "—"}</TableCell>
                  <TableCell>{r.ativa ? <Badge variant="secondary">Ativa</Badge> : <Badge variant="outline">Inativa</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setEditOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} Subespecialidade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Especialidade *</Label>
              <Select value={editing?.especialidade_id} onValueChange={(v) => setEditing({ ...editing, especialidade_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {esps.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nome *</Label><Input value={editing?.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
            <div><Label>Código</Label><Input value={editing?.codigo ?? ""} onChange={(e) => setEditing({ ...editing, codigo: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={editing?.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} /></div>
            <div><Label>Ordem</Label><Input type="number" value={editing?.ordem ?? 0} onChange={(e) => setEditing({ ...editing, ordem: Number(e.target.value) })} /></div>
            <div className="flex items-center gap-2"><Switch checked={editing?.ativa ?? true} onCheckedChange={(v) => setEditing({ ...editing, ativa: v })} /><Label>Ativa</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Eliminar subespecialidade?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove.mutate(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
