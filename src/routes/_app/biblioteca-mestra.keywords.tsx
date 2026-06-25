import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import type { ArtigoMestre, ArtigoKeyword, Subespecialidade, Especialidade } from "@/lib/biblioteca-mestra/types";

export const Route = createFileRoute("/_app/biblioteca-mestra/keywords")({
  head: () => ({ meta: [{ title: "Palavras-chave — Biblioteca Mestra — MV OS" }] }),
  component: KeywordsPage,
});

function KeywordsPage() {
  const [search, setSearch] = useState("");

  const { data: kws = [] } = useQuery({
    queryKey: ["bm-kw"],
    queryFn: async () => (await supabase.from("biblioteca_artigo_keywords").select("*").order("termo")).data as ArtigoKeyword[],
  });
  const { data: arts = [] } = useQuery({
    queryKey: ["bm-art"],
    queryFn: async () => (await supabase.from("biblioteca_artigos").select("*")).data as ArtigoMestre[],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["bm-sub"],
    queryFn: async () => (await supabase.from("biblioteca_subespecialidades").select("*")).data as Subespecialidade[],
  });
  const { data: esps = [] } = useQuery({
    queryKey: ["bm-esp"],
    queryFn: async () => (await supabase.from("biblioteca_especialidades").select("*")).data as Especialidade[],
  });

  const artMap = useMemo(() => new Map(arts.map((a) => [a.id, a])), [arts]);
  const subMap = useMemo(() => new Map(subs.map((s) => [s.id, s])), [subs]);
  const espMap = useMemo(() => new Map(esps.map((e) => [e.id, e])), [esps]);

  const filtered = kws.filter((k) => {
    if (!search.trim()) return true;
    const t = search.toLowerCase();
    const a = artMap.get(k.artigo_id);
    return k.termo.toLowerCase().includes(t) || (a?.descricao ?? "").toLowerCase().includes(t);
  });

  return (
    <>
      <PageHeader title="Palavras-chave" subtitle="Vista global de todas as palavras-chave do conhecimento técnico" />
      <div className="p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar termo ou artigo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Termo</TableHead>
                <TableHead className="w-24">Tipo</TableHead>
                <TableHead>Artigo</TableHead>
                <TableHead>Especialidade / Subespecialidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Sem palavras-chave</TableCell></TableRow>}
              {filtered.map((k) => {
                const a = artMap.get(k.artigo_id);
                const s = a ? subMap.get(a.subespecialidade_id) : null;
                const e = s ? espMap.get(s.especialidade_id) : null;
                return (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.termo}</TableCell>
                    <TableCell>
                      {k.tipo === "positiva"
                        ? <Badge variant="secondary">+ positiva</Badge>
                        : <Badge variant="outline" className="border-destructive/40 text-destructive">− negativa</Badge>}
                    </TableCell>
                    <TableCell>{a?.descricao ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e?.nome ?? "—"} / {s?.nome ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
