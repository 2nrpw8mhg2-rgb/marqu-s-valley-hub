import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/procurement/ui";
import { Send } from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/procurement/consultas")({
  head: () => ({
    meta: [
      { title: "Consultas Enviadas · Procurement · MV OC" },
      { name: "description", content: "Registo das consultas enviadas a subempreiteiros nesta obra." },
      { property: "og:title", content: "Consultas Enviadas · Procurement · MV OC" },
      { property: "og:description", content: "Histórico de pedidos de cotação enviados por pacote." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Consultas,
});

function Consultas() {
  const { id } = Route.useParams();
  return (
    <div className="p-4 sm:p-6">
      <EstadoVazio
        titulo="Ainda não existem consultas enviadas"
        descricao="O envio de pedidos de cotação será disponibilizado numa fase seguinte. Até lá, prepare os pacotes: mapa, âmbito, documentação e empresas."
        icone={<Send className="h-8 w-8" />}
        accao={
          <Link to="/obras/$id/procurement/pacotes" params={{ id }}>
            <Button variant="outline" size="sm" className="mt-2">Ir para Pacotes de Consulta</Button>
          </Link>
        }
      />
    </div>
  );
}
