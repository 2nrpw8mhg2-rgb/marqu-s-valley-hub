import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { Plus, Pencil, Trash2, Search, ArrowUp, ArrowDown, ArrowLeftRight, Lock, ChevronRight, ChevronDown, Copy, FolderInput } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Especialidade, Subespecialidade, Categoria, ArtigoMestre, ArtigoKeyword, Unidade } from "@/lib/biblioteca-mestra/types";
import { ARTIGO_TIPOS, ARTIGO_ESTADOS_IA } from "@/lib/biblioteca-mestra/types";
import { ArtigoMestreFormDialog, type ArtigoFormState } from "@/components/biblioteca-mestra/ArtigoMestreFormDialog";

export const Route = createFileRoute("/_app/biblioteca-mestra/categorias")({
  head: () => ({ meta: [{ title: "Categorias — Biblioteca Mestra — MV OS" }] }),
  component: CategoriasPage,
});

type ArtCount = { categoria_id: string; count: number };

async function fetchAllArtigoCategoriaIds() {
  const pageSize = 1000;
  const rows: { categoria_id: string | null }[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("biblioteca_artigos")
      .select("categoria_id")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchAllArtigos() {
  const pageSize = 1000;
  const rows: ArtigoMestre[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("biblioteca_artigos")
      .select("*")
      .order("descricao")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as ArtigoMestre[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [artFormOpen, setArtFormOpen] = useState(false);
  const [artFormInitial, setArtFormInitial] = useState<ArtigoFormState | null>(null);
  const [deleteArt, setDeleteArt] = useState<ArtigoMestre | null>(null);
  const [moveArt, setMoveArt] = useState<ArtigoMestre | null>(null);
  const [moveArtEsp, setMoveArtEsp] = useState<string>("");
  const [moveArtSub, setMoveArtSub] = useState<string>("");
  const [moveArtCat, setMoveArtCat] = useState<string>("");

  const [espW, setEspW] = useState<number>(() => {
    if (typeof window === "undefined") return 280;
    const v = Number(window.localStorage.getItem("bm-cat-espW"));
    return v >= 160 && v <= 600 ? v : 280;
  });
  const [subW, setSubW] = useState<number>(() => {
    if (typeof window === "undefined") return 280;
    const v = Number(window.localStorage.getItem("bm-cat-subW"));
    return v >= 160 && v <= 600 ? v : 280;
  });
  const [catW, setCatW] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem("bm-cat-catW");
    if (!raw) return null;
    const v = Number(raw);
    return v >= 320 && v <= 2400 ? v : null;
  });
  useEffect(() => { window.localStorage.setItem("bm-cat-espW", String(espW)); }, [espW]);
  useEffect(() => { window.localStorage.setItem("bm-cat-subW", String(subW)); }, [subW]);
  useEffect(() => {
    if (catW == null) window.localStorage.removeItem("bm-cat-catW");
    else window.localStorage.setItem("bm-cat-catW", String(catW));
  }, [catW]);

  const startResize = (which: "esp" | "sub" | "cat") => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW =
      which === "esp" ? espW : which === "sub" ? subW : (catW ?? (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect().width);
    const min = which === "cat" ? 320 : 180;
    const max = which === "cat" ? 2400 : 600;
    // For "cat" the handle lives on the LEFT edge: dragging left should grow width.
    const sign = which === "cat" ? -1 : 1;
    const setter =
      which === "esp" ? setEspW : which === "sub" ? setSubW : (v: number) => setCatW(v);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(max, Math.max(min, startW + sign * (ev.clientX - startX)));
      setter(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

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
      const data = await fetchAllArtigoCategoriaIds();
      const m = new Map<string, number>();
      data.forEach((r) => {
        if (r.categoria_id) m.set(r.categoria_id, (m.get(r.categoria_id) ?? 0) + 1);
      });
      return Array.from(m.entries()).map(([categoria_id, count]) => ({ categoria_id, count })) as ArtCount[];
    },
  });
  const { data: allArtigos = [] } = useQuery({
    queryKey: ["bm-art"],
    queryFn: fetchAllArtigos,
  });
  const { data: allKws = [] } = useQuery({
    queryKey: ["bm-kw"],
    queryFn: async () => (await supabase.from("biblioteca_artigo_keywords").select("*")).data as ArtigoKeyword[],
  });
  const { data: unidades = [] } = useQuery({
    queryKey: ["bm-unidades"],
    queryFn: async () => (await supabase.from("biblioteca_unidades").select("*").eq("ativa", true).order("ordem")).data as Unidade[],
  });

  const espMap = useMemo(() => new Map(esps.map((e) => [e.id, e])), [esps]);
  const subMap = useMemo(() => new Map(subs.map((s) => [s.id, s])), [subs]);
  const countMap = useMemo(() => new Map(artCounts.map((a) => [a.categoria_id, a.count])), [artCounts]);
  const artigosByCat = useMemo(() => {
    const m = new Map<string, ArtigoMestre[]>();
    for (const a of allArtigos) {
      if (!m.has(a.categoria_id)) m.set(a.categoria_id, []);
      m.get(a.categoria_id)!.push(a);
    }
    return m;
  }, [allArtigos]);
  const kwCountByArt = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of allKws) m.set(k.artigo_id, (m.get(k.artigo_id) ?? 0) + 1);
    return m;
  }, [allKws]);
  const unidadeMap = useMemo(() => new Map(unidades.map((u) => [u.id, u])), [unidades]);
  const defaultUnidadeId = useMemo(() => unidades.find((u) => u.codigo === "vg")?.id ?? unidades[0]?.id, [unidades]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openNewArtigo = (cat: Categoria) => {
    setArtFormInitial({
      ativo: true,
      positivas: [],
      negativas: [],
      subespecialidade_id: cat.subespecialidade_id,
      categoria_id: cat.id,
      tipo: "outros",
      estado_ia: "validado",
      unidade_id: defaultUnidadeId,
    });
    setArtFormOpen(true);
  };

  const openEditArtigo = (a: ArtigoMestre) => {
    const list = allKws.filter((k) => k.artigo_id === a.id);
    setArtFormInitial({
      ...a,
      positivas: list.filter((k) => k.tipo === "positiva").map((k) => k.termo),
      negativas: list.filter((k) => k.tipo === "negativa").map((k) => k.termo),
    });
    setArtFormOpen(true);
  };

  const openDuplicateArtigo = (a: ArtigoMestre) => {
    const list = allKws.filter((k) => k.artigo_id === a.id);
    setArtFormInitial({
      subespecialidade_id: a.subespecialidade_id,
      categoria_id: a.categoria_id,
      codigo: a.codigo ?? undefined,
      descricao: `${a.descricao} (cópia)`,
      unidade_id: a.unidade_id,
      tipo: a.tipo,
      estado_ia: a.estado_ia,
      observacoes: a.observacoes ?? undefined,
      ativo: a.ativo,
      positivas: list.filter((k) => k.tipo === "positiva").map((k) => k.termo),
      negativas: list.filter((k) => k.tipo === "negativa").map((k) => k.termo),
    });
    setArtFormOpen(true);
  };


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

  const removeArtigo = useMutation({
    mutationFn: async (a: ArtigoMestre) => {
      const { error } = await supabase.from("biblioteca_artigos").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-art"] });
      qc.invalidateQueries({ queryKey: ["bm-art-cat-counts"] });
      setDeleteArt(null);
      toast.success("Artigo eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivoArtigo = useMutation({
    mutationFn: async (a: ArtigoMestre) => {
      const { error } = await supabase.from("biblioteca_artigos").update({ ativo: !a.ativo }).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bm-art"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const moveArtigo = useMutation({
    mutationFn: async ({ a, categoria_id }: { a: ArtigoMestre; categoria_id: string }) => {
      const cat = cats.find((c) => c.id === categoria_id);
      if (!cat) throw new Error("Categoria inválida");
      const { error } = await supabase.from("biblioteca_artigos").update({ categoria_id, subespecialidade_id: cat.subespecialidade_id }).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-art"] });
      qc.invalidateQueries({ queryKey: ["bm-art-cat-counts"] });
      setMoveArt(null);
      toast.success("Artigo movido");
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

        <div
          className="flex flex-col lg:flex-row gap-4 items-stretch lg:overflow-x-auto"
        >
          {/* Especialidades */}
          <Card style={{ width: espW }} className="bg-card border-border p-2 h-fit shrink-0 relative w-full lg:w-auto">
            <div
              onMouseDown={startResize("esp")}
              title="Arrastar para redimensionar"
              className="hidden lg:block absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
            />
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
          <Card style={{ width: subW }} className="bg-card border-border p-2 h-fit shrink-0 relative w-full lg:w-auto">
            <div
              onMouseDown={startResize("sub")}
              title="Arrastar para redimensionar"
              className="hidden lg:block absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
            />
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
          <Card className="bg-card border-border flex-1 min-w-0">
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
                const isExpanded = expanded.has(c.id);
                const catArtigos = artigosByCat.get(c.id) ?? [];
                return (
                  <div key={c.id}>
                    <div className={cn("flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors", protectedCat && "bg-amber-50/40 dark:bg-amber-900/10")}>
                      <button
                        onClick={() => toggleExpanded(c.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Recolher artigos" : "Expandir artigos"}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
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
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpanded(c.id)}>
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

                    {isExpanded && (
                      <div className="bg-muted/20 border-t border-border">
                        <div className="flex items-center justify-between px-12 py-2 border-b border-border/60">
                          <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Artigos Mestre ({catArtigos.length})</span>
                          <Button size="sm" variant="outline" onClick={() => openNewArtigo(c)}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Novo artigo
                          </Button>
                        </div>
                        {catArtigos.length === 0 && (
                          <div className="px-12 py-6 text-center text-xs text-muted-foreground">
                            Sem artigos nesta categoria — clique em "Novo artigo" para adicionar.
                          </div>
                        )}
                        <ul className="divide-y divide-border/40">
                          {catArtigos.map((a) => {
                            const tipoLabel = ARTIGO_TIPOS.find((t) => t.value === a.tipo)?.label ?? a.tipo;
                            const estado = ARTIGO_ESTADOS_IA.find((s) => s.value === a.estado_ia);
                            const unidade = unidadeMap.get(a.unidade_id);
                            const nKw = kwCountByArt.get(a.id) ?? 0;
                            return (
                              <li key={a.id} className="flex items-center gap-3 pl-12 pr-4 py-2 hover:bg-muted/30 transition-colors">
                                <span className="font-mono text-[11px] text-muted-foreground w-20 truncate shrink-0">{a.codigo ?? "—"}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm truncate">{a.descricao}</div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">{tipoLabel}</Badge>
                                    <span className="text-[11px] text-muted-foreground font-mono">{unidade?.simbolo ?? a.unidade ?? "—"}</span>
                                    {estado && (
                                      <Badge variant="outline" className={`text-[10px] h-4 px-1.5 gap-1 ${estado.className}`}>
                                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${estado.dot}`} />
                                        {estado.label}
                                      </Badge>
                                    )}
                                    <span className="text-[11px] text-muted-foreground">{nKw} palavra{nKw === 1 ? "" : "s"}-chave</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Switch checked={a.ativo} onCheckedChange={() => toggleAtivoArtigo.mutate(a)} aria-label="Ativo" />
                                  <span className="text-[11px] text-muted-foreground hidden xl:inline w-12">{a.ativo ? "Ativo" : "Inativo"}</span>
                                </div>
                                <div className="flex items-center shrink-0">
                                  <Button size="icon" variant="ghost" onClick={() => openEditArtigo(a)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                                  <Button size="icon" variant="ghost" onClick={() => openDuplicateArtigo(a)} title="Duplicar"><Copy className="h-3.5 w-3.5" /></Button>
                                  <Button size="icon" variant="ghost" onClick={() => { setMoveArt(a); const s = subMap.get(a.subespecialidade_id); setMoveArtEsp(s?.especialidade_id ?? ""); setMoveArtSub(a.subespecialidade_id); setMoveArtCat(""); }} title="Mover para outra categoria"><FolderInput className="h-3.5 w-3.5" /></Button>
                                  <Button size="icon" variant="ghost" onClick={() => setDeleteArt(a)} title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></Button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
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

      <ArtigoMestreFormDialog open={artFormOpen} onOpenChange={setArtFormOpen} initial={artFormInitial} />

      <AlertDialog open={!!deleteArt} onOpenChange={(o) => !o && setDeleteArt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar artigo?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteArt && `O artigo "${deleteArt.descricao}" será eliminado definitivamente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteArt && removeArtigo.mutate(deleteArt)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!moveArt} onOpenChange={(o) => !o && setMoveArt(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover artigo para outra categoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Artigo: </span>
              <span className="font-medium">{moveArt?.descricao}</span>
            </div>
            <div>
              <Label>Especialidade</Label>
              <Select value={moveArtEsp} onValueChange={(v) => { setMoveArtEsp(v); setMoveArtSub(""); setMoveArtCat(""); }}>
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {esps.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subespecialidade</Label>
              <Select value={moveArtSub} onValueChange={(v) => { setMoveArtSub(v); setMoveArtCat(""); }} disabled={!moveArtEsp}>
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {subs.filter((s) => s.especialidade_id === moveArtEsp).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria destino *</Label>
              <Select value={moveArtCat} onValueChange={setMoveArtCat} disabled={!moveArtSub}>
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {cats.filter((c) => c.subespecialidade_id === moveArtSub).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveArt(null)}>Cancelar</Button>
            <Button
              disabled={!moveArtCat || moveArtCat === moveArt?.categoria_id || moveArtigo.isPending}
              onClick={() => moveArt && moveArtigo.mutate({ a: moveArt, categoria_id: moveArtCat })}
            >Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
