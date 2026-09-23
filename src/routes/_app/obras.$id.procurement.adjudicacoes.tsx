import { createFileRoute } from "@tanstack/react-router";
import { EstadoVazio } from "@/components/procurement/ui";
import { Gavel } from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/procurement/adjudicacoes")({
  head: () => ({
    meta: [
      { title: "Adjudicações · Procurement · MV OC" },
      { name: "description", content: "Adjudicações de subempreitadas desta obra." },
      { property: "og:title", content: "Adjudicações · Procurement · MV OC" },
      { property: "og:description", content: "Registo das adjudicações por pacote de consulta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Adjudicacoes,
});

function Adjudicacoes() {
  return (
    <div className="p-4 sm:p-6">
      <EstadoVazio
        titulo="Ainda não há adjudicações"
        descricao="A adjudicação depende da comparação de propostas e será disponibilizada numa fase seguinte."
        icone={<Gavel className="h-8 w-8" />}
      />
    </div>
  );
}
