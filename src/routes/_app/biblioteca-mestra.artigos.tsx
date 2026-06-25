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
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
import type { Especialidade, Subespecialidade, ArtigoMestre, ArtigoKeyword } from "@/lib/biblioteca-mestra/types";

export const Route = createFileRoute("/_app/biblioteca-mestra/artigos")({
  head: () => ({ meta: [{ title: "Artigos Mestre — Biblioteca Mestra — MV OS" }] }),
  component: ArtigosPage,
});

type EditState = Partial<ArtigoMestre> & { positivas?: string[]; negativas?: string[] };

function ArtigosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [espFilter, setEspFilter] = useState<string>("all");
  const [subFilter, setSubFilter] = useState<string>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [kwInputPos, setKwInputPos] = useState("");
  const [kwInputNeg, setKwInputNeg] = useState("");

  const { data: esps = [] } = useQuery({
    queryKey: ["bm-esp"],
    queryFn: async () => (await supabase.from("biblioteca_especialidades").select("*").order("ordem")).data as Especialidade[],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["bm-sub"],
    queryFn: async () => (await supabase.from("biblioteca_subespecialidades").select("*").order("nome")).data as Subespecialidade[],
  });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["bm-art"],
    queryFn: async () => (await supabase.from("biblioteca_artigos").select("*").order("descricao")).data as ArtigoMestre[],
  });
  const { data: kws = [] } = useQuery({
    queryKey: ["bm-kw"],
    queryFn: async () => (await supabase.from("biblioteca_artigo_keywords").select("*")).data as ArtigoKeyword[],
  });

  const subMap = useMemo(() => new Map(subs.map((s) => [s.id, s])), [subs]);
  const espMap = useMemo(() => new Map(esps.map((e) => [e.id, e])), [esps]);
  const kwsByArt = useMemo(() => {
    const m = new Map<string, ArtigoKeyword[]>();
    for (const k of kws) {
      if (!m.has(k.artigo_id)) m.set(k.artigo_id, []);
      m.get(k.artigo_id)!.push(k);
    }
    return m;
  }, [kws]);

  const subsByEsp = useMemo(() => {
    if (espFilter === "all") return subs;
    return subs.filter((s) => s.especialidade_id === espFilter);
  }, [subs, espFilter]);

  const filtered = rows.filter((r) => {
    const sub = subMap.get(r.subespecialidade_id);
    if (espFilter !== "all" && sub?.especialidade_id !== espFilter) return false;
    if (subFilter !== "all" && r.subespecialidade_id !== subFilter) return false;
    if (search.trim()) {
      const t = search.toLowerCase();
      const kwHit = (kwsByArt.get(r.id) ?? []).some((k) => k.termo.toLowerCase().includes(t));
      return (
        r.descricao.toLowerCase().includes(t) ||
        (r.codigo ?? "").toLowerCase().includes(t) ||
        (r.unidade ?? "").toLowerCase().includes(t) ||
        kwHit
      );
    }
    return true;
  });

  const openEdit = (a?: ArtigoMestre) => {
    if (a) {
      const list = kwsByArt.get(a.id) ?? [];
      setEditing({
        ...a,
        positivas: list.filter((k) => k.tipo === "positiva").map((k) => k.termo),
        negativas: list.filter((k) => k.tipo === "negativa").map((k) => k.termo),
      });
    } else {
      setEditing({ ativo: true, positivas: [], negativas: [], subespecialidade_id: subFilter !== "all" ? subFilter : undefined });
    }
    setKwInputPos("");
    setKwInputNeg("");
    setEditOpen(true);
  };

  const save = useMutation({
    mutationFn: async (e: EditState) => {
      if (!e.descricao?.trim()) throw new Error("Descrição obrigatória");
      if (!e.subespecialidade_id) throw new Error("Subespecialidade obrigatória");
      const payload = {
        subespecialidade_id: e.subespecialidade_id,
        codigo: e.codigo ?? null,
        descricao: e.descricao.trim(),
        unidade: e.unidade ?? null,
        observacoes: e.observacoes ?? null,
        ativo: e.ativo ?? true,
      };
      let artigoId = e.id;
      if (artigoId) {
        const { error } = await supabase.from("biblioteca_artigos").update(payload).eq("id", artigoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("biblioteca_artigos").insert(payload).select("id").single();
        if (error) throw error;
        artigoId = data.id;
      }
      // Replace keywords
      await supabase.from("biblioteca_artigo_keywords").delete().eq("artigo_id", artigoId!);
      const all = [
        ...(e.positivas ?? []).map((t) => ({ artigo_id: artigoId!, termo: t, tipo: "positiva" as const })),
        ...(e.negativas ?? []).map((t) => ({ artigo_id: artigoId!, termo: t, tipo: "negativa" as const })),
      ];
      if (all.length) {
        const { error } = await supabase.from("biblioteca_artigo_keywords").insert(all);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-art"] });
      qc.invalidateQueries({ queryKey: ["bm-kw"] });
      setEditOpen(false);
      setEditing(null);
      toast.success("Guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("biblioteca_artigos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bm-art"] }); setDeleteId(null); toast.success("Eliminado"); },
  });

  const addKw = (kind: "positivas" | "negativas", val: string) => {
    const t = val.trim();
    if (!t || !editing) return;
    const cur = editing[kind] ?? [];
    if (cur.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    setEditing({ ...editing, [kind]: [...cur, t] });
  };

  return (
    <>
      <PageHeader
        title="Artigos Mestre"
        subtitle="Conhecimento técnico atómico — cada artigo pertence a uma subespecialidade"
        actions={<Button onClick={() => openEdit()}><Plus className="h-4 w-4 mr-1" /> Novo</Button>}
      />
      <div className="p-6 space-y-4">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={espFilter} onValueChange={(v) => { setEspFilter(v); setSubFilter("all"); }}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as especialidades</SelectItem>
              {esps.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={subFilter} onValueChange={setSubFilter}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as subespecialidades</SelectItem>
              {subsByEsp.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Subespecialidade</TableHead>
                <TableHead className="w-16">Un.</TableHead>
                <TableHead>Palavras-chave</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">A carregar...</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Sem artigos</TableCell></TableRow>}
              {filtered.map((r) => {
                const sub = subMap.get(r.subespecialidade_id);
                const esp = sub ? espMap.get(sub.especialidade_id) : null;
                const arrKw = kwsByArt.get(r.id) ?? [];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.codigo ?? "—"}</TableCell>
                    <TableCell className="font-medium">{r.descricao}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {esp?.nome} / {sub?.nome ?? "—"}
                    </TableCell>
                    <TableCell>{r.unidade ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {arrKw.slice(0, 5).map((k) => (
                          <Badge key={k.id} variant={k.tipo === "positiva" ? "secondary" : "outline"} className={k.tipo === "negativa" ? "border-destructive/40 text-destructive" : ""}>
                            {k.tipo === "negativa" ? "−" : "+"} {k.termo}
                          </Badge>
                        ))}
                        {arrKw.length > 5 && <span className="text-xs text-muted-foreground">+{arrKw.length - 5}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} Artigo Mestre</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div>
              <Label>Subespecialidade *</Label>
              <Select value={editing?.subespecialidade_id} onValueChange={(v) => setEditing({ ...editing, subespecialidade_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {subs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {espMap.get(s.especialidade_id)?.nome} / {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Código</Label><Input value={editing?.codigo ?? ""} onChange={(e) => setEditing({ ...editing, codigo: e.target.value })} /></div>
              <div className="col-span-2"><Label>Unidade</Label><Input value={editing?.unidade ?? ""} onChange={(e) => setEditing({ ...editing, unidade: e.target.value })} placeholder="m², m³, vg, ..." /></div>
            </div>
            <div><Label>Descrição *</Label><Textarea value={editing?.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={editing?.observacoes ?? ""} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={editing?.ativo ?? true} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} /><Label>Ativo</Label></div>

            <div>
              <Label>Palavras-chave positivas</Label>
              <div className="flex gap-2 mt-1">
                <Input value={kwInputPos} onChange={(e) => setKwInputPos(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw("positivas", kwInputPos); setKwInputPos(""); } }} placeholder="Premir Enter para adicionar" />
                <Button type="button" variant="outline" onClick={() => { addKw("positivas", kwInputPos); setKwInputPos(""); }}>Adicionar</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(editing?.positivas ?? []).map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button onClick={() => setEditing({ ...editing!, positivas: (editing!.positivas ?? []).filter((x) => x !== t) })}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Palavras-chave negativas</Label>
              <div className="flex gap-2 mt-1">
                <Input value={kwInputNeg} onChange={(e) => setKwInputNeg(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw("negativas", kwInputNeg); setKwInputNeg(""); } }} placeholder="Premir Enter para adicionar" />
                <Button type="button" variant="outline" onClick={() => { addKw("negativas", kwInputNeg); setKwInputNeg(""); }}>Adicionar</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(editing?.negativas ?? []).map((t) => (
                  <Badge key={t} variant="outline" className="gap-1 border-destructive/40 text-destructive">
                    {t}
                    <button onClick={() => setEditing({ ...editing!, negativas: (editing!.negativas ?? []).filter((x) => x !== t) })}><X className="h-3 w-3" /></button>
                  </Badge>
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
          <AlertDialogHeader><AlertDialogTitle>Eliminar artigo?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove.mutate(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
