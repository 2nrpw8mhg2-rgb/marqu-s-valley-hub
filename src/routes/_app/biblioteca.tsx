import { createFileRoute, redirect } from "@tanstack/react-router";
import { ROTA_BIBLIOTECA } from "@/lib/navegacao/menu";

export const Route = createFileRoute("/_app/biblioteca")({
  beforeLoad: () => {
    throw redirect({ to: `${ROTA_BIBLIOTECA}/artigos`, replace: true });
  },
});
