import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/administracao/configuracao-ia/biblioteca-subempreitadas")({
  head: () => ({ meta: [{ title: "Biblioteca de Subempreitadas — MV OS" }] }),
  component: () => <Outlet />,
});
