import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, Search, FolderTree, FileText, Tag, Library, Folder } from "lucide-react";
import type { Especialidade, Subespecialidade, Categoria, ArtigoMestre, ArtigoKeyword } from "@/lib/biblioteca-mestra/types";

export const Route = createFileRoute("/_app/biblioteca-mestra/")({
  head: () => ({ meta: [{ title: "Biblioteca Mestra — Explorador — MV OS" }] }),
  component: ExploradorPage,
});

type Selected =
  | { kind: "esp"; id: string }
  | { kind: "sub"; id: string }
  | { kind: "cat"; id: string }
  | { kind: "art"; id: string }
  | null;

function ExploradorPage() {
  const [search, setSearch] = useState("");
  const [openEsp, setOpenEsp] = useState<Record<string, boolean>>({});
  const [openSub, setOpenSub] = useState<Record<string, boolean>>({});
  const [openCat, setOpenCat] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Selected>(null);

  const { data: especialidades = [] } = useQuery({
    queryKey: ["bm-esp"],
    queryFn: async () => (await supabase.from("biblioteca_especialidades").select("*").order("ordem").order("nome")).data as Especialidade[],
  });
  const { data: subespecialidades = [] } = useQuery({
    queryKey: ["bm-sub"],
    queryFn: async () => (await supabase.from("biblioteca_subespecialidades").select("*").order("ordem").order("nome")).data as Subespecialidade[],
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ["bm-cat"],
    queryFn: async () => (await supabase.from("biblioteca_categorias").select("*").order("ordem").order("nome")).data as Categoria[],
  });
  const { data: artigos = [] } = useQuery({
    queryKey: ["bm-art"],
    queryFn: async () => (await supabase.from("biblioteca_artigos").select("*").order("descricao")).data as ArtigoMestre[],
  });
  const { data: keywords = [] } = useQuery({
    queryKey: ["bm-kw"],
    queryFn: async () => (await supabase.from("biblioteca_artigo_keywords").select("*")).data as ArtigoKeyword[],
  });

  const subsByEsp = useMemo(() => {
    const m = new Map<string, Subespecialidade[]>();
    for (const s of subespecialidades) {
      if (!m.has(s.especialidade_id)) m.set(s.especialidade_id, []);
      m.get(s.especialidade_id)!.push(s);
    }
    return m;
  }, [subespecialidades]);

  const catsBySub = useMemo(() => {
    const m = new Map<string, Categoria[]>();
    for (const c of categorias) {
      if (!m.has(c.subespecialidade_id)) m.set(c.subespecialidade_id, []);
      m.get(c.subespecialidade_id)!.push(c);
    }
    return m;
  }, [categorias]);

  const artsByCat = useMemo(() => {
    const m = new Map<string, ArtigoMestre[]>();
    for (const a of artigos) {
      if (!m.has(a.categoria_id)) m.set(a.categoria_id, []);
      m.get(a.categoria_id)!.push(a);
    }
    return m;
  }, [artigos]);

  const kwsByArt = useMemo(() => {
    const m = new Map<string, ArtigoKeyword[]>();
    for (const k of keywords) {
      if (!m.has(k.artigo_id)) m.set(k.artigo_id, []);
      m.get(k.artigo_id)!.push(k);
    }
    return m;
  }, [keywords]);

  const term = search.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!term) return null;
    const espIds = new Set<string>();
    const subIds = new Set<string>();
    const catIds = new Set<string>();
    const artIds = new Set<string>();
    for (const e of especialidades) {
      if (e.nome.toLowerCase().includes(term) || (e.codigo ?? "").toLowerCase().includes(term)) espIds.add(e.id);
    }
    for (const s of subespecialidades) {
      if (s.nome.toLowerCase().includes(term) || (s.codigo ?? "").toLowerCase().includes(term)) {
        subIds.add(s.id);
        espIds.add(s.especialidade_id);
      }
    }
    for (const c of categorias) {
      if (c.nome.toLowerCase().includes(term) || (c.codigo ?? "").toLowerCase().includes(term)) {
        catIds.add(c.id);
        subIds.add(c.subespecialidade_id);
        const sub = subespecialidades.find((s) => s.id === c.subespecialidade_id);
        if (sub) espIds.add(sub.especialidade_id);
      }
    }
    for (const a of artigos) {
      const kws = kwsByArt.get(a.id) ?? [];
      const inKw = kws.some((k) => k.termo.toLowerCase().includes(term));
      if (a.descricao.toLowerCase().includes(term) || (a.codigo ?? "").toLowerCase().includes(term) || (a.observacoes ?? "").toLowerCase().includes(term) || inKw) {
        artIds.add(a.id);
        catIds.add(a.categoria_id);
        const sub = subespecialidades.find((s) => s.id === a.subespecialidade_id);
        if (sub) { subIds.add(sub.id); espIds.add(sub.especialidade_id); }
      }
    }
    return { espIds, subIds, catIds, artIds };
  }, [term, especialidades, subespecialidades, categorias, artigos, kwsByArt]);

  const detail = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "esp") {
      const e = especialidades.find((x) => x.id === selected.id);
      if (!e) return null;
      return { type: "esp" as const, esp: e, subs: subsByEsp.get(e.id) ?? [] };
    }
    if (selected.kind === "sub") {
      const s = subespecialidades.find((x) => x.id === selected.id);
      if (!s) return null;
      const e = especialidades.find((x) => x.id === s.especialidade_id);
      return { type: "sub" as const, sub: s, cats: catsBySub.get(s.id) ?? [], esp: e };
    }
    if (selected.kind === "cat") {
      const c = categorias.find((x) => x.id === selected.id);
      if (!c) return null;
      const s = subespecialidades.find((x) => x.id === c.subespecialidade_id);
      const e = s ? especialidades.find((x) => x.id === s.especialidade_id) : undefined;
      return { type: "cat" as const, cat: c, arts: artsByCat.get(c.id) ?? [], sub: s, esp: e };
    }
    const a = artigos.find((x) => x.id === selected.id);
    if (!a) return null;
    const c = categorias.find((x) => x.id === a.categoria_id);
    const s = subespecialidades.find((x) => x.id === a.subespecialidade_id);
    const e = s ? especialidades.find((x) => x.id === s.especialidade_id) : undefined;
    return { type: "art" as const, art: a, kws: kwsByArt.get(a.id) ?? [], cat: c, sub: s, esp: e };
  }, [selected, especialidades, subespecialidades, categorias, artigos, subsByEsp, catsBySub, artsByCat, kwsByArt]);

  return (
    <>
      <PageHeader
        title="Biblioteca Mestra"
        subtitle="Especialidades · Subespecialidades · Categorias · Artigos Mestre"
      />

      <div className="p-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, código ou palavra-chave..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
          <Card className="bg-card border-border p-2 max-h-[75vh] overflow-y-auto">
            {especialidades.length === 0 && (
              <div className="text-sm text-muted-foreground p-6 text-center">
                <Library className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Sem especialidades.
              </div>
            )}
            <ul className="text-sm">
              {especialidades.filter((e) => !matches || matches.espIds.has(e.id)).map((e) => {
                const isOpen = matches ? true : !!openEsp[e.id];
                const subs = (subsByEsp.get(e.id) ?? []).filter((s) => !matches || matches.subIds.has(s.id));
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => { setOpenEsp((o) => ({ ...o, [e.id]: !o[e.id] })); setSelected({ kind: "esp", id: e.id }); }}
                      className={`w-full flex items-center gap-1 rounded px-2 py-1.5 hover:bg-muted/50 ${selected?.kind === "esp" && selected.id === e.id ? "bg-muted" : ""}`}
                    >
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      <FolderTree className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium">{e.nome}</span>
                      {!e.ativa && <Badge variant="outline" className="text-[10px] ml-1">inativa</Badge>}
                    </button>
                    {isOpen && (
                      <ul className="ml-5 border-l border-border/60">
                        {subs.length === 0 && <li className="text-xs text-muted-foreground px-2 py-1">— sem subespecialidades —</li>}
                        {subs.map((s) => {
                          const isSubOpen = matches ? true : !!openSub[s.id];
                          const subCats = (catsBySub.get(s.id) ?? []).filter((c) => !matches || matches.catIds.has(c.id));
                          return (
                            <li key={s.id}>
                              <button
                                onClick={() => { setOpenSub((o) => ({ ...o, [s.id]: !o[s.id] })); setSelected({ kind: "sub", id: s.id }); }}
                                className={`w-full flex items-center gap-1 rounded px-2 py-1 hover:bg-muted/50 ${selected?.kind === "sub" && selected.id === s.id ? "bg-muted" : ""}`}
                              >
                                {isSubOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <FolderTree className="h-3 w-3 text-muted-foreground" />
                                <span>{s.nome}</span>
                                <span className="ml-auto text-[10px] text-muted-foreground">{subCats.length}</span>
                              </button>
                              {isSubOpen && (
                                <ul className="ml-5 border-l border-border/60">
                                  {subCats.length === 0 && <li className="text-xs text-muted-foreground px-2 py-1">— sem categorias —</li>}
                                  {subCats.map((c) => {
                                    const isCatOpen = matches ? true : !!openCat[c.id];
                                    const catArts = (artsByCat.get(c.id) ?? []).filter((a) => !matches || matches.artIds.has(a.id));
                                    const isPorClassificar = c.nome === "Por Classificar" && c.ordem === 0;
                                    return (
                                      <li key={c.id}>
                                        <button
                                          onClick={() => { setOpenCat((o) => ({ ...o, [c.id]: !o[c.id] })); setSelected({ kind: "cat", id: c.id }); }}
                                          className={`w-full flex items-center gap-1 rounded px-2 py-1 hover:bg-muted/50 ${selected?.kind === "cat" && selected.id === c.id ? "bg-muted" : ""}`}
                                        >
                                          {isCatOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                          <Folder className={`h-3 w-3 ${isPorClassificar ? "text-amber-500" : "text-muted-foreground"}`} />
                                          <span className={isPorClassificar ? "text-amber-700 dark:text-amber-400 italic" : ""}>{c.nome}</span>
                                          <span className="ml-auto text-[10px] text-muted-foreground">{(artsByCat.get(c.id) ?? []).length}</span>
                                        </button>
                                        {isCatOpen && (
                                          <ul className="ml-5 border-l border-border/60">
                                            {catArts.length === 0 && <li className="text-xs text-muted-foreground px-2 py-1">— sem artigos —</li>}
                                            {catArts.map((a) => (
                                              <li key={a.id}>
                                                <button
                                                  onClick={() => setSelected({ kind: "art", id: a.id })}
                                                  className={`w-full flex items-center gap-1 rounded px-2 py-1 hover:bg-muted/50 text-left ${selected?.kind === "art" && selected.id === a.id ? "bg-muted" : ""}`}
                                                >
                                                  <FileText className="h-3 w-3 text-muted-foreground" />
                                                  <span className="truncate">{a.descricao}</span>
                                                </button>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="bg-card border-border p-6 min-h-[300px]">
            {!detail && (
              <div className="text-sm text-muted-foreground text-center py-16">
                Selecciona um elemento na árvore para ver os detalhes.
              </div>
            )}

            {detail?.type === "esp" && (
              <div>
                <h2 className="text-xl font-semibold">{detail.esp.nome}</h2>
                <p className="text-xs text-muted-foreground mt-1">Código: <span className="font-mono">{detail.esp.codigo ?? "—"}</span></p>
                {detail.esp.descricao && <p className="text-sm mt-3">{detail.esp.descricao}</p>}
                <h3 className="text-sm font-semibold mt-6 mb-2">Subespecialidades ({detail.subs.length})</h3>
                <ul className="divide-y divide-border/60">
                  {detail.subs.map((s) => (
                    <li key={s.id} className="py-2 flex justify-between text-sm">
                      <button onClick={() => setSelected({ kind: "sub", id: s.id })} className="hover:underline">{s.nome}</button>
                      <span className="text-muted-foreground font-mono text-xs">{s.codigo ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail?.type === "sub" && (
              <div>
                <p className="text-xs text-muted-foreground">{detail.esp?.nome}</p>
                <h2 className="text-xl font-semibold">{detail.sub.nome}</h2>
                <p className="text-xs text-muted-foreground mt-1">Código: <span className="font-mono">{detail.sub.codigo ?? "—"}</span></p>
                {detail.sub.descricao && <p className="text-sm mt-3">{detail.sub.descricao}</p>}
                <h3 className="text-sm font-semibold mt-6 mb-2">Categorias ({detail.cats.length})</h3>
                <ul className="divide-y divide-border/60">
                  {detail.cats.map((c) => (
                    <li key={c.id} className="py-2 text-sm flex justify-between">
                      <button onClick={() => setSelected({ kind: "cat", id: c.id })} className="hover:underline">{c.nome}</button>
                      <span className="text-muted-foreground font-mono text-xs">{c.codigo ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail?.type === "cat" && (
              <div>
                <p className="text-xs text-muted-foreground">{detail.esp?.nome} / {detail.sub?.nome}</p>
                <h2 className="text-xl font-semibold">{detail.cat.nome}</h2>
                <p className="text-xs text-muted-foreground mt-1">Código: <span className="font-mono">{detail.cat.codigo ?? "—"}</span></p>
                {detail.cat.descricao && <p className="text-sm mt-3">{detail.cat.descricao}</p>}
                <h3 className="text-sm font-semibold mt-6 mb-2">Artigos Mestre ({detail.arts.length})</h3>
                <ul className="divide-y divide-border/60">
                  {detail.arts.map((a) => (
                    <li key={a.id} className="py-2 text-sm">
                      <button onClick={() => setSelected({ kind: "art", id: a.id })} className="hover:underline text-left">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{a.codigo ?? "—"}</span>
                        {a.descricao}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail?.type === "art" && (
              <div>
                <p className="text-xs text-muted-foreground">
                  {detail.esp?.nome} / {detail.sub?.nome} / {detail.cat?.nome}
                </p>
                <h2 className="text-xl font-semibold mt-1">{detail.art.descricao}</h2>
                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                  <span>Código: <span className="font-mono">{detail.art.codigo ?? "—"}</span></span>
                  <span>Unidade: <span className="font-mono">{detail.art.unidade ?? "—"}</span></span>
                  <span>{detail.art.ativo ? "Ativo" : "Inativo"}</span>
                </div>

                <h3 className="text-sm font-semibold mt-6 mb-2 flex items-center gap-2"><Tag className="h-4 w-4" /> Palavras-chave positivas</h3>
                <div className="flex flex-wrap gap-1.5">
                  {detail.kws.filter((k) => k.tipo === "positiva").map((k) => <Badge key={k.id} variant="secondary">{k.termo}</Badge>)}
                  {detail.kws.filter((k) => k.tipo === "positiva").length === 0 && <span className="text-xs text-muted-foreground">— nenhuma —</span>}
                </div>

                <h3 className="text-sm font-semibold mt-4 mb-2 flex items-center gap-2"><Tag className="h-4 w-4" /> Palavras-chave negativas</h3>
                <div className="flex flex-wrap gap-1.5">
                  {detail.kws.filter((k) => k.tipo === "negativa").map((k) => <Badge key={k.id} variant="outline" className="border-destructive/40 text-destructive">{k.termo}</Badge>)}
                  {detail.kws.filter((k) => k.tipo === "negativa").length === 0 && <span className="text-xs text-muted-foreground">— nenhuma —</span>}
                </div>

                {detail.art.observacoes && (
                  <>
                    <h3 className="text-sm font-semibold mt-4 mb-2">Observações</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detail.art.observacoes}</p>
                  </>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
