import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Card } from "@/components/ui/card";
import { DESCRICAO_CONFIGURACAO_IA, ROTA_CONFIGURACAO_IA } from "@/lib/navegacao/menu";

export const Route = createFileRoute("/_app/administracao/")({
  head: () => ({ meta: [{ title: "Administração — MV OS" }] }),
  component: AdministracaoIndex,
});

function AdministracaoIndex() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Administração" }]} />
      <PageHeader title="Administração" subtitle="Configurações avançadas da plataforma" />
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link to={ROTA_CONFIGURACAO_IA} className="block">
          <Card className="h-full border-border bg-card p-5 transition-colors hover:border-primary/50">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-medium">Configuração da IA</h2>
            </div>
            <p className="text-sm text-muted-foreground">{DESCRICAO_CONFIGURACAO_IA}</p>
          </Card>
        </Link>
      </div>
    </>
  );
}
