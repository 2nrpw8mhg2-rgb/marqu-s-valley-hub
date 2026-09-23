import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/administracao/configuracao-ia/biblioteca-subempreitadas")({
  head: () => ({ meta: [{ title: "Biblioteca Mestra — MV OS" }] }),
  component: () => <Outlet />,
});
