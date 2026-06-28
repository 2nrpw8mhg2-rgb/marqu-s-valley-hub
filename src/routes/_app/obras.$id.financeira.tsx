import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/obras/ComingSoon";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/financeira")({
  component: () => <ComingSoon icon={Wallet} title="Gestão Financeira" />,
});
