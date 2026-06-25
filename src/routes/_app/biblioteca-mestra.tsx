import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/biblioteca-mestra")({
  head: () => ({ meta: [{ title: "Biblioteca Mestra — MV OS" }] }),
  component: () => <Outlet />,
});
