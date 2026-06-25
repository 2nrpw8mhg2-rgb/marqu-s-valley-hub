import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, ArrowUp, ArrowDown, ArrowLeftRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Especialidade, Subespecialidade, Categoria } from "@/lib/biblioteca-mestra/types";

export const Route = createFileRoute("/_app/biblioteca-mestra/categorias")({
  head: () => ({ meta: [{ title: "Categorias — Biblioteca Mestra — MV OS" }] }),
  component: CategoriasPage,
});

type ArtCount = { categoria_id: string; count: number };

function CategoriasPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedEspId, setSelectedEspId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Categoria> | null>(null);
  const [deleteCat, setDeleteCat] = useState<Categoria | null>(null);
  const [moveCat, setMoveCat] = useState<Categoria | null>(null);
  const [moveEsp, setMoveEsp] = useState<string>("");
  const [moveSub, setMoveSub] = useState<string>("");

  const { data: esps = [] } = useQuery({
    queryKey: ["bm-esp"],
    queryFn: async () => (await supabase.from("biblioteca_especialidades").select("*").order("ordem")).data as Especialidade[],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["bm-sub"],
    queryFn: async () => (await supabase.from("biblioteca_subespecialidades").select("*").order("ordem").order("nome")).data as Subespecialidade[],
  });
  const { data: cats = [], isLoading } = useQuery({
    queryKey: ["bm-cat"],
    queryFn: async () => (await supabase.from("biblioteca_categorias").select("*").order("ordem").order("nome")).data as Categoria[],
  });
  const { data: artCounts = [] } = useQuery({
    queryKey: ["bm-art-cat-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("biblioteca_artigos").select("categoria_id");
      const m = new Map<string, number>();
      (data ?? []).forEach((r) => m.set(r.categoria_id as string, (m.get(r.categoria_id as string) ?? 0) + 1));
      return Array.from(m.entries()).map(([categoria_id, count]) => ({ categoria_id, count })) as ArtCount[];
    },
  });

  const espMap = useMemo(() => new Map(esps.map((e) => [e.id, e])), [esps]);
  const subMap = useMemo(() => new Map(subs.map((s) => [s.id, s])), [subs]);
  const countMap = useMemo(() => new Map(artCounts.map((a) => [a.categoria_id, a.count])), [artCounts]);

  const searching = search.trim().length > 0;
  const term = search.trim().toLowerCase();

  const matchedCats = useMemo(() => {
    if (!searching) return cats;
    return cats.filter((c) =>
      c.nome.toLowerCase().includes(term) ||
      (c.codigo ?? "").toLowerCase().includes(term)
    );
  }, [cats, searching, term]);

  const matchedSubIds = useMemo(() => new Set(matchedCats.map((c) => c.subespecialidade_id)), [matchedCats]);
  const matchedEspIds = useMemo(() => {
    const ids = new Set<string>();
    matchedSubIds.forEach((sid) => {
      const sub = subMap.get(sid);
      if (sub) ids.add(sub.especialidade_id);
    });
    return ids;
  }, [matchedSubIds, subMap]);

  const currentEspId = selectedEspId ?? esps[0]?.id ?? null;
  const visibleSubs = useMemo(() => {
    const list = subs.filter((s) => s.especialidade_id === currentEspId);
    if (searching) return list.filter((s) => matchedSubIds.has(s.id));
    return list;
  }, [subs, currentEspId, searching, matchedSubIds]);

  const currentSubId = selectedSubId ?? visibleSubs[0]?.id ?? null;
  const visibleCats = useMemo(() => {
    if (searching) return matchedCats;
    return cats.filter((c) => c.subespecialidade_id === currentSubId).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
  }, [cats, currentSubId, searching, matchedCats]);

  const subCounts = useMemo(() => {
    const m = new Map<string, number>();
    cats.forEach((c) => m.set(c.subespecialidade_id, (m.get(c.subespecialidade_id) ?? 0) + 1));
    return m;
  }, [cats]);

  const espCounts = useMemo(() => {
    const m = new Map<string, number>();
    subs.forEach((s) => {
      const n = subCounts.get(s.id) ?? 0;
      m.set(s.especialidade_id, (m.get(s.especialidade_id) ?? 0) + n);
    });
    return m;
  }, [subs, subCounts]);

  const isProtected = (c: Categoria) => c.nome === "Por Classificar" && c.ordem === 0;

  const save = useMutation({
    mutationFn: async (c: Partial<Categoria>) => {
      if (!c.nome?.trim()) throw new Error("Nome obrigatório");
      if (!c.subespecialidade_id) throw new Error("Subespecialidade obrigatória");
      const payload = {
        subespecialidade_id: c.subespecialidade_id,
        nome: c.nome.trim(),
        codigo: c.codigo?.trim() || null,
        descricao: c.descricao?.trim() || null,
        ordem: c.ordem ?? 10,
        ativa: c.ativa ?? true,
      };
      if (c.id) {
        const { error } = await supabase.from("biblioteca_categorias").update(payload).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("biblioteca_categorias").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-cat"] });
      setEditOpen(false);
      setEditing(null);
      toast.success("Guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (cat: Categoria) => {
      const count = countMap.get(cat.id) ?? 0;
      if (count > 0) {
        // Mover artigos para "Por Classificar" da mesma subespecialidade
        const pc = cats.find((c) => c.subespecialidade_id === cat.subespecialidade_id && c.nome === "Por Classificar" && c.ordem === 0);
        if (!pc) throw new Error('Categoria "Por Classificar" não encontrada');
        const { error: e1 } = await supabase.from("biblioteca_artigos").update({ categoria_id: pc.id }).eq("categoria_id", cat.id);
        if (e1) throw e1;
      }
      const { error } = await supabase.from("biblioteca_categorias").delete().eq("id", cat.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-cat"] });
      qc.invalidateQueries({ queryKey: ["bm-art"] });
      qc.invalidateQueries({ queryKey: ["bm-art-cat-counts"] });
      setDeleteCat(null);
      toast.success("Eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const swap = useMutation({
    mutationFn: async ({ a, b }: { a: Categoria; b: Categoria }) => {
      const { error: e1 } = await supabase.from("biblioteca_categorias").update({ ordem: b.ordem }).eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("biblioteca_categorias").update({ ordem: a.ordem }).eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bm-cat"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtiva = useMutation({
    mutationFn: async (c: Categoria) => {
      const { error } = await supabase.from("biblioteca_categorias").update({ ativa: !c.ativa }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bm-cat"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ cat, target }: { cat: Categoria; target: string }) => {
      // Move a categoria E os artigos contidos para outra subespecialidade
      const { error: e1 } = await supabase.from("biblioteca_categorias").update({ subespecialidade_id: target }).eq("id", cat.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("biblioteca_artigos").update({ subespecialidade_id: target }).eq("categoria_id", cat.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-cat"] });
      qc.invalidateQueries({ queryKey: ["bm-art"] });
      setMoveCat(null);
      toast.success("Categoria movida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleMoveUpDown = (c: Categoria, dir: -1 | 1) => {
    const siblings = cats
      .filter((x) => x.subespecialidade_id === c.subespecialidade_id && !isProtected(x))
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
    const idx = siblings.findIndex((x) => x.id === c.id);
    const neighbor = siblings[idx + dir];
    if (!neighbor) return;
    if (neighbor.ordem === c.ordem) {
      swap.mutate({ a: { ...c, ordem: c.ordem }, b: { ...neighbor, ordem: c.ordem + dir } });
      return;
    }
    swap.mutate({ a: c, b: neighbor });
  };

  const openNew = () => {
    if (!currentSubId) return;
    const sub = subMap.get(currentSubId);
    const maxOrdem = Math.max(10, ...cats.filter((c) => c.subespecialidade_id === currentSubId).map((c) => c.ordem));
    const suggestedOrdem = maxOrdem + 10;
    const suggestedCodigo = sub?.codigo ? `${sub.codigo}.${String(suggestedOrdem).padStart(2, "0")}` : "";
    setEditing({ ativa: true, subespecialidade_id: currentSubId, ordem: suggestedOrdem, codigo: suggestedCodigo });
    setEditOpen(true);
  };

  const currentSub = currentSubId ? subMap.get(currentSubId) : null;
  const currentEsp = currentSub ? espMap.get(currentSub.especialidade_id) : (currentEspId ? espMap.get(currentEspId) : null);

  return (
    <>
      <PageHeader
        title="Categorias"
        subtitle="Terceiro nível da Biblioteca Mestra — organização fina de Artigos Mestre"
      />
      <div className="p-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar categorias por nome ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_280px_1fr] gap-4">
          {/* Especialidades */}
          <Card className="bg-card border-border p-2 h-fit">
            <div className="px-2 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Especialidades</div>
            <ul className="space-y-0.5">
              {esps.filter((e) => !searching || matchedEspIds.has(e.id)).map((e) => {
                const active = e.id === currentEspId;
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => { setSelectedEspId(e.id); setSelectedSubId(null); }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors",
                        active ? "bg-primary/10 text-foreground font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="font-mono text-xs text-muted-foreground w-8">{e.codigo}</span>
                      <span className="flex-1 truncate">{e.nome}</span>
                      <Badge variant={active ? "default" : "secondary"} className="text-xs h-5 px-1.5">{espCounts.get(e.id) ?? 0}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Subespecialidades */}
          <Card className="bg-card border-border p-2 h-fit">
            <div className="px-2 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Subespecialidades</div>
            <ul className="space-y-0.5">
              {visibleSubs.map((s) => {
                const active = s.id === currentSubId;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedSubId(s.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors",
                        active ? "bg-primary/10 text-foreground font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="font-mono text-xs text-muted-foreground w-12 truncate">{s.codigo ?? "—"}</span>
                      <span className="flex-1 truncate">{s.nome}</span>
                      <Badge variant={active ? "default" : "secondary"} className="text-xs h-5 px-1.5">{subCounts.get(s.id) ?? 0}</Badge>
                    </button>
                  </li>
                );
              })}
              {visibleSubs.length === 0 && (
                <li className="text-xs text-muted-foreground px-3 py-2">
                  {searching ? "Sem resultados" : "Sem subespecialidades"}
                </li>
              )}
            </ul>
          </Card>

          {/* Categorias */}
          <Card className="bg-card border-border">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold">
                  {searching ? `Resultados (${visibleCats.length})` : currentSub?.nome ?? "Selecione uma subespecialidade"}
                </h2>
                {!searching && currentEsp && currentSub && (
                  <p className="text-xs text-muted-foreground mt-0.5">{currentEsp.nome} <span className="font-mono">/ {currentSub.codigo ?? ""}</span></p>
                )}
              </div>
              <Button onClick={openNew} disabled={!currentSubId || searching}>
                <Plus className="h-4 w-4 mr-1" /> Nova categoria
              </Button>
            </div>

            <div className="divide-y divide-border">
              {isLoading && <div className="p-10 text-center text-muted-foreground text-sm">A carregar...</div>}
              {!isLoading && visibleCats.length === 0 && (
                <div className="p-10 text-center text-muted-foreground text-sm">
                  {searching ? "Sem resultados" : "Sem categorias nesta subespecialidade"}
                </div>
              )}
              {visibleCats.map((c, i) => {
                const protectedCat = isProtected(c);
                const movableSiblings = visibleCats.filter((x) => !isProtected(x));
                const movableIdx = movableSiblings.findIndex((x) => x.id === c.id);
                const canUp = !searching && !protectedCat && movableIdx > 0;
                const canDown = !searching && !protectedCat && movableIdx >= 0 && movableIdx < movableSiblings.length - 1;
                const count = countMap.get(c.id) ?? 0;
                const sub = subMap.get(c.subespecialidade_id);
                const esp = sub ? espMap.get(sub.especialidade_id) : null;
                return (
                  <div key={c.id} className={cn("flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors", protectedCat && "bg-amber-50/40 dark:bg-amber-900/10")}>
                    {!searching && !protectedCat && (
                      <div className="flex flex-col gap-0.5">
                        <button disabled={!canUp} onClick={() => handleMoveUpDown(c, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Mover para cima">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button disabled={!canDown} onClick={() => handleMoveUpDown(c, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Mover para baixo">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {(searching || protectedCat) && <div className="w-3.5" />}
                    <span className="font-mono text-xs text-muted-foreground w-20 truncate">{c.codigo ?? "—"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {protectedCat && <Lock className="h-3 w-3 text-amber-600 shrink-0" />}
                        <span className="font-medium text-sm truncate">{c.nome}</span>
                        <Badge variant="outline" className="text-xs h-5 whitespace-nowrap shrink-0">{count} artigo{count === 1 ? "" : "s"}</Badge>
                      </div>
                      {searching && (
                        <div className="text-xs text-muted-foreground truncate">{esp?.nome} / {sub?.nome}</div>
                      )}
                      {c.descricao && !searching && (
                        <div className="text-xs text-muted-foreground truncate">{c.descricao}</div>
                      )}
                    </div>
                    {!protectedCat && (
                      <>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch checked={c.ativa} onCheckedChange={() => toggleAtiva.mutate(c)} aria-label="Ativa" />
                          <span className="text-xs text-muted-foreground hidden xl:inline">{c.ativa ? "Ativa" : "Inativa"}</span>
                        </div>
                        <div className="flex items-center shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setEditOpen(true); }} title="Editar"><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => { setMoveCat(c); setMoveEsp(esp?.id ?? ""); setMoveSub(""); }} title="Mover para outra subespecialidade"><ArrowLeftRight className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteCat(c)} title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </>
                    )}

                    {protectedCat && (
                      <span className="text-xs text-amber-700 dark:text-amber-400 italic">protegida</span>
                    )}
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
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} Categoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Subespecialidade *</Label>
              <Select value={editing?.subespecialidade_id} onValueChange={(v) => setEditing({ ...editing, subespecialidade_id: v })} disabled={!!editing?.id}>
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {subs.map((s) => <SelectItem key={s.id} value={s.id}>{espMap.get(s.especialidade_id)?.nome} / {s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nome *</Label><Input value={editing?.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Código</Label><Input value={editing?.codigo ?? ""} onChange={(e) => setEditing({ ...editing, codigo: e.target.value })} /></div>
              <div><Label>Ordem</Label><Input type="number" value={editing?.ordem ?? 10} onChange={(e) => setEditing({ ...editing, ordem: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={editing?.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={editing?.ativa ?? true} onCheckedChange={(v) => setEditing({ ...editing, ativa: v })} /><Label>Ativa</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mover categoria */}
      <Dialog open={!!moveCat} onOpenChange={(o) => !o && setMoveCat(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover categoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Categoria: </span>
              <span className="font-medium">{moveCat?.nome}</span>
              <p className="text-xs text-muted-foreground mt-1">Todos os artigos contidos serão movidos com ela.</p>
            </div>
            <div>
              <Label>Especialidade destino</Label>
              <Select value={moveEsp} onValueChange={(v) => { setMoveEsp(v); setMoveSub(""); }}>
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {esps.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subespecialidade destino</Label>
              <Select value={moveSub} onValueChange={setMoveSub} disabled={!moveEsp}>
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {subs.filter((s) => s.especialidade_id === moveEsp).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveCat(null)}>Cancelar</Button>
            <Button
              disabled={!moveSub || moveSub === moveCat?.subespecialidade_id || move.isPending}
              onClick={() => moveCat && move.mutate({ cat: moveCat, target: moveSub })}
            >Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar */}
      <AlertDialog open={!!deleteCat} onOpenChange={(o) => !o && setDeleteCat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCat && (() => {
                const n = countMap.get(deleteCat.id) ?? 0;
                if (n === 0) return "Esta categoria não contém artigos.";
                return `Esta categoria contém ${n} artigo(s). Serão movidos para "Por Classificar" da mesma subespecialidade antes da eliminação.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteCat && remove.mutate(deleteCat)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
