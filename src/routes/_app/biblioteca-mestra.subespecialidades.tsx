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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, ArrowUp, ArrowDown, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Especialidade, Subespecialidade } from "@/lib/biblioteca-mestra/types";

export const Route = createFileRoute("/_app/biblioteca-mestra/subespecialidades")({
  head: () => ({ meta: [{ title: "Subespecialidades — Biblioteca Mestra — MV OS" }] }),
  component: SubesPage,
});

function SubesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedEspId, setSelectedEspId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Subespecialidade> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [moveSub, setMoveSub] = useState<Subespecialidade | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>("");

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
  const searching = search.trim().length > 0;
  const term = search.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!searching) return rows;
    return rows.filter((r) =>
      r.nome.toLowerCase().includes(term) ||
      (r.codigo ?? "").toLowerCase().includes(term) ||
      (espMap.get(r.especialidade_id)?.nome.toLowerCase().includes(term) ?? false)
    );
  }, [rows, searching, term, espMap]);

  // counts per especialidade (filtered by search if active)
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    matches.forEach((r) => m.set(r.especialidade_id, (m.get(r.especialidade_id) ?? 0) + 1));
    return m;
  }, [matches]);

  const currentEspId = selectedEspId ?? esps[0]?.id ?? null;
  const currentEsp = currentEspId ? espMap.get(currentEspId) : undefined;

  const visible = useMemo(() => {
    if (searching) return matches; // show all matches across specialties
    return rows.filter((r) => r.especialidade_id === currentEspId);
  }, [searching, matches, rows, currentEspId]);

  const save = useMutation({
    mutationFn: async (s: Partial<Subespecialidade>) => {
      if (!s.nome?.trim()) throw new Error("Nome obrigatório");
      if (!s.especialidade_id) throw new Error("Especialidade obrigatória");
      const payload = {
        especialidade_id: s.especialidade_id,
        nome: s.nome.trim(),
        codigo: s.codigo?.trim() || null,
        descricao: s.descricao?.trim() || null,
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

  const swap = useMutation({
    mutationFn: async ({ a, b }: { a: Subespecialidade; b: Subespecialidade }) => {
      const { error: e1 } = await supabase.from("biblioteca_subespecialidades").update({ ordem: b.ordem }).eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("biblioteca_subespecialidades").update({ ordem: a.ordem }).eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bm-sub"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtiva = useMutation({
    mutationFn: async (r: Subespecialidade) => {
      const { error } = await supabase.from("biblioteca_subespecialidades").update({ ativa: !r.ativa }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bm-sub"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ sub, target }: { sub: Subespecialidade; target: string }) => {
      const { error } = await supabase.from("biblioteca_subespecialidades").update({ especialidade_id: target }).eq("id", sub.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bm-sub"] }); setMoveSub(null); toast.success("Movida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleMoveUpDown = (r: Subespecialidade, dir: -1 | 1) => {
    const siblings = rows
      .filter((x) => x.especialidade_id === r.especialidade_id)
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
    const idx = siblings.findIndex((x) => x.id === r.id);
    const neighbor = siblings[idx + dir];
    if (!neighbor) return;
    if (neighbor.ordem === r.ordem) {
      // ensure distinct ordem by bumping
      swap.mutate({ a: { ...r, ordem: r.ordem }, b: { ...neighbor, ordem: r.ordem + dir } });
      return;
    }
    swap.mutate({ a: r, b: neighbor });
  };

  const openNew = () => {
    setEditing({ ativa: true, especialidade_id: currentEspId ?? undefined, ordem: 0 });
    setEditOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Subespecialidades"
        subtitle="Segundo nível da Biblioteca Mestra — agrupamentos técnicos por especialidade"
      />
      <div className="p-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar em todas as especialidades..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
          {/* Left column — Especialidades */}
          <Card className="bg-card border-border p-2 h-fit">
            <div className="px-2 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Especialidades
            </div>
            <ul className="space-y-0.5">
              {esps.map((e) => {
                const count = searching ? (counts.get(e.id) ?? 0) : rows.filter((r) => r.especialidade_id === e.id).length;
                const active = !searching && e.id === currentEspId;
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => { setSelectedEspId(e.id); setSearch(""); }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors",
                        active ? "bg-primary/10 text-foreground font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="font-mono text-xs text-muted-foreground w-8">{e.codigo}</span>
                      <span className="flex-1 truncate">{e.nome}</span>
                      <Badge variant={active ? "default" : "secondary"} className="text-xs h-5 px-1.5">{count}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Right column — Subespecialidades */}
          <Card className="bg-card border-border">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold">
                  {searching ? `Resultados da pesquisa (${visible.length})` : currentEsp?.nome ?? "Selecione uma especialidade"}
                </h2>
                {!searching && currentEsp && (
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">{currentEsp.codigo}</p>
                )}
              </div>
              <Button onClick={openNew} disabled={!currentEspId}>
                <Plus className="h-4 w-4 mr-1" /> Nova subespecialidade
              </Button>
            </div>

            <div className="divide-y divide-border">
              {isLoading && <div className="p-10 text-center text-muted-foreground text-sm">A carregar...</div>}
              {!isLoading && visible.length === 0 && (
                <div className="p-10 text-center text-muted-foreground text-sm">
                  {searching ? "Sem resultados" : "Sem subespecialidades nesta especialidade"}
                </div>
              )}
              {visible.map((r, i) => {
                const siblings = searching
                  ? null
                  : visible;
                const canUp = !searching && siblings && i > 0;
                const canDown = !searching && siblings && i < siblings.length - 1;
                return (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                    {!searching && (
                      <div className="flex flex-col gap-0.5">
                        <button
                          disabled={!canUp}
                          onClick={() => handleMoveUpDown(r, -1)}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Mover para cima"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={!canDown}
                          onClick={() => handleMoveUpDown(r, 1)}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Mover para baixo"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <span className="font-mono text-xs text-muted-foreground w-16">{r.codigo ?? "—"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{r.nome}</div>
                      {searching && (
                        <div className="text-xs text-muted-foreground">{espMap.get(r.especialidade_id)?.nome}</div>
                      )}
                      {r.descricao && !searching && (
                        <div className="text-xs text-muted-foreground truncate">{r.descricao}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.ativa}
                        onCheckedChange={() => toggleAtiva.mutate(r)}
                        aria-label="Ativa"
                      />
                      <span className="text-xs text-muted-foreground w-12">{r.ativa ? "Ativa" : "Inativa"}</span>
                    </div>
                    <div className="flex items-center">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setEditOpen(true); }} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setMoveSub(r); setMoveTarget(r.especialidade_id); }} title="Mover para outra especialidade">
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(r.id)} title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Editar / Criar */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} Subespecialidade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Especialidade *</Label>
              <Select value={editing?.especialidade_id} onValueChange={(v) => setEditing({ ...editing, especialidade_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {esps.map((e) => <SelectItem key={e.id} value={e.id}>{e.codigo} — {e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nome *</Label><Input value={editing?.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
            <div><Label>Código</Label><Input value={editing?.codigo ?? ""} onChange={(e) => setEditing({ ...editing, codigo: e.target.value })} placeholder="ex. 070.10" /></div>
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

      {/* Mover */}
      <Dialog open={!!moveSub} onOpenChange={(o) => !o && setMoveSub(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover subespecialidade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Subespecialidade: </span>
              <span className="font-medium">{moveSub?.nome}</span>
            </div>
            <div>
              <Label>Nova especialidade</Label>
              <Select value={moveTarget} onValueChange={setMoveTarget}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {esps.map((e) => <SelectItem key={e.id} value={e.id}>{e.codigo} — {e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveSub(null)}>Cancelar</Button>
            <Button
              onClick={() => moveSub && moveTarget && moveTarget !== moveSub.especialidade_id && move.mutate({ sub: moveSub, target: moveTarget })}
              disabled={!moveTarget || moveTarget === moveSub?.especialidade_id || move.isPending}
            >
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar subespecialidade?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
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
