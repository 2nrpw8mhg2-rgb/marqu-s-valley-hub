import { createFileRoute, Link } from "@tanstack/react-router";
import { Library } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Card } from "@/components/ui/card";
import {
  DESCRICAO_BIBLIOTECA,
  DESCRICAO_CONFIGURACAO_IA,
  ROTA_ADMINISTRACAO,
  ROTA_BIBLIOTECA,
} from "@/lib/navegacao/menu";

export const Route = createFileRoute("/_app/administracao/configuracao-ia/")({
  head: () => ({ meta: [{ title: "Configuração da IA — Administração — MV OS" }] }),
  component: ConfiguracaoIaIndex,
});

function ConfiguracaoIaIndex() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Administração", to: ROTA_ADMINISTRACAO },
          { label: "Configuração da IA" },
        ]}
      />
      <PageHeader title="Configuração da IA" subtitle={DESCRICAO_CONFIGURACAO_IA} />
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link to={ROTA_BIBLIOTECA} className="block">
          <Card className="h-full border-border bg-card p-5 transition-colors hover:border-primary/50">
            <div className="mb-2 flex items-center gap-2">
              <Library className="h-4 w-4 text-primary" />
              <h2 className="font-medium">Biblioteca de Subempreitadas</h2>
            </div>
            <p className="text-sm text-muted-foreground">{DESCRICAO_BIBLIOTECA}</p>
          </Card>
        </Link>
      </div>
    </>
  );
}
