import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BREADCRUMBS_BIBLIOTECA, ROTA_BIBLIOTECA } from "@/lib/navegacao/menu";

export const Route = createFileRoute("/_app/administracao/configuracao-ia/biblioteca-subempreitadas")({
  head: () => ({ meta: [{ title: "Biblioteca de Subempreitadas — MV OS" }] }),
  component: BibliotecaLayout,
});

const SUB_PAGINAS = [
  { to: ROTA_BIBLIOTECA, label: "Explorador", exact: true },
  { to: `${ROTA_BIBLIOTECA}/especialidades`, label: "Especialidades" },
  { to: `${ROTA_BIBLIOTECA}/subespecialidades`, label: "Subespecialidades" },
  { to: `${ROTA_BIBLIOTECA}/subempreitadas`, label: "Subempreitadas" },
  { to: `${ROTA_BIBLIOTECA}/categorias`, label: "Categorias" },
  { to: `${ROTA_BIBLIOTECA}/artigos`, label: "Pesquisa de Artigos" },
  { to: `${ROTA_BIBLIOTECA}/keywords`, label: "Palavras-chave" },
  { to: `${ROTA_BIBLIOTECA}/sistemas`, label: "Sistemas Construtivos" },
  { to: `${ROTA_BIBLIOTECA}/unidades`, label: "Unidades" },
  { to: `${ROTA_BIBLIOTECA}/templates`, label: "Templates de Obra" },
  { to: `${ROTA_BIBLIOTECA}/knowledge-builder`, label: "Knowledge Builder" },
];

function BibliotecaLayout() {
  return (
    <>
      <Breadcrumbs items={BREADCRUMBS_BIBLIOTECA} />
      <nav
        aria-label="Secções da Biblioteca de Subempreitadas"
        className="flex gap-1 overflow-x-auto border-b border-border px-6 pt-3"
      >
        {SUB_PAGINAS.map((p) => (
          <Link
            key={p.to}
            to={p.to}
            activeOptions={{ exact: p.exact ?? false }}
            className="whitespace-nowrap rounded-t-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground border-b-2 border-primary font-medium" }}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
