import { createFileRoute, redirect } from "@tanstack/react-router";
import { redirecionamentoBiblioteca } from "@/lib/navegacao/menu";

/** Compatibilidade: sub-rotas antigas da Biblioteca Mestra (favoritos/links). */
export const Route = createFileRoute("/_app/biblioteca-mestra/$")({
  beforeLoad: ({ params }) => {
    const destino = redirecionamentoBiblioteca(`/biblioteca-mestra/${params._splat ?? ""}`);
    throw redirect({ to: destino, replace: true });
  },
});
