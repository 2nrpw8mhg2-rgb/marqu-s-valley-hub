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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, HardHat } from "lucide-react";
import type { TemplateObra } from "@/lib/biblioteca-mestra/types";

export const Route = createFileRoute("/_app/biblioteca-mestra/templates")({
  head: () => ({ meta: [{ title: "Templates de Obra — Biblioteca Mestra — MV OS" }] }),
  component: TemplatesPage,
});

type Pacote = { id: string; nome: string; especialidade: string | null };
type TplPacote = { id: string; template_id: string; pacote_id: string };

type EditState = Partial<TemplateObra> & { pacoteIds?: string[] };

function TemplatesPage() {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: tpls = [], isLoading } = useQuery({
    queryKey: ["bm-tpl"],
    queryFn: async () => (await supabase.from("templates_obra").select("*").order("nome")).data as TemplateObra[],
  });

  const { data: pacotes = [] } = useQuery({
    queryKey: ["bm-pacotes-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("procurement_pacotes").select("id, nome, especialidade").order("nome");
      return (data ?? []) as Pacote[];
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ["bm-tpl-pacotes"],
    queryFn: async () => (await supabase.from("template_obra_pacotes").select("*")).data as TplPacote[],
  });

  const pacotesByTpl = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of links) {
      if (!m.has(l.template_id)) m.set(l.template_id, []);
      m.get(l.template_id)!.push(l.pacote_id);
    }
    return m;
  }, [links]);

  const pacoteMap = useMemo(() => new Map(pacotes.map((p) => [p.id, p])), [pacotes]);

  const openEdit = (t?: TemplateObra) => {
    if (t) setEditing({ ...t, pacoteIds: pacotesByTpl.get(t.id) ?? [] });
    else setEditing({ ativa: true, pacoteIds: [] });
    setEditOpen(true);
  };

  const save = useMutation({
    mutationFn: async (e: EditState) => {
      if (!e.nome?.trim()) throw new Error("Nome obrigatório");
      let tplId = e.id;
      const payload = { nome: e.nome.trim(), descricao: e.descricao ?? null, ativa: e.ativa ?? true };
      if (tplId) {
        const { error } = await supabase.from("templates_obra").update(payload).eq("id", tplId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("templates_obra").insert(payload).select("id").single();
        if (error) throw error;
        tplId = data.id;
      }
      await supabase.from("template_obra_pacotes").delete().eq("template_id", tplId!);
      const ids = e.pacoteIds ?? [];
      if (ids.length) {
        const rows = ids.map((p, i) => ({ template_id: tplId!, pacote_id: p, ordem: i }));
        const { error } = await supabase.from("template_obra_pacotes").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-tpl"] });
      qc.invalidateQueries({ queryKey: ["bm-tpl-pacotes"] });
      setEditOpen(false);
      setEditing(null);
      toast.success("Guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("templates_obra").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bm-tpl"] }); setDeleteId(null); toast.success("Eliminado"); },
  });

  const togglePacote = (id: string) => {
    if (!editing) return;
    const cur = editing.pacoteIds ?? [];
    setEditing({ ...editing, pacoteIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  return (
    <>
      <PageHeader
        title="Templates de Obra"
        subtitle="Define os Pacotes de Consulta tipicamente utilizados por tipo de obra"
        actions={<Button onClick={() => openEdit()}><Plus className="h-4 w-4 mr-1" /> Novo</Button>}
      />
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p className="text-muted-foreground">A carregar...</p>}
        {!isLoading && tpls.length === 0 && <p className="text-muted-foreground">Sem templates</p>}
        {tpls.map((t) => {
          const ids = pacotesByTpl.get(t.id) ?? [];
          return (
            <Card key={t.id} className="bg-card border-border p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <HardHat className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold">{t.nome}</h3>
                    {t.descricao && <p className="text-xs text-muted-foreground">{t.descricao}</p>}
                  </div>
                </div>
                {!t.ativa && <Badge variant="outline" className="text-[10px]">inativa</Badge>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Pacotes ({ids.length})</p>
                <div className="flex flex-wrap gap-1">
                  {ids.length === 0 && <span className="text-xs text-muted-foreground">— nenhum —</span>}
                  {ids.map((pid) => {
                    const p = pacoteMap.get(pid);
                    return p ? <Badge key={pid} variant="secondary">{p.nome}</Badge> : null;
                  })}
                </div>
              </div>
              <div className="flex gap-2 mt-auto pt-2 border-t border-border/60">
                <Button size="sm" variant="outline" onClick={() => openEdit(t)}><Pencil className="h-3 w-3 mr-1" /> Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteId(t.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} Template de Obra</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div><Label>Nome *</Label><Input value={editing?.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={editing?.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={editing?.ativa ?? true} onCheckedChange={(v) => setEditing({ ...editing, ativa: v })} /><Label>Ativa</Label></div>

            <div>
              <Label>Pacotes de Consulta</Label>
              <p className="text-xs text-muted-foreground mb-2">Selecciona os pacotes tipicamente utilizados neste tipo de obra.</p>
              <div className="border border-border rounded-md max-h-60 overflow-y-auto divide-y divide-border/60">
                {pacotes.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Sem pacotes de consulta criados ainda.</p>}
                {pacotes.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-muted/40 cursor-pointer">
                    <Checkbox checked={(editing?.pacoteIds ?? []).includes(p.id)} onCheckedChange={() => togglePacote(p.id)} />
                    <span className="text-sm">{p.nome}</span>
                    {p.especialidade && <span className="text-xs text-muted-foreground ml-auto">{p.especialidade}</span>}
                  </label>
                ))}
              </div>
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
          <AlertDialogHeader><AlertDialogTitle>Eliminar template?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove.mutate(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
