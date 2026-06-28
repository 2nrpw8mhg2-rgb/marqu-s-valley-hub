import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/obras/ComingSoon";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/planeamento")({
  component: () => <ComingSoon icon={CalendarDays} title="Planeamento" />,
});
