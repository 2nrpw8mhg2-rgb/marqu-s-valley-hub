import { createFileRoute, redirect } from "@tanstack/react-router";
import { ROTA_BIBLIOTECA } from "@/lib/navegacao/menu";

/** Compatibilidade: rota antiga da Biblioteca Mestra. */
export const Route = createFileRoute("/_app/biblioteca-mestra/")({
  beforeLoad: () => {
    throw redirect({ to: ROTA_BIBLIOTECA, replace: true });
  },
});
