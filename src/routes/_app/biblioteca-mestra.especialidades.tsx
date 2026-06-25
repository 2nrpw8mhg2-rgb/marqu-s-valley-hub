import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { Especialidade } from "@/lib/biblioteca-mestra/types";

export const Route = createFileRoute("/_app/biblioteca-mestra/especialidades")({
  head: () => ({ meta: [{ title: "Especialidades — Biblioteca Mestra — MV OS" }] }),
  component: EspecialidadesPage,
});

function EspecialidadesPage() {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Especialidade> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["bm-esp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_especialidades")
        .select("*")
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return data as Especialidade[];
    },
  });

  const save = useMutation({
    mutationFn: async (e: Partial<Especialidade>) => {
      if (!e.nome?.trim()) throw new Error("Nome obrigatório");
      if (e.id) {
        const { error } = await supabase
          .from("biblioteca_especialidades")
          .update({
            nome: e.nome.trim(),
            codigo: e.codigo ?? null,
            descricao: e.descricao ?? null,
            ordem: e.ordem ?? 0,
            ativa: e.ativa ?? true,
          })
          .eq("id", e.id);
        if (error) throw error;
      } else {
        const maxOrdem = Math.max(0, ...rows.map((r) => r.ordem)) + 1;
        const { error } = await supabase.from("biblioteca_especialidades").insert({
          nome: e.nome.trim(),
          codigo: e.codigo ?? null,
          descricao: e.descricao ?? null,
          ordem: e.ordem ?? maxOrdem,
          ativa: e.ativa ?? true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-esp"] });
      setEditOpen(false);
      setEditing(null);
      toast.success("Guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("biblioteca_especialidades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-esp"] });
      setDeleteId(null);
      toast.success("Eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const sorted = [...rows].sort((a, b) => a.ordem - b.ordem);
      const idx = sorted.findIndex((r) => r.id === id);
      const swap = sorted[idx + dir];
      if (!swap) return;
      const a = sorted[idx];
      await supabase.from("biblioteca_especialidades").update({ ordem: swap.ordem }).eq("id", a.id);
      await supabase.from("biblioteca_especialidades").update({ ordem: a.ordem }).eq("id", swap.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bm-esp"] }),
  });

  return (
    <>
      <PageHeader
        title="Especialidades"
        subtitle="Topo da hierarquia da Biblioteca Mestra"
        actions={
          <Button onClick={() => { setEditing({ ativa: true }); setEditOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova
          </Button>
        }
      />
      <div className="p-6">
        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Ordem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-20">Estado</TableHead>
                <TableHead className="w-40 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">A carregar...</TableCell></TableRow>}
              {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Sem especialidades</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move.mutate({ id: r.id, dir: -1 })}><ArrowUp className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move.mutate({ id: r.id, dir: 1 })}><ArrowDown className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
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
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} Especialidade</DialogTitle></DialogHeader>
          <div className="space-y-3">
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
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar especialidade?</AlertDialogTitle>
            <AlertDialogDescription>Todas as subespecialidades e artigos associados serão também eliminados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove.mutate(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
