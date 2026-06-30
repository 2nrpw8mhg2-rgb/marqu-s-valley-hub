import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/obras/$id/mq")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/obras/$id/preparacao-orcamento", params: { id: params.id } });
  },
});
