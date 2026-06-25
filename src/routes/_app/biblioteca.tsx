import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/biblioteca")({
  beforeLoad: () => {
    throw redirect({ to: "/biblioteca-mestra/artigos" });
  },
});
