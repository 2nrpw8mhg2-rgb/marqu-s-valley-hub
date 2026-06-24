import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { HardHat, FileText, Users, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — MV OS" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [obras, docs, subs, obrasEmCurso] = await Promise.all([
        supabase.from("obras").select("id", { count: "exact", head: true }),
        supabase.from("documentos").select("id", { count: "exact", head: true }),
        supabase.from("subempreiteiros").select("id", { count: "exact", head: true }),
        supabase.from("obras").select("id", { count: "exact", head: true }).eq("estado", "em_curso"),
      ]);
      return {
        obras: obras.count ?? 0,
        docs: docs.count ?? 0,
        subs: subs.count ?? 0,
        emCurso: obrasEmCurso.count ?? 0,
      };
    },
  });

  const { data: ultimasObras } = useQuery({
    queryKey: ["ultimas-obras"],
    queryFn: async () => {
      const { data } = await supabase
        .from("obras")
        .select("id, nome, cliente, estado, valor_estimado, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const cards = [
    { label: "Obras totais", value: stats?.obras ?? 0, icon: HardHat, color: "text-primary" },
    { label: "Em curso", value: stats?.emCurso ?? 0, icon: TrendingUp, color: "text-[color:var(--color-success)]" },
    { label: "Documentos", value: stats?.docs ?? 0, icon: FileText, color: "text-chart-3" },
    { label: "Subempreiteiros", value: stats?.subs ?? 0, icon: Users, color: "text-chart-5" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Visão geral da operação Marquês Valley" />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label} className="p-5 bg-card border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <p className="mt-3 text-3xl font-semibold">{c.value}</p>
            </Card>
          ))}
        </div>

        <Card className="bg-card border-border">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Últimas obras</h2>
            <Link to="/obras" className="text-xs text-primary hover:underline">Ver todas →</Link>
          </div>
          <div className="divide-y divide-border">
            {ultimasObras && ultimasObras.length > 0 ? (
              ultimasObras.map((o) => (
                <div key={o.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{o.nome}</p>
                    <p className="text-xs text-muted-foreground">{o.cliente || "Sem cliente"}</p>
                  </div>
                  <EstadoBadge estado={o.estado} />
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                Sem obras registadas. <Link to="/obras" className="text-primary hover:underline">Criar a primeira</Link>
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    oportunidade: { label: "Oportunidade", cls: "bg-chart-3/15 text-chart-3 border-chart-3/30" },
    em_curso: { label: "Em curso", cls: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] border-[color:var(--color-success)]/30" },
    concluida: { label: "Concluída", cls: "bg-muted text-muted-foreground border-border" },
    cancelada: { label: "Cancelada", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  const v = map[estado] ?? map.oportunidade;
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${v.cls}`}>{v.label}</span>
  );
}
