import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { usePodeAdministrar } from "@/hooks/usePermissoes";

export const Route = createFileRoute("/_app/administracao")({
  head: () => ({ meta: [{ title: "Administração — MV OS" }] }),
  component: AdministracaoLayout,
});

function AdministracaoLayout() {
  const { podeAdministrar, carregando } = usePodeAdministrar();

  if (carregando) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!podeAdministrar) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          A área de Administração está reservada a perfis com permissões de configuração.
          Contacte um administrador se precisar de acesso.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
