import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { suggestCategoria } from "@/lib/biblioteca-mestra/biblioteca.functions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, X, Sparkles, FolderInput, Power, GitBranch } from "lucide-react";
import type { Especialidade, Subespecialidade, Categoria, ArtigoMestre, ArtigoKeyword, Unidade, ArtigoTipo, ArtigoEstadoIA } from "@/lib/biblioteca-mestra/types";
import { ARTIGO_TIPOS, ARTIGO_ESTADOS_IA } from "@/lib/biblioteca-mestra/types";
import { ArtigoRelacoesDialog } from "@/components/biblioteca-mestra/ArtigoRelacoesDialog";

export const Route = createFileRoute("/_app/biblioteca-mestra/artigos")({
  head: () => ({ meta: [{ title: "Artigos Mestre — Biblioteca Mestra — MV OS" }] }),
  component: ArtigosPage,
});

type EditState = Partial<ArtigoMestre> & { positivas?: string[]; negativas?: string[] };

function ArtigosPage() {
  const qc = useQueryClient();
  const suggest = useServerFn(suggestCategoria);
  const [search, setSearch] = useState("");
  const [espFilter, setEspFilter] = useState<string>("all");
  const [subFilter, setSubFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [onlyPorClassificar, setOnlyPorClassificar] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [kwInputPos, setKwInputPos] = useState("");
  const [kwInputNeg, setKwInputNeg] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetCat, setMoveTargetCat] = useState<string>("");
  const [moveEsp, setMoveEsp] = useState<string>("all");
  const [moveSub, setMoveSub] = useState<string>("all");
  const [suggestingId, setSuggestingId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ artigoId: string; categoriaId: string; confianca: number; nomeCategoria: string } | null>(null);

  const { data: esps = [] } = useQuery({
    queryKey: ["bm-esp"],
    queryFn: async () => (await supabase.from("biblioteca_especialidades").select("*").order("ordem")).data as Especialidade[],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["bm-sub"],
    queryFn: async () => (await supabase.from("biblioteca_subespecialidades").select("*").order("nome")).data as Subespecialidade[],
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["bm-cat"],
    queryFn: async () => (await supabase.from("biblioteca_categorias").select("*").order("ordem").order("nome")).data as Categoria[],
  });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["bm-art"],
    queryFn: async () => (await supabase.from("biblioteca_artigos").select("*").order("descricao")).data as ArtigoMestre[],
  });
  const { data: kws = [] } = useQuery({
    queryKey: ["bm-kw"],
    queryFn: async () => (await supabase.from("biblioteca_artigo_keywords").select("*")).data as ArtigoKeyword[],
  });
  const { data: unidades = [] } = useQuery({
    queryKey: ["bm-unidades"],
    queryFn: async () => (await supabase.from("biblioteca_unidades").select("*").eq("ativa", true).order("ordem")).data as Unidade[],
  });

  const subMap = useMemo(() => new Map(subs.map((s) => [s.id, s])), [subs]);
  const espMap = useMemo(() => new Map(esps.map((e) => [e.id, e])), [esps]);
  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
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

  const catsBySub = useMemo(() => {
    if (subFilter === "all") return cats;
    return cats.filter((c) => c.subespecialidade_id === subFilter);
  }, [cats, subFilter]);

  const moveSubs = useMemo(() => moveEsp === "all" ? subs : subs.filter((s) => s.especialidade_id === moveEsp), [subs, moveEsp]);
  const moveCats = useMemo(() => moveSub === "all" ? [] : cats.filter((c) => c.subespecialidade_id === moveSub), [cats, moveSub]);

  const filtered = rows.filter((r) => {
    const sub = subMap.get(r.subespecialidade_id);
    const cat = catMap.get(r.categoria_id);
    if (espFilter !== "all" && sub?.especialidade_id !== espFilter) return false;
    if (subFilter !== "all" && r.subespecialidade_id !== subFilter) return false;
    if (catFilter !== "all" && r.categoria_id !== catFilter) return false;
    if (tipoFilter !== "all" && r.tipo !== tipoFilter) return false;
    if (estadoFilter !== "all" && r.estado_ia !== estadoFilter) return false;
    if (onlyPorClassificar && !(cat?.nome === "Por Classificar" && cat.ordem === 0)) return false;
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

  const defaultUnidadeId = useMemo(() => unidades.find((u) => u.codigo === "vg")?.id ?? unidades[0]?.id, [unidades]);

  const openEdit = (a?: ArtigoMestre) => {
    if (a) {
      const list = kwsByArt.get(a.id) ?? [];
      setEditing({
        ...a,
        positivas: list.filter((k) => k.tipo === "positiva").map((k) => k.termo),
        negativas: list.filter((k) => k.tipo === "negativa").map((k) => k.termo),
      });
    } else {
      const defSub = subFilter !== "all" ? subFilter : undefined;
      const defCat = catFilter !== "all" ? catFilter : (defSub ? cats.find((c) => c.subespecialidade_id === defSub && c.ordem === 0)?.id : undefined);
      setEditing({
        ativo: true,
        positivas: [],
        negativas: [],
        subespecialidade_id: defSub,
        categoria_id: defCat,
        tipo: "outros",
        estado_ia: "validado",
        unidade_id: defaultUnidadeId,
      });
    }
    setKwInputPos("");
    setKwInputNeg("");
    setEditOpen(true);
  };

  const save = useMutation({
    mutationFn: async (e: EditState) => {
      if (!e.descricao?.trim()) throw new Error("Descrição obrigatória");
      if (!e.categoria_id) throw new Error("Categoria obrigatória");
      if (!e.tipo) throw new Error("Tipo obrigatório");
      if (!e.unidade_id) throw new Error("Unidade obrigatória");
      const cat = catMap.get(e.categoria_id);
      if (!cat) throw new Error("Categoria inválida");
      const payload = {
        subespecialidade_id: cat.subespecialidade_id,
        categoria_id: e.categoria_id,
        codigo: e.codigo ?? null,
        descricao: e.descricao.trim(),
        unidade_id: e.unidade_id,
        tipo: e.tipo,
        estado_ia: e.estado_ia ?? "validado",
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

  const bulkMove = useMutation({
    mutationFn: async ({ ids, categoria_id }: { ids: string[]; categoria_id: string }) => {
      const cat = catMap.get(categoria_id);
      if (!cat) throw new Error("Categoria inválida");
      const { error } = await supabase.from("biblioteca_artigos").update({ categoria_id, subespecialidade_id: cat.subespecialidade_id }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["bm-art"] }); setSelected(new Set()); setMoveOpen(false); toast.success(`${v.ids.length} artigo(s) movido(s)`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkToggle = useMutation({
    mutationFn: async ({ ids, ativo }: { ids: string[]; ativo: boolean }) => {
      const { error } = await supabase.from("biblioteca_artigos").update({ ativo }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["bm-art"] }); toast.success(`${v.ids.length} artigo(s) atualizado(s)`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("biblioteca_artigos").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => { qc.invalidateQueries({ queryKey: ["bm-art"] }); setSelected(new Set()); toast.success(`${ids.length} artigo(s) eliminado(s)`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addKw = (kind: "positivas" | "negativas", val: string) => {
    const t = val.trim();
    if (!t || !editing) return;
    const cur = editing[kind] ?? [];
    if (cur.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    setEditing({ ...editing, [kind]: [...cur, t] });
  };

  const handleSuggest = async (a: ArtigoMestre) => {
    setSuggestingId(a.id);
    try {
      const res = await suggest({ data: { descricao: a.descricao, subespecialidadeId: a.subespecialidade_id } });
      const cat = catMap.get(res.categoriaId);
      if (!cat) throw new Error("Categoria sugerida não encontrada");
      setSuggestion({ artigoId: a.id, categoriaId: res.categoriaId, confianca: res.confianca, nomeCategoria: cat.nome });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na sugestão");
    } finally {
      setSuggestingId(null);
    }
  };

  const applySuggestion = async () => {
    if (!suggestion) return;
    await bulkMove.mutateAsync({ ids: [suggestion.artigoId], categoria_id: suggestion.categoriaId });
    setSuggestion(null);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  return (
    <>
      <PageHeader
        title="Pesquisa Global de Artigos"
        subtitle="Pesquisa transversal a toda a Biblioteca Mestra. Para navegar pela hierarquia, use o Explorador → Categorias."
        actions={<Button onClick={() => openEdit()}><Plus className="h-4 w-4 mr-1" /> Novo</Button>}
      />
      <div className="p-6 space-y-4">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={espFilter} onValueChange={(v) => { setEspFilter(v); setSubFilter("all"); setCatFilter("all"); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as especialidades</SelectItem>
              {esps.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={subFilter} onValueChange={(v) => { setSubFilter(v); setCatFilter("all"); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as subespecialidades</SelectItem>
              {subsByEsp.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {catsBySub.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {ARTIGO_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados IA</SelectItem>
              {ARTIGO_ESTADOS_IA.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant={onlyPorClassificar ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyPorClassificar((v) => !v)}
          >
            Apenas "Por Classificar"
          </Button>
        </div>

        {selected.size > 0 && (
          <Card className="bg-primary/5 border-primary/30 p-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
            <Button size="sm" variant="outline" onClick={() => { setMoveOpen(true); setMoveTargetCat(""); setMoveEsp("all"); setMoveSub("all"); }}>
              <FolderInput className="h-4 w-4 mr-1" /> Mover para categoria…
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkToggle.mutate({ ids: Array.from(selected), ativo: true })}>
              <Power className="h-4 w-4 mr-1" /> Ativar
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkToggle.mutate({ ids: Array.from(selected), ativo: false })}>
              <Power className="h-4 w-4 mr-1" /> Desativar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Eliminar ${selected.size} artigo(s)?`)) bulkDelete.mutate(Array.from(selected)); }}>
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
          </Card>
        )}

        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="w-28">Tipo</TableHead>
                <TableHead className="w-16">Un.</TableHead>
                <TableHead className="w-36">Estado IA</TableHead>
                <TableHead>Palavras-chave</TableHead>
                <TableHead className="w-40 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">A carregar...</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Sem artigos</TableCell></TableRow>}
              {filtered.map((r) => {
                const sub = subMap.get(r.subespecialidade_id);
                const esp = sub ? espMap.get(sub.especialidade_id) : null;
                const cat = catMap.get(r.categoria_id);
                const isPorClassificar = cat?.nome === "Por Classificar" && cat.ordem === 0;
                const arrKw = kwsByArt.get(r.id) ?? [];
                const tipoLabel = ARTIGO_TIPOS.find((t) => t.value === r.tipo)?.label ?? r.tipo;
                const estado = ARTIGO_ESTADOS_IA.find((s) => s.value === r.estado_ia);
                const unidade = unidades.find((u) => u.id === r.unidade_id);
                return (
                  <TableRow key={r.id} className={isPorClassificar ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}>
                    <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} /></TableCell>
                    <TableCell className="font-mono text-xs">{r.codigo ?? "—"}</TableCell>
                    <TableCell className="font-medium">{r.descricao}</TableCell>
                    <TableCell className="text-sm">
                      <div className="text-muted-foreground text-xs">{esp?.nome} / {sub?.nome ?? "—"}</div>
                      <div className={isPorClassificar ? "text-amber-700 dark:text-amber-400 font-medium" : ""}>{cat?.nome ?? "—"}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{tipoLabel}</Badge></TableCell>
                    <TableCell>{unidade?.simbolo ?? r.unidade ?? "—"}</TableCell>
                    <TableCell>
                      {estado && (
                        <Badge variant="outline" className={`gap-1.5 ${estado.className}`}>
                          <span className={`inline-block h-2 w-2 rounded-full ${estado.dot}`} />
                          {estado.label}
                        </Badge>
                      )}
                    </TableCell>
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
                      {isPorClassificar && (
                        <Button size="icon" variant="ghost" onClick={() => handleSuggest(r)} disabled={suggestingId === r.id} title="Sugerir categoria com IA">
                          <Sparkles className={`h-4 w-4 ${suggestingId === r.id ? "animate-pulse" : ""}`} />
                        </Button>
                      )}
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

      {/* Editar/Criar */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} Artigo Mestre</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Subespecialidade *</Label>
                <Select
                  value={editing?.subespecialidade_id}
                  onValueChange={(v) => {
                    const firstCat = cats.find((c) => c.subespecialidade_id === v && c.ordem === 0);
                    setEditing({ ...editing, subespecialidade_id: v, categoria_id: firstCat?.id });
                  }}
                >
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
              <div>
                <Label>Categoria *</Label>
                <Select
                  value={editing?.categoria_id}
                  onValueChange={(v) => setEditing({ ...editing, categoria_id: v })}
                  disabled={!editing?.subespecialidade_id}
                >
                  <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                  <SelectContent>
                    {cats.filter((c) => c.subespecialidade_id === editing?.subespecialidade_id).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Código</Label><Input value={editing?.codigo ?? ""} onChange={(e) => setEditing({ ...editing, codigo: e.target.value })} /></div>
              <div>
                <Label>Unidade *</Label>
                <Select value={editing?.unidade_id} onValueChange={(v) => setEditing({ ...editing, unidade_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                  <SelectContent>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.simbolo} — {u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={editing?.tipo} onValueChange={(v) => setEditing({ ...editing, tipo: v as ArtigoTipo })}>
                  <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                  <SelectContent>
                    {ARTIGO_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Estado IA *</Label>
              <Select value={editing?.estado_ia} onValueChange={(v) => setEditing({ ...editing, estado_ia: v as ArtigoEstadoIA })}>
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {ARTIGO_ESTADOS_IA.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="inline-flex items-center gap-2"><span className={`inline-block h-2 w-2 rounded-full ${s.dot}`} />{s.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Mover em massa */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover {selected.size} artigo(s) para categoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Especialidade</Label>
              <Select value={moveEsp} onValueChange={(v) => { setMoveEsp(v); setMoveSub("all"); setMoveTargetCat(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">—</SelectItem>
                  {esps.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subespecialidade</Label>
              <Select value={moveSub} onValueChange={(v) => { setMoveSub(v); setMoveTargetCat(""); }} disabled={moveEsp === "all"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">—</SelectItem>
                  {moveSubs.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria *</Label>
              <Select value={moveTargetCat} onValueChange={setMoveTargetCat} disabled={moveSub === "all"}>
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {moveCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancelar</Button>
            <Button disabled={!moveTargetCat || bulkMove.isPending} onClick={() => bulkMove.mutate({ ids: Array.from(selected), categoria_id: moveTargetCat })}>Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sugestão IA */}
      <AlertDialog open={!!suggestion} onOpenChange={(o) => !o && setSuggestion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sugestão da IA</AlertDialogTitle>
          </AlertDialogHeader>
          {suggestion && (
            <div className="text-sm space-y-2">
              <p>Categoria sugerida: <span className="font-medium">{suggestion.nomeCategoria}</span></p>
              <p>Confiança: <span className="font-mono">{(suggestion.confianca * 100).toFixed(0)}%</span></p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={applySuggestion}>Aplicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
