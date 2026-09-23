import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardList,
  FileSignature,
  Gavel,
  LayoutDashboard,
  Send,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/procurement")({
  component: ProcurementLayout,
});

const VISTAS = [
  { to: "", label: "Visão Geral", icon: LayoutDashboard },
  { to: "/pacotes", label: "Pacotes de Consulta", icon: ClipboardList },
  { to: "/fornecedores", label: "Fornecedores e Subempreiteiros", icon: Users },
  { to: "/consultas", label: "Consultas Enviadas", icon: Send },
  { to: "/propostas", label: "Propostas Recebidas", icon: FileSignature },
  { to: "/comparacao", label: "Comparação de Propostas", icon: BarChart3 },
  { to: "/adjudicacoes", label: "Adjudicações", icon: Gavel },
];

function ProcurementLayout() {
  const { id } = Route.useParams();
  const { pathname } = useLocation();
  const base = `/obras/${id}/procurement`;
  const sub = pathname.startsWith(base) ? pathname.slice(base.length) : "";

  return (
    <div>
      <nav className="overflow-x-auto border-b border-border bg-card/40 px-3 sm:px-6" aria-label="Secções de Procurement">
        <ul className="flex min-w-max gap-1 py-2">
          {VISTAS.map((v) => {
            const activa = v.to === "" ? sub === "" || sub === "/" : sub === v.to || sub.startsWith(v.to + "/");
            const Icone = v.icon;
            return (
              <li key={v.to}>
                <Link
                  to={base + v.to}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    activa ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icone className="h-3.5 w-3.5" />
                  {v.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
