import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  HardHat,
  FileText,
  Users,
  Calculator,
  Layers,
  BookMarked,
  ShoppingCart,
  Sparkles,
  LogOut,
  Library,
  History,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type NavItem = { to: string; label: string; icon: LucideIcon; phase?: string; disabled?: boolean };

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Fase 1 — MVP",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/obras", label: "CRM de Obras", icon: HardHat },
      { to: "/documentos", label: "Gestão Documental", icon: FileText },
      { to: "/subempreiteiros", label: "Subempreiteiros", icon: Users },
    ],
  },
  {
    title: "Biblioteca Mestra",
    items: [
      { to: "/biblioteca-mestra", label: "Explorador", icon: Library },
      { to: "/biblioteca-mestra/especialidades", label: "Especialidades", icon: BookMarked },
      { to: "/biblioteca-mestra/subespecialidades", label: "Subespecialidades", icon: Layers },
      
      { to: "/biblioteca-mestra/categorias", label: "Categorias", icon: Layers },
      { to: "/biblioteca-mestra/artigos", label: "Pesquisa de Artigos", icon: FileText },
      { to: "/biblioteca-mestra/keywords", label: "Palavras-chave", icon: Sparkles },
      { to: "/biblioteca-mestra/unidades", label: "Unidades", icon: Layers },
      { to: "/biblioteca-mestra/templates", label: "Templates de Obra", icon: HardHat },
    ],
  },
  {
    title: "Fase 2 — Orçamentação",
    items: [
      { to: "/orcamentos", label: "Orçamentos", icon: Calculator },
      { to: "/decomposicao-precos", label: "Decomposição de Preços", icon: Layers },
      { to: "/biblioteca", label: "Histórico de Preços", icon: History },
    ],
  },
  {
    title: "Fase 3 — Procurement",
    items: [
      { to: "/procurement/pacotes", label: "Pacotes de Consulta", icon: ShoppingCart },
    ],
  },
  {
    title: "Próximas fases",
    items: [
      { to: "/ia", label: "Agentes IA", icon: Sparkles, phase: "Fase 4+", disabled: true },
    ],
  },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Sessão terminada");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="p-5 border-b border-sidebar-border">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {section.title}
            </h3>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname.startsWith(item.to);
                const Icon = item.icon;
                if (item.disabled) {
                  return (
                    <li key={item.to}>
                      <div className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground/70 cursor-not-allowed">
                        <span className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {item.phase}
                        </span>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
                          : "hover:bg-sidebar-accent/60"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.email}</p>
            <p className="text-[10px] text-muted-foreground">Utilizador</p>
          </div>
          <Button size="icon" variant="ghost" onClick={handleSignOut} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
