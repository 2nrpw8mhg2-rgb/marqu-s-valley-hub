import { createFileRoute } from "@tanstack/react-router";
import { ObraLayout } from "@/components/obras/ObraLayout";

export const Route = createFileRoute("/_app/obras/$id")({
  head: () => ({ meta: [{ title: "Obra — MV OS" }] }),
  component: ObraRoute,
});

function ObraRoute() {
  const { id } = Route.useParams();
  return <ObraLayout obraId={id} />;
}
