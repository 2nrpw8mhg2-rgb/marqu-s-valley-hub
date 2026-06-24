import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/procurement/pacotes")({
  component: () => <Outlet />,
});