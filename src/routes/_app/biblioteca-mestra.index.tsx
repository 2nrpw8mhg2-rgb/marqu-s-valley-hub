import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, Search, FolderTree, FileText, Tag, Library } from "lucide-react";
import type { Especialidade, Subespecialidade, ArtigoMestre, ArtigoKeyword } from "@/lib/biblioteca-mestra/types";

export const Route = createFileRoute("/_app/biblioteca-mestra/")({
  head: () => ({ meta: [{ title: "Biblioteca Mestra — Explorador — MV OS" }] }),
  component: ExploradorPage,
});

function ExploradorPage() {
  const [search, setSearch] = useState("");
  const [openEsp, setOpenEsp] = useState<Record<string, boolean>>({});
  const [openSub, setOpenSub] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<
    | { kind: "esp"; id: string }
    | { kind: "sub"; id: string }
    | { kind: "art"; id: string }
    | null
  >(null);

  const { data: especialidades = [] } = useQuery({
    queryKey: ["bm-esp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_especialidades")
        .select("*")
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return data as Especialidade[];
    },
  });

  const { data: subespecialidades = [] } = useQuery({
    queryKey: ["bm-sub"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_subespecialidades")
        .select("*")
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return data as Subespecialidade[];
    },
  });

  const { data: artigos = [] } = useQuery({
    queryKey: ["bm-art"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_artigos")
        .select("*")
        .order("descricao");
      if (error) throw error;
      return data as ArtigoMestre[];
    },
  });

  const { data: keywords = [] } = useQuery({
    queryKey: ["bm-kw"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_artigo_keywords")
        .select("*");
      if (error) throw error;
      return data as ArtigoKeyword[];
    },
  });

  const subsByEsp = useMemo(() => {
    const m = new Map<string, Subespecialidade[]>();
    for (const s of subespecialidades) {
      if (!m.has(s.especialidade_id)) m.set(s.especialidade_id, []);
      m.get(s.especialidade_id)!.push(s);
    }
    return m;
  }, [subespecialidades]);

  const artsBySub = useMemo(() => {
    const m = new Map<string, ArtigoMestre[]>();
    for (const a of artigos) {
      if (!m.has(a.subespecialidade_id)) m.set(a.subespecialidade_id, []);
      m.get(a.subespecialidade_id)!.push(a);
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
    const artIds = new Set<string>();
    for (const e of especialidades) {
      if (
        e.nome.toLowerCase().includes(term) ||
        (e.codigo ?? "").toLowerCase().includes(term) ||
        (e.descricao ?? "").toLowerCase().includes(term)
      ) espIds.add(e.id);
    }
    for (const s of subespecialidades) {
      if (
        s.nome.toLowerCase().includes(term) ||
        (s.codigo ?? "").toLowerCase().includes(term) ||
        (s.descricao ?? "").toLowerCase().includes(term)
      ) {
        subIds.add(s.id);
        espIds.add(s.especialidade_id);
      }
    }
    for (const a of artigos) {
      const kws = kwsByArt.get(a.id) ?? [];
      const inKw = kws.some((k) => k.termo.toLowerCase().includes(term));
      if (
        a.descricao.toLowerCase().includes(term) ||
        (a.codigo ?? "").toLowerCase().includes(term) ||
        (a.observacoes ?? "").toLowerCase().includes(term) ||
        inKw
      ) {
        artIds.add(a.id);
        const sub = subespecialidades.find((s) => s.id === a.subespecialidade_id);
        if (sub) {
          subIds.add(sub.id);
          espIds.add(sub.especialidade_id);
        }
      }
    }
    return { espIds, subIds, artIds };
  }, [term, especialidades, subespecialidades, artigos, kwsByArt]);

  // detail panel data
  const detail = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "esp") {
      const e = especialidades.find((x) => x.id === selected.id);
      if (!e) return null;
      const subs = subsByEsp.get(e.id) ?? [];
      return { type: "esp" as const, esp: e, subs };
    }
    if (selected.kind === "sub") {
      const s = subespecialidades.find((x) => x.id === selected.id);
      if (!s) return null;
      const arts = artsBySub.get(s.id) ?? [];
      const e = especialidades.find((x) => x.id === s.especialidade_id);
      return { type: "sub" as const, sub: s, arts, esp: e };
    }
    const a = artigos.find((x) => x.id === selected.id);
    if (!a) return null;
    const s = subespecialidades.find((x) => x.id === a.subespecialidade_id);
    const e = s ? especialidades.find((x) => x.id === s.especialidade_id) : undefined;
    return { type: "art" as const, art: a, kws: kwsByArt.get(a.id) ?? [], sub: s, esp: e };
  }, [selected, especialidades, subespecialidades, artigos, subsByEsp, artsBySub, kwsByArt]);

  return (
    <>
      <PageHeader
        title="Biblioteca Mestra"
        subtitle="Núcleo de conhecimento técnico — Especialidades, Subespecialidades e Artigos Mestre"
      />

      <div className="p-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, código, descrição ou palavra-chave..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          {/* Árvore */}
          <Card className="bg-card border-border p-2 max-h-[70vh] overflow-y-auto">
            {especialidades.length === 0 && (
              <div className="text-sm text-muted-foreground p-6 text-center">
                <Library className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Sem especialidades. Cria a primeira em <span className="font-medium">Especialidades</span>.
              </div>
            )}
            <ul className="text-sm">
              {especialidades
                .filter((e) => !matches || matches.espIds.has(e.id))
                .map((e) => {
                  const isOpen = matches ? true : !!openEsp[e.id];
                  const subs = (subsByEsp.get(e.id) ?? []).filter(
                    (s) => !matches || matches.subIds.has(s.id)
                  );
                  return (
                    <li key={e.id}>
                      <button
                        onClick={() => {
                          setOpenEsp((o) => ({ ...o, [e.id]: !o[e.id] }));
                          setSelected({ kind: "esp", id: e.id });
                        }}
                        className={`w-full flex items-center gap-1 rounded px-2 py-1.5 hover:bg-muted/50 ${
                          selected?.kind === "esp" && selected.id === e.id ? "bg-muted" : ""
                        }`}
                      >
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <FolderTree className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">{e.nome}</span>
                        {!e.ativa && <Badge variant="outline" className="text-[10px] ml-1">inativa</Badge>}
                      </button>
                      {isOpen && (
                        <ul className="ml-5 border-l border-border/60">
                          {subs.length === 0 && (
                            <li className="text-xs text-muted-foreground px-2 py-1">— sem subespecialidades —</li>
                          )}
                          {subs.map((s) => {
                            const isSubOpen = matches ? true : !!openSub[s.id];
                            const arts = (artsBySub.get(s.id) ?? []).filter(
                              (a) => !matches || matches.artIds.has(a.id)
                            );
                            return (
                              <li key={s.id}>
                                <button
                                  onClick={() => {
                                    setOpenSub((o) => ({ ...o, [s.id]: !o[s.id] }));
                                    setSelected({ kind: "sub", id: s.id });
                                  }}
                                  className={`w-full flex items-center gap-1 rounded px-2 py-1 hover:bg-muted/50 ${
                                    selected?.kind === "sub" && selected.id === s.id ? "bg-muted" : ""
                                  }`}
                                >
                                  {isSubOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  <FolderTree className="h-3 w-3 text-muted-foreground" />
                                  <span>{s.nome}</span>
                                  <span className="ml-auto text-[10px] text-muted-foreground">
                                    {(artsBySub.get(s.id) ?? []).length}
                                  </span>
                                </button>
                                {isSubOpen && (
                                  <ul className="ml-5 border-l border-border/60">
                                    {arts.length === 0 && (
                                      <li className="text-xs text-muted-foreground px-2 py-1">— sem artigos —</li>
                                    )}
                                    {arts.map((a) => (
                                      <li key={a.id}>
                                        <button
                                          onClick={() => setSelected({ kind: "art", id: a.id })}
                                          className={`w-full flex items-center gap-1 rounded px-2 py-1 hover:bg-muted/50 text-left ${
                                            selected?.kind === "art" && selected.id === a.id ? "bg-muted" : ""
                                          }`}
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
          </Card>

          {/* Detalhe */}
          <Card className="bg-card border-border p-6 min-h-[300px]">
            {!detail && (
              <div className="text-sm text-muted-foreground text-center py-16">
                Selecciona uma especialidade, subespecialidade ou artigo para ver os detalhes.
              </div>
            )}

            {detail?.type === "esp" && (
              <div>
                <h2 className="text-xl font-semibold">{detail.esp.nome}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Código: <span className="font-mono">{detail.esp.codigo ?? "—"}</span> · Ordem: {detail.esp.ordem}
                </p>
                {detail.esp.descricao && <p className="text-sm mt-3">{detail.esp.descricao}</p>}
                <h3 className="text-sm font-semibold mt-6 mb-2">Subespecialidades ({detail.subs.length})</h3>
                <ul className="divide-y divide-border/60">
                  {detail.subs.map((s) => (
                    <li key={s.id} className="py-2 flex justify-between text-sm">
                      <button onClick={() => setSelected({ kind: "sub", id: s.id })} className="hover:underline">
                        {s.nome}
                      </button>
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
                <p className="text-xs text-muted-foreground mt-1">
                  Código: <span className="font-mono">{detail.sub.codigo ?? "—"}</span>
                </p>
                {detail.sub.descricao && <p className="text-sm mt-3">{detail.sub.descricao}</p>}
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
                  {detail.esp?.nome} / {detail.sub?.nome}
                </p>
                <h2 className="text-xl font-semibold mt-1">{detail.art.descricao}</h2>
                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                  <span>Código: <span className="font-mono">{detail.art.codigo ?? "—"}</span></span>
                  <span>Unidade: <span className="font-mono">{detail.art.unidade ?? "—"}</span></span>
                  <span>{detail.art.ativo ? "Ativo" : "Inativo"}</span>
                </div>

                <h3 className="text-sm font-semibold mt-6 mb-2 flex items-center gap-2"><Tag className="h-4 w-4" /> Palavras-chave positivas</h3>
                <div className="flex flex-wrap gap-1.5">
                  {detail.kws.filter((k) => k.tipo === "positiva").map((k) => (
                    <Badge key={k.id} variant="secondary">{k.termo}</Badge>
                  ))}
                  {detail.kws.filter((k) => k.tipo === "positiva").length === 0 && (
                    <span className="text-xs text-muted-foreground">— nenhuma —</span>
                  )}
                </div>

                <h3 className="text-sm font-semibold mt-4 mb-2 flex items-center gap-2"><Tag className="h-4 w-4" /> Palavras-chave negativas</h3>
                <div className="flex flex-wrap gap-1.5">
                  {detail.kws.filter((k) => k.tipo === "negativa").map((k) => (
                    <Badge key={k.id} variant="outline" className="border-destructive/40 text-destructive">{k.termo}</Badge>
                  ))}
                  {detail.kws.filter((k) => k.tipo === "negativa").length === 0 && (
                    <span className="text-xs text-muted-foreground">— nenhuma —</span>
                  )}
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
