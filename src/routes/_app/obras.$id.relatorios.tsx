import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/obras/ComingSoon";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/relatorios")({
  component: () => <ComingSoon icon={BarChart3} title="Relatórios" />,
});
