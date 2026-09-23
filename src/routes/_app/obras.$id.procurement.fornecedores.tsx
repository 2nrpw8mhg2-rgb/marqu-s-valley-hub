import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoVazio } from "@/components/procurement/ui";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/procurement/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores e Subempreiteiros · Procurement · MV OC" },
      { name: "description", content: "Base global de fornecedores e subempreiteiros usada nas consultas de todas as obras." },
      { property: "og:title", content: "Fornecedores e Subempreiteiros · Procurement · MV OC" },
      { property: "og:description", content: "Empresas disponíveis para consulta, partilhadas por todas as obras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Fornecedores,
});

function Fornecedores() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["subempreiteiros-procurement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subempreiteiros")
        .select("id, nome, email, emails, telefone, telefones, contacto_nome, especialidades, subespecialidades, ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const termo = q.trim().toLowerCase();
  const lista = (data ?? []).filter((e: any) =>
    termo ? `${e.nome} ${(e.especialidades ?? []).join(" ")}`.toLowerCase().includes(termo) : true,
  );

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Fornecedores e Subempreiteiros</h2>
          <p className="text-sm text-muted-foreground">
            Base global partilhada por todas as obras. As empresas são associadas a cada pacote dentro do pacote.
          </p>
        </div>
        <Link to="/subempreiteiros">
          <Button variant="outline" size="sm">Gerir base de empresas</Button>
        </Link>
      </header>

      <Input placeholder="Pesquisar empresa ou especialidade…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar empresa" />

      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && !lista.length && (
        <EstadoVazio
          titulo="Sem empresas registadas"
          descricao="Nenhuma empresa corresponde à pesquisa. A base de empresas é gerida em Subempreiteiros."
          icone={<Users className="h-8 w-8" />}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((e: any) => (
          <article key={e.id} className="rounded-md border bg-card p-4 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium">{e.nome}</h3>
              {!e.ativo && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
            </div>
            {e.contacto_nome && <p className="text-xs text-muted-foreground">{e.contacto_nome}</p>}
            {(e.email || (e.emails ?? [])[0]) && (
              <p className="truncate text-xs text-muted-foreground">{e.email ?? e.emails[0]}</p>
            )}
            {(e.telefone || (e.telefones ?? [])[0]) && (
              <p className="text-xs text-muted-foreground">{e.telefone ?? e.telefones[0]}</p>
            )}
            {(e.especialidades ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {(e.especialidades ?? []).slice(0, 4).map((s: string) => (
                  <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
