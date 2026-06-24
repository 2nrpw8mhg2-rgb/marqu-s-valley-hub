import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, BookMarked } from "lucide-react";
import { fmtEUR } from "@/lib/orcamento-utils";

export const Route = createFileRoute("/_app/biblioteca")({
  head: () => ({ meta: [{ title: "Biblioteca de Artigos — MV OS" }] }),
  component: BibliotecaPage,
});

function BibliotecaPage() {
  const [search, setSearch] = useState("");

  const { data: artigos = [], isLoading } = useQuery({
    queryKey: ["biblioteca"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artigos_biblioteca")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const filtered = artigos.filter((a) =>
    [a.codigo, a.descricao, a.especialidade, a.unidade]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <PageHeader
        title="Biblioteca de Artigos"
        subtitle="Histórico de artigos e preços de referência — alimentado pelos orçamentos guardados"
      />

      <div className="p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card className="bg-card border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="w-28">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead className="w-20">Un.</TableHead>
                <TableHead className="text-right w-32">Preço ref.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">A carregar...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <BookMarked className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">A biblioteca está vazia. Guarda um orçamento para alimentá-la.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((a) => (
                  <TableRow key={a.id} className="border-border">
                    <TableCell className="font-mono text-xs">{a.codigo || "—"}</TableCell>
                    <TableCell className="font-medium">{a.descricao}</TableCell>
                    <TableCell className="text-muted-foreground">{a.especialidade || "—"}</TableCell>
                    <TableCell>{a.unidade || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.preco_referencia != null ? fmtEUR(Number(a.preco_referencia)) : "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
