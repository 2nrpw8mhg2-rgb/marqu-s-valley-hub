import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Unidade } from "@/lib/biblioteca-mestra/types";

export const Route = createFileRoute("/_app/biblioteca-mestra/unidades")({
  head: () => ({ meta: [{ title: "Unidades — Biblioteca Mestra — MV OS" }] }),
  component: UnidadesPage,
});

type EditState = Partial<Unidade>;

function UnidadesPage() {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["bm-unidades-all"],
    queryFn: async () => (await supabase.from("biblioteca_unidades").select("*").order("ordem").order("codigo")).data as Unidade[],
  });

  const openEdit = (u?: Unidade) => {
    setEditing(u ? { ...u } : { ativa: true, ordem: 100 });
    setEditOpen(true);
  };

  const save = useMutation({
    mutationFn: async (e: EditState) => {
      if (!e.codigo?.trim()) throw new Error("Código obrigatório");
      if (!e.simbolo?.trim()) throw new Error("Símbolo obrigatório");
      if (!e.nome?.trim()) throw new Error("Nome obrigatório");
      const payload = {
        codigo: e.codigo.trim(),
        simbolo: e.simbolo.trim(),
        nome: e.nome.trim(),
        categoria: e.categoria?.trim() || null,
        ordem: e.ordem ?? 100,
        ativa: e.ativa ?? true,
      };
      if (e.id) {
        const { error } = await supabase.from("biblioteca_unidades").update(payload).eq("id", e.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("biblioteca_unidades").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-unidades-all"] });
      qc.invalidateQueries({ queryKey: ["bm-unidades"] });
      setEditOpen(false);
      setEditing(null);
      toast.success("Guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("biblioteca_unidades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-unidades-all"] });
      qc.invalidateQueries({ queryKey: ["bm-unidades"] });
      setDeleteId(null);
      toast.success("Eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Unidades"
        subtitle="Lista normalizada de unidades de medida usadas nos Artigos Mestre"
        actions={<Button onClick={() => openEdit()}><Plus className="h-4 w-4 mr-1" /> Nova</Button>}
      />
      <div className="p-6 space-y-4">
        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead className="w-24">Símbolo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="w-20">Ordem</TableHead>
                <TableHead className="w-24">Estado</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">A carregar...</TableCell></TableRow>}
              {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Sem unidades</TableCell></TableRow>}
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.codigo}</TableCell>
                  <TableCell className="font-medium">{u.simbolo}</TableCell>
                  <TableCell>{u.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.categoria ?? "—"}</TableCell>
                  <TableCell className="text-sm">{u.ordem}</TableCell>
                  <TableCell>
                    {u.ativa ? <Badge variant="secondary">Ativa</Badge> : <Badge variant="outline">Inativa</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(u.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} Unidade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código *</Label>
                <Input value={editing?.codigo ?? ""} onChange={(e) => setEditing({ ...editing, codigo: e.target.value })} placeholder="m2" />
              </div>
              <div>
                <Label>Símbolo *</Label>
                <Input value={editing?.simbolo ?? ""} onChange={(e) => setEditing({ ...editing, simbolo: e.target.value })} placeholder="m²" />
              </div>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={editing?.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} placeholder="Metro quadrado" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Input value={editing?.categoria ?? ""} onChange={(e) => setEditing({ ...editing, categoria: e.target.value })} placeholder="área, volume, massa..." />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={editing?.ordem ?? 100} onChange={(e) => setEditing({ ...editing, ordem: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editing?.ativa ?? true} onCheckedChange={(v) => setEditing({ ...editing, ativa: v })} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Eliminar unidade?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove.mutate(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
