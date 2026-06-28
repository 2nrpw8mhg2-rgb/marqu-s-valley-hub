import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, FileText, ListChecks, Calculator, ShoppingCart, CalendarDays, Wallet, Ruler, BarChart3, LayoutDashboard } from "lucide-react";

const TABS = [
  { to: "", label: "Resumo", icon: LayoutDashboard },
  { to: "/documentos", label: "Documentos", icon: FileText },
  { to: "/mq", label: "Mapa de Quantidades", icon: ListChecks },
  { to: "/orcamentacao", label: "Orçamentação", icon: Calculator },
  { to: "/procurement", label: "Procurement", icon: ShoppingCart },
  { to: "/planeamento", label: "Planeamento", icon: CalendarDays, soon: true },
  { to: "/financeira", label: "Gestão Financeira", icon: Wallet, soon: true },
  { to: "/medicoes", label: "Medições", icon: Ruler, soon: true },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, soon: true },
];

export function ObraLayout({ obraId }: { obraId: string }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const { data: obra } = useQuery({
    queryKey: ["obra", obraId],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("*").eq("id", obraId).single();
      if (error) throw error;
      return data;
    },
  });

  const base = `/obras/${obraId}`;
  const currentSub = pathname.startsWith(base) ? pathname.slice(base.length) || "" : "";

  return (
    <>
      <div className="border-b border-border bg-card">
        <div className="px-6 pt-4 pb-3">
          <button
            onClick={() => navigate({ to: "/obras" })}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> CRM de Obras
          </button>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                {obra?.codigo || "—"}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">{obra?.nome ?? "Obra"}</h1>
              <p className="text-sm text-muted-foreground">
                {obra?.cliente ?? "—"}{obra?.localizacao ? ` · ${obra.localizacao}` : ""}
              </p>
            </div>
            {obra?.estado && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-border bg-muted text-muted-foreground">
                {obra.estado.replace("_", " ")}
              </span>
            )}
          </div>
        </div>
        <nav className="px-4 overflow-x-auto">
          <ul className="flex gap-0.5 min-w-max">
            {TABS.map((t) => {
              const href = base + t.to;
              const active = t.to === "" ? currentSub === "" || currentSub === "/" : currentSub === t.to || currentSub.startsWith(t.to + "/");
              const Icon = t.icon;
              return (
                <li key={t.to}>
                  <Link
                    to={href}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                      active
                        ? "border-primary text-foreground font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                    {t.soon && (
                      <span className="ml-1 text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-muted text-muted-foreground/70">
                        em breve
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <Outlet />
    </>
  );
}
