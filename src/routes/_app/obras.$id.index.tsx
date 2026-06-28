import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ListChecks, Calculator, ShoppingCart, FileText, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/")({
  component: ObraResumo,
});

function ObraResumo() {
  const { id } = Route.useParams();

  const { data: stats } = useQuery({
    queryKey: ["obra-resumo", id],
    queryFn: async () => {
      const [{ data: orcs }, { count: docs }] = await Promise.all([
        supabase
          .from("orcamentos")
          .select("id, nome, estado_mq, versao_label, created_at")
          .eq("obra_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("documentos").select("id", { count: "exact", head: true }).eq("obra_id", id),
      ]);
      const orcId = (orcs ?? [])[0]?.id;
      let artigosCount = 0;
      let classificados = 0;
      if (orcId) {
        const { count: at } = await supabase
          .from("orcamento_artigos")
          .select("id", { count: "exact", head: true })
          .eq("orcamento_id", orcId);
        artigosCount = at ?? 0;
        const { count: cls } = await supabase
          .from("classificacao_artigos")
          .select("id", { count: "exact", head: true })
          .eq("orcamento_id", orcId)
          .in("estado", ["classificado_auto", "validado"]);
        classificados = cls ?? 0;
      }
      return { orcs: orcs ?? [], docs: docs ?? 0, artigosCount, classificados };
    },
  });

  const tiles = [
    {
      to: `/obras/${id}/mq` as const,
      icon: ListChecks,
      title: "Mapa de Quantidades",
      desc: stats?.artigosCount
        ? `${stats.classificados}/${stats.artigosCount} artigos classificados`
        : "Sem MQ importado",
    },
    {
      to: `/obras/${id}/documentos` as const,
      icon: FileText,
      title: "Documentos",
      desc: `${stats?.docs ?? 0} ficheiros`,
    },
    {
      to: `/obras/${id}/orcamentacao` as const,
      icon: Calculator,
      title: "Orçamentação",
      desc: `${stats?.orcs.length ?? 0} versões`,
    },
    {
      to: `/obras/${id}/procurement` as const,
      icon: ShoppingCart,
      title: "Procurement",
      desc: "Pacotes de consulta",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to}>
            <Card className="bg-card border-border p-4 hover:border-primary/40 transition-colors h-full">
              <div className="flex items-start justify-between">
                <t.icon className="h-5 w-5 text-primary" />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="mt-3 font-medium">{t.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
            </Card>
          </Link>
        ))}
      </div>

      {stats?.orcs.length ? (
        <Card className="bg-card border-border p-4">
          <h3 className="font-medium mb-3">Mapas de Quantidades</h3>
          <ul className="divide-y divide-border text-sm">
            {stats.orcs.map((o: any) => (
              <li key={o.id} className="py-2 flex items-center justify-between">
                <div>
                  <Link
                    to="/obras/$id/mq"
                    params={{ id }}
                    className="font-medium hover:text-primary"
                  >
                    {o.nome}
                  </Link>
                  <span className="ml-2 text-xs font-mono text-muted-foreground">{o.versao_label}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-border text-muted-foreground">
                  {String(o.estado_mq).replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
