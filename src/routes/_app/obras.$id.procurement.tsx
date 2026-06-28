import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/procurement")({
  component: ProcurementTab,
});

function ProcurementTab() {
  return (
    <div className="p-6">
      <Card className="bg-card border-border p-10 text-center space-y-3">
        <ShoppingCart className="h-10 w-10 mx-auto text-primary" />
        <h2 className="font-semibold">Procurement</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Os pacotes de consulta vivem no módulo global de Procurement e podem ser gerados a partir do MQ classificado.
        </p>
        <Link to="/procurement/pacotes">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-1" /> Abrir Pacotes de Consulta
          </Button>
        </Link>
      </Card>
    </div>
  );
}
