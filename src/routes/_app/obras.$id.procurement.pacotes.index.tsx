import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alertas, EstadoBadge, EstadoVazio } from "@/components/procurement/ui";
import { ESTADOS_FASE1, filtrarOrdenarPacotes, rotuloEstado } from "@/lib/procurement/fase1";
import { useProcurementObra } from "@/lib/procurement/dados";
import { ClipboardList, LayoutGrid, Rows3 } from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/procurement/pacotes/")({
  head: () => ({
    meta: [
      { title: "Pacotes de Consulta da Obra · MV OC" },
      { name: "description", content: "Pacotes de consulta gerados a partir dos Mapas por Subempreitada validados." },
      { property: "og:title", content: "Pacotes de Consulta da Obra · MV OC" },
      { property: "og:description", content: "Um pacote por subempreitada validada, com artigos, empresas e pendências." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ListaPacotes,
});

function dataPT(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ListaPacotes() {
  const { id } = Route.useParams();
  const dados = useProcurementObra(id);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("todos");
  const [ordenar, setOrdenar] = useState<"nome" | "artigos" | "estado" | "atualizacao">("nome");
  const [vista, setVista] = useState<"tabela" | "cartoes">("tabela");

  const linhas = useMemo(
    () => filtrarOrdenarPacotes(dados.linhas, { q, estado, ordenar }),
    [dados.linhas, q, estado, ordenar],
  );

  if (dados.isLoading) {
    return (
      <div className="space-y-3 p-4 sm:p-6" aria-label="A carregar pacotes">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (dados.isError) {
    return (
      <div className="p-4 sm:p-6">
        <EstadoVazio
          titulo="Não foi possível carregar os pacotes"
          descricao="Verifique a ligação e tente novamente."
          accao={<Button variant="outline" size="sm" className="mt-2" onClick={() => dados.refetch()}>Tentar novamente</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Pacotes de Consulta</h2>
          <p className="text-sm text-muted-foreground">
            {linhas.length} de {dados.linhas.length} pacotes
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant={vista === "tabela" ? "secondary" : "ghost"} size="icon" aria-label="Ver em tabela" onClick={() => setVista("tabela")}>
            <Rows3 className="h-4 w-4" />
          </Button>
          <Button variant={vista === "cartoes" ? "secondary" : "ghost"} size="icon" aria-label="Ver em cartões" onClick={() => setVista("cartoes")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Input placeholder="Pesquisar pacote…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar pacote" />
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os estados</SelectItem>
            {ESTADOS_FASE1.map((e) => (
              <SelectItem key={e} value={e}>{rotuloEstado(e)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ordenar} onValueChange={(v) => setOrdenar(v as typeof ordenar)}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Ordenar"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nome">Nome</SelectItem>
            <SelectItem value="artigos">Artigos</SelectItem>
            <SelectItem value="estado">Estado</SelectItem>
            <SelectItem value="atualizacao">Atualização</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!linhas.length && (
        <EstadoVazio
          titulo={dados.linhas.length ? "Nenhum pacote corresponde aos filtros" : "Ainda não há pacotes nesta obra"}
          descricao={
            dados.linhas.length
              ? "Altere a pesquisa ou limpe os filtros."
              : "Valide a separação em Preparação de Consultas — cada subempreitada com artigos elegíveis dá origem a um pacote."
          }
          icone={<ClipboardList className="h-8 w-8" />}
        />
      )}

      {linhas.length > 0 && vista === "tabela" && (
        <div className="hidden overflow-hidden rounded-md border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pacote</TableHead>
                <TableHead className="text-right">Artigos</TableHead>
                <TableHead>Revisão MQ</TableHead>
                <TableHead className="text-right">Empresas</TableHead>
                <TableHead className="text-right">Consultas</TableHead>
                <TableHead className="text-right">Respostas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Pendências</TableHead>
                <TableHead>Atualização</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.artigos}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.mq_revisao}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.empresas}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.consultas_enviadas}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.respostas}</TableCell>
                  <TableCell><EstadoBadge estado={l.estado} /></TableCell>
                  <TableCell><Alertas alertas={l.alertas} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{dataPT(l.atualizado_em)}</TableCell>
                  <TableCell className="text-right">
                    <Link to="/obras/$id/procurement/pacotes/$pacoteId" params={{ id, pacoteId: l.id }}>
                      <Button size="sm" variant="outline">Abrir</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {linhas.length > 0 && (
        <div className={`grid gap-3 sm:grid-cols-2 ${vista === "tabela" ? "md:hidden" : ""}`}>
          {linhas.map((l) => (
            <article key={l.id} className="rounded-md border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{l.nome}</h3>
                <EstadoBadge estado={l.estado} />
              </div>
              <p className="text-xs text-muted-foreground">
                {l.artigos} artigos · {l.mq_revisao} · {l.empresas} empresas · {l.consultas_enviadas} consultas · {l.respostas} respostas
              </p>
              <Alertas alertas={l.alertas} />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">{dataPT(l.atualizado_em)}</span>
                <Link to="/obras/$id/procurement/pacotes/$pacoteId" params={{ id, pacoteId: l.id }}>
                  <Button size="sm" variant="outline">Abrir</Button>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
