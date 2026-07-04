import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { HardHat, ShieldCheck, FileText, Boxes } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : "",
  }),
  head: () => ({ meta: [{ title: "Entrar — MV OS" }] }),
  component: AuthPage,
});

function safeNext(next: string): string {
  if (!next) return "";
  if (!next.startsWith("/") || next.startsWith("//")) return "";
  return next;
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const nextTarget = safeNext(search.next);
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);

  // login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // signup state
  const [sNome, setSNome] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sPassword, setSPassword] = useState("");

  useEffect(() => {
    if (!authLoading && session) {
      if (nextTarget) {
        window.location.href = nextTarget;
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    }
  }, [session, authLoading, navigate, nextTarget]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Sessão iniciada");
      if (nextTarget) {
        window.location.href = nextTarget;
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const returnTo = nextTarget
      ? `${window.location.origin}${nextTarget}`
      : `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email: sEmail,
      password: sPassword,
      options: {
        emailRedirectTo: returnTo,
        data: { nome: sNome },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Conta criada. Já pode entrar.");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-[image:var(--gradient-surface)] border-r border-border overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--color-foreground) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <Logo />

        <div className="relative space-y-8 max-w-md">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Operating System para a <span className="text-primary">construção</span>.
            </h1>
            <p className="mt-4 text-muted-foreground">
              Centraliza obras, documentos, procurement, orçamentação e os teus
              futuros agentes de IA num único sítio.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-3 text-sm">
            {[
              { icon: HardHat, t: "CRM de Obras" },
              { icon: FileText, t: "Gestão Documental" },
              { icon: Boxes, t: "Subempreiteiros" },
              { icon: ShieldCheck, t: "Procurement & IA" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2">
                <Icon className="h-4 w-4 text-primary" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} Marquês Valley · Plataforma interna
        </p>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md p-8 bg-card border-border shadow-[var(--shadow-elevated)]">
          <div className="lg:hidden mb-6"><Logo /></div>
          <h2 className="text-2xl font-semibold">Bem-vindo</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Acede à tua conta MV OS ou cria uma nova.
          </p>

          <Tabs defaultValue="login" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.pt" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Palavra-passe</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {loading ? "A entrar..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sNome">Nome</Label>
                  <Input id="sNome" required value={sNome} onChange={(e) => setSNome(e.target.value)} placeholder="João Silva" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sEmail">Email</Label>
                  <Input id="sEmail" type="email" required value={sEmail} onChange={(e) => setSEmail(e.target.value)} placeholder="nome@empresa.pt" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sPassword">Palavra-passe</Label>
                  <Input id="sPassword" type="password" required minLength={6} value={sPassword} onChange={(e) => setSPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {loading ? "A criar..." : "Criar conta"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  O primeiro utilizador a registar-se torna-se automaticamente administrador.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
