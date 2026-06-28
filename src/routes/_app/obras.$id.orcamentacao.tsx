import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calculator, ArrowRight } from "lucide-react";
import { fmtEUR, lineTotal } from "@/lib/orcamento-utils";

export const Route = createFileRoute("/_app/obras/$id/orcamentacao")({
  component: OrcamentacaoTab,
});

function OrcamentacaoTab() {
  const { id } = Route.useParams();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["obra-orcs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*, artigos:orcamento_artigos(quantidade, preco_unitario, margem_pct)")
        .eq("obra_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">A carregar…</div>;

  if (!rows.length) {
    return (
      <div className="p-6">
        <Card className="bg-card border-border p-10 text-center space-y-3">
          <Calculator className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Sem orçamentos. Importa um Mapa de Quantidades para começar.
          </p>
          <Link to="/obras/$id/mq" params={{ id }}>
            <Button variant="outline" size="sm">Ir para Mapa de Quantidades</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card className="bg-card border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Versão</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((o: any) => {
              const sub = (o.artigos ?? []).reduce((acc: number, a: any) => acc + lineTotal({
                quantidade: Number(a.quantidade), preco_unitario: Number(a.preco_unitario), margem_pct: Number(a.margem_pct),
              }), 0);
              const total = sub * (1 + Number(o.margem_global_pct || 0) / 100);
              return (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.nome}</TableCell>
                  <TableCell className="font-mono text-xs">{o.versao_label}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.estado}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{fmtEUR(total)}</TableCell>
                  <TableCell className="text-right">
                    <Link to="/orcamentos/$id" params={{ id: o.id }}>
                      <Button size="sm" variant="ghost"><ArrowRight className="h-4 w-4" /></Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
