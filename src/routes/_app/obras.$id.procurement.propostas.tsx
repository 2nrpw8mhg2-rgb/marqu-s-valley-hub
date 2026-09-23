import { createFileRoute } from "@tanstack/react-router";
import { EstadoVazio } from "@/components/procurement/ui";
import { FileSignature } from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/procurement/propostas")({
  head: () => ({
    meta: [
      { title: "Propostas Recebidas · Procurement · MV OC" },
      { name: "description", content: "Propostas recebidas dos subempreiteiros consultados nesta obra." },
      { property: "og:title", content: "Propostas Recebidas · Procurement · MV OC" },
      { property: "og:description", content: "Registo das propostas recebidas por pacote de consulta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Propostas,
});

function Propostas() {
  return (
    <div className="p-4 sm:p-6">
      <EstadoVazio
        titulo="Ainda não existem propostas recebidas"
        descricao="As propostas aparecem aqui depois de existirem consultas enviadas e respostas dos subempreiteiros. Esta fase ainda não está disponível."
        icone={<FileSignature className="h-8 w-8" />}
      />
    </div>
  );
}
