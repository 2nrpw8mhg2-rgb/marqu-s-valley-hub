import { createFileRoute } from "@tanstack/react-router";
import { EstadoVazio } from "@/components/procurement/ui";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/procurement/comparacao")({
  head: () => ({
    meta: [
      { title: "Comparação de Propostas · Procurement · MV OC" },
      { name: "description", content: "Comparação lado a lado das propostas recebidas por pacote." },
      { property: "og:title", content: "Comparação de Propostas · Procurement · MV OC" },
      { property: "og:description", content: "Mapa comparativo das propostas de cada subempreitada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Comparacao,
});

function Comparacao() {
  return (
    <div className="p-4 sm:p-6">
      <EstadoVazio
        titulo="Sem propostas para comparar"
        descricao="A comparação ficará disponível quando existirem propostas recebidas. Nada é simulado nesta fase."
        icone={<BarChart3 className="h-8 w-8" />}
      />
    </div>
  );
}
