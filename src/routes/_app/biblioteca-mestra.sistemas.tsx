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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Layers, Search } from "lucide-react";
import {
  CATEGORIAS_SISTEMA, CATEGORIA_SISTEMA_META,
  PAPEIS_SISTEMA, PAPEL_META,
  OBRIGATORIEDADES, OBRIGATORIEDADE_META,
} from "@/lib/relacoes/config";
import type {
  SistemaConstrutivo, SistemaArtigo, CategoriaSistema, PapelSistema, Obrigatoriedade,
} from "@/lib/relacoes/types";
import type { ArtigoMestre } from "@/lib/biblioteca-mestra/types";

export const Route = createFileRoute("/_app/biblioteca-mestra/sistemas")({
  head: () => ({ meta: [{ title: "Sistemas Construtivos — Biblioteca Mestra — MV OS" }] }),
  component: SistemasPage,
});

type EditState = Partial<SistemaConstrutivo> | null;

function SistemasPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<EditState>(null);
  const [composeId, setComposeId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["bm-sistemas"],
    queryFn: async () => (await supabase.from("biblioteca_sistemas_construtivos").select("*").order("nome")).data as SistemaConstrutivo[],
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["bm-sistemas-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("biblioteca_sistema_artigos").select("sistema_id");
      const m: Record<string, number> = {};
      for (const r of data ?? []) m[r.sistema_id] = (m[r.sistema_id] ?? 0) + 1;
      return m;
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (catFilter !== "all" && r.categoria_sistema !== catFilter) return false;
      if (!term) return true;
      return r.nome.toLowerCase().includes(term) || (r.codigo ?? "").toLowerCase().includes(term);
    });
  }, [rows, search, catFilter]);

  const save = useMutation({
    mutationFn: async (e: NonNullable<EditState>) => {
      if (!e.nome?.trim()) throw new Error("Nome obrigatório");
      const payload = {
        nome: e.nome.trim(),
        codigo: e.codigo ?? null,
        descricao: e.descricao ?? null,
        categoria_sistema: (e.categoria_sistema ?? "outros") as CategoriaSistema,
        observacoes: e.observacoes ?? null,
        ativo: e.ativo ?? true,
      };
      if (e.id) {
        const { error } = await supabase.from("biblioteca_sistemas_construtivos").update(payload).eq("id", e.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("biblioteca_sistemas_construtivos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bm-sistemas"] }); setEditOpen(false); toast.success("Guardado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("biblioteca_sistemas_construtivos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bm-sistemas"] }); toast.success("Eliminado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Sistemas Construtivos" subtitle="Soluções compostas — ETICS, coberturas, fachadas ventiladas, etc." />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8 w-64" placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {CATEGORIAS_SISTEMA.map((c) => <SelectItem key={c} value={c}>{CATEGORIA_SISTEMA_META[c].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => { setEditing({ ativo: true, categoria_sistema: "outros" }); setEditOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo sistema
          </Button>
        </div>

        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-40">Categoria</TableHead>
                <TableHead className="w-24 text-right">Membros</TableHead>
                <TableHead className="w-20">Ativo</TableHead>
                <TableHead className="w-40 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">A carregar...</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Sem sistemas. Cria o primeiro.</TableCell></TableRow>}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.codigo ?? "—"}</TableCell>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell><Badge variant="outline">{CATEGORIA_SISTEMA_META[r.categoria_sistema]?.label}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{counts[r.id] ?? 0}</TableCell>
                  <TableCell>{r.ativo ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setComposeId(r.id)}><Layers className="h-4 w-4 mr-1" /> Composição</Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setEditOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Eliminar sistema?")) del.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} sistema construtivo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Código</Label><Input value={editing?.codigo ?? ""} onChange={(e) => setEditing({ ...editing, codigo: e.target.value })} /></div>
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input value={editing?.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Categoria *</Label>
              <Select
                value={editing?.categoria_sistema ?? "outros"}
                onValueChange={(v) => setEditing({ ...editing, categoria_sistema: v as CategoriaSistema })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_SISTEMA.map((c) => <SelectItem key={c} value={c}>{CATEGORIA_SISTEMA_META[c].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Textarea rows={2} value={editing?.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea rows={2} value={editing?.observacoes ?? ""} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={editing?.ativo ?? true} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} /><Label>Ativo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {composeId && <ComposicaoDialog sistemaId={composeId} onClose={() => setComposeId(null)} />}
    </>
  );
}

function ComposicaoDialog({ sistemaId, onClose }: { sistemaId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [novoArt, setNovoArt] = useState("");
  const [novoPapel, setNovoPapel] = useState<PapelSistema>("acessorio");
  const [novoObrig, setNovoObrig] = useState<Obrigatoriedade>("frequente");
  const [search, setSearch] = useState("");

  const { data: sistema } = useQuery({
    queryKey: ["bm-sistema-one", sistemaId],
    queryFn: async () => (await supabase.from("biblioteca_sistemas_construtivos").select("*").eq("id", sistemaId).single()).data as SistemaConstrutivo,
  });

  const { data: membros = [], refetch } = useQuery({
    queryKey: ["bm-sistema-membros", sistemaId],
    queryFn: async () =>
      ((await supabase.from("biblioteca_sistema_artigos").select("*").eq("sistema_id", sistemaId).order("ordem_execucao")).data ?? []) as SistemaArtigo[],
  });

  const { data: artigos = [] } = useQuery({
    queryKey: ["bm-art-min"],
    queryFn: async () => (await supabase.from("biblioteca_artigos").select("id, descricao, codigo").order("descricao")).data as Pick<ArtigoMestre, "id" | "descricao" | "codigo">[],
  });

  const artigoMap = useMemo(() => new Map(artigos.map((a) => [a.id, a])), [artigos]);
  const existingIds = new Set(membros.map((m) => m.artigo_id));
  const filtered = artigos.filter((a) => !existingIds.has(a.id) && a.descricao.toLowerCase().includes(search.toLowerCase())).slice(0, 200);

  const add = useMutation({
    mutationFn: async () => {
      if (!novoArt) throw new Error("Escolhe um artigo");
      const ordem = Math.max(0, ...membros.map((m) => m.ordem_execucao)) + 10;
      const { error } = await supabase.from("biblioteca_sistema_artigos").insert({
        sistema_id: sistemaId, artigo_id: novoArt,
        papel: novoPapel, obrigatoriedade: novoObrig, ordem_execucao: ordem,
      });
      if (error) throw error;
    },
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ["bm-sistemas-counts"] }); setNovoArt(""); setSearch(""); toast.success("Adicionado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<SistemaArtigo> }) => {
      const { error } = await supabase.from("biblioteca_sistema_artigos").update(vars.patch).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("biblioteca_sistema_artigos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ["bm-sistemas-counts"] }); toast.success("Removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Composição — {sistema?.nome}</DialogTitle></DialogHeader>

        <div className="rounded-md border border-border p-3 space-y-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Adicionar membro</div>
          <Input placeholder="Pesquisar artigo..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="border border-border rounded-md max-h-40 overflow-y-auto">
            {filtered.map((a) => (
              <button key={a.id} onClick={() => setNovoArt(a.id)}
                className={`block w-full text-left px-2 py-1 text-sm hover:bg-muted/50 ${novoArt === a.id ? "bg-muted" : ""}`}>
                <span className="font-mono text-xs text-muted-foreground mr-2">{a.codigo ?? "—"}</span>{a.descricao}
              </button>
            ))}
            {filtered.length === 0 && <div className="text-xs text-muted-foreground p-2 text-center">Sem resultados</div>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Select value={novoPapel} onValueChange={(v) => setNovoPapel(v as PapelSistema)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAPEIS_SISTEMA.map((p) => <SelectItem key={p} value={p}>{PAPEL_META[p].label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={novoObrig} onValueChange={(v) => setNovoObrig(v as Obrigatoriedade)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{OBRIGATORIEDADES.map((o) => <SelectItem key={o} value={o}>{OBRIGATORIEDADE_META[o].label}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => add.mutate()} disabled={!novoArt || add.isPending}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Ordem</TableHead>
                <TableHead>Artigo</TableHead>
                <TableHead className="w-40">Papel</TableHead>
                <TableHead className="w-40">Obrigatoriedade</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membros.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">Sistema vazio. Adiciona o membro principal acima.</TableCell></TableRow>}
              {membros.map((m) => {
                const art = artigoMap.get(m.artigo_id);
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Input type="number" className="w-16 h-8" value={m.ordem_execucao}
                        onChange={(e) => update.mutate({ id: m.id, patch: { ordem_execucao: Number(e.target.value) } })} />
                    </TableCell>
                    <TableCell className="text-sm">{art?.descricao ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={m.papel} onValueChange={(v) => update.mutate({ id: m.id, patch: { papel: v as PapelSistema } })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{PAPEIS_SISTEMA.map((p) => <SelectItem key={p} value={p}>{PAPEL_META[p].label}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={m.obrigatoriedade} onValueChange={(v) => update.mutate({ id: m.id, patch: { obrigatoriedade: v as Obrigatoriedade } })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{OBRIGATORIEDADES.map((o) => <SelectItem key={o} value={o}>{OBRIGATORIEDADE_META[o].label}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => remove.mutate(m.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
