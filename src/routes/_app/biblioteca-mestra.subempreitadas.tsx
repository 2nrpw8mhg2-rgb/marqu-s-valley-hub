import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { classificarTudo } from "@/lib/subempreitadas/classify.functions";

export const Route = createFileRoute("/_app/biblioteca-mestra/subempreitadas")({
  head: () => ({ meta: [{ title: "Subempreitadas — Biblioteca Mestra — MV OS" }] }),
  component: SubempreitadasAdmin,
});

type Sub = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  palavras_chave: string[];
  termos_exclusao: string[];
  ordem: number;
  ativo: boolean;
};

function SubempreitadasAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Sub | null>(null);
  const [open, setOpen] = useState(false);
  const classificarTudoFn = useServerFn(classificarTudo);

  const { data: subs = [] } = useQuery({
    queryKey: ["subempreitadas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subempreitadas").select("*").order("ordem");
      if (error) throw error;
      return data as Sub[];
    },
  });

  const save = async () => {
    if (!editing) return;
    const payload = {
      codigo: editing.codigo.trim(),
      nome: editing.nome.trim(),
      descricao: editing.descricao,
      palavras_chave: editing.palavras_chave,
      termos_exclusao: editing.termos_exclusao,
      ordem: editing.ordem,
      ativo: editing.ativo,
    };
    if (editing.id) {
      const { error } = await supabase.from("subempreitadas").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("subempreitadas").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Guardado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["subempreitadas"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminar esta subempreitada?")) return;
    const { error } = await supabase.from("subempreitadas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    qc.invalidateQueries({ queryKey: ["subempreitadas"] });
  };

  const reclassificarTudo = async () => {
    if (!confirm("Reclassificar todos os artigos de todos os orçamentos? Não afeta artigos validados manualmente.")) return;
    const t = toast.loading("A reclassificar...");
    try {
      const r = await classificarTudoFn();
      toast.success(`${r.atribuidos} de ${r.total} artigos atribuídos`, { id: t });
    } catch (e: any) {
      toast.error(e.message, { id: t });
    }
  };

  return (
    <>
      <PageHeader
        title="Subempreitadas"
        subtitle="Categorias contratuais para separação automática de artigos"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={reclassificarTudo}>
              <Wand2 className="h-4 w-4 mr-1" /> Reclassificar todos os orçamentos
            </Button>
            <Button
              onClick={() => {
                setEditing({ id: "", codigo: "", nome: "", descricao: "", palavras_chave: [], termos_exclusao: [], ordem: 999, ativo: true });
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Nova
            </Button>
          </div>
        }
      />
      <div className="p-6">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Palavras-chave</TableHead>
                <TableHead>Termos de exclusão</TableHead>
                <TableHead className="w-20">Ativo</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">{s.codigo}</TableCell>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.palavras_chave.slice(0, 6).join(", ")}{s.palavras_chave.length > 6 && "…"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.termos_exclusao.join(", ") || "—"}</TableCell>
                  <TableCell>{s.ativo ? <Badge variant="secondary">Sim</Badge> : <Badge variant="outline">Não</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar subempreitada" : "Nova subempreitada"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Código</Label>
                  <Input value={editing.codigo} onChange={(e) => setEditing({ ...editing, codigo: e.target.value })} />
                </div>
                <div>
                  <Label>Ordem</Label>
                  <Input type="number" value={editing.ordem} onChange={(e) => setEditing({ ...editing, ordem: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Nome</Label>
                <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={editing.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} />
              </div>
              <div>
                <Label>Palavras-chave (uma por linha, sem acentos)</Label>
                <Textarea
                  rows={5}
                  value={editing.palavras_chave.join("\n")}
                  onChange={(e) => setEditing({ ...editing, palavras_chave: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
              <div>
                <Label>Termos de exclusão (uma por linha)</Label>
                <Textarea
                  rows={3}
                  value={editing.termos_exclusao.join("\n")}
                  onChange={(e) => setEditing({ ...editing, termos_exclusao: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.ativo} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
                <Label>Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
