import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Layers, ArrowRight } from "lucide-react";
import { fmtEUR } from "@/lib/orcamento-utils";

export const Route = createFileRoute("/_app/orcamentos/decomposicao")({
  head: () => ({ meta: [{ title: "Decomposição de Preços — MV OS" }] }),
  component: DecomposicaoListPage,
});

function DecomposicaoListPage() {
  const [search, setSearch] = useState("");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["orcamentos-decomposicao-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id, nome, versao, estado, obra:obras(nome, codigo, cliente)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = rows.filter((r: any) => {
    const q = search.toLowerCase();
    return !q
      || r.nome?.toLowerCase().includes(q)
      || r.obra?.nome?.toLowerCase().includes(q)
      || r.obra?.codigo?.toLowerCase().includes(q);
  });

  return (
    <>
      <PageHeader
        title="Decomposição de Preços"
        subtitle="Seleciona um orçamento para construir a folha de custo interna"
      />
      <div className="p-6 space-y-4">
        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por orçamento, obra ou código..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </Card>

        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">A carregar...</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Layers className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Sem orçamentos disponíveis. Cria um orçamento primeiro em <Link to="/orcamentos" className="text-primary underline">Orçamentos</Link>.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((o: any) => (
              <Link
                key={o.id}
                to="/orcamentos/$id/decomposicao"
                params={{ id: o.id }}
                className="block"
              >
                <Card className="p-4 hover:border-primary transition-colors h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {o.obra?.codigo} · {o.obra?.cliente ?? "—"}
                      </div>
                      <h3 className="font-semibold truncate">{o.nome}</h3>
                      <div className="text-xs text-muted-foreground truncate">{o.obra?.nome}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">v{o.versao} · {o.estado}</span>
                    <span className="font-semibold tabular-nums">{fmtEUR(Number(o.valor_total) || 0)}</span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-3">
                    <Layers className="h-3.5 w-3.5 mr-1" /> Abrir decomposição
                  </Button>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
