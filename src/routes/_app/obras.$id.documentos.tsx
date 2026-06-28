import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/documentos")({
  component: DocsTab,
});

function DocsTab() {
  return (
    <div className="p-6">
      <Card className="bg-card border-border p-10 text-center space-y-3">
        <FileText className="h-10 w-10 mx-auto text-primary" />
        <h2 className="font-semibold">Gestão Documental</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          A vista de documentos por obra está disponível na Gestão Documental geral.
        </p>
        <Link to="/documentos">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-1" /> Abrir Gestão Documental
          </Button>
        </Link>
      </Card>
    </div>
  );
}
