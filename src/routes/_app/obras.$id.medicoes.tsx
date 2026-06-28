import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/obras/ComingSoon";
import { Ruler } from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/medicoes")({
  component: () => <ComingSoon icon={Ruler} title="Medições" />,
});
