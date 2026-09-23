import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight, ClipboardList, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alertas, EstadoBadge, EstadoVazio, Metrica } from "@/components/procurement/ui";
import { ESTADOS_FASE1, filtrarOrdenarPacotes, metricasProcurement, rotuloEstado } from "@/lib/procurement/fase1";
import { useProcurementObra } from "@/lib/procurement/dados";

export const Route = createFileRoute("/_app/obras/$id/procurement/pacotes/")({
  head: () => ({
    meta: [
      { title: "Pacotes de Consulta da Obra · MV OC" },
      { name: "description", content: "Pastas de consulta da obra, preparadas a partir dos mapas por subempreitada validados." },
      { property: "og:title", content: "Pacotes de Consulta da Obra · MV OC" },
      { property: "og:description", content: "Consulte o estado, artigos, empresas e pendências de cada pacote da obra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ListaPacotes,
});

const BUSCA_INICIAL = { q: "", capitulo: "", subcapitulo: "", ordenar: "original", direcao: "asc", pagina: 1, tamanho: 25, tab: "mapa" } as const;

function dataPT(v: string | null) {
  if (!v) return null;
  return new Date(v).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ListaPacotes() {
  const { id } = Route.useParams();
  const dados = useProcurementObra(id);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("todos");
  const [ordenar, setOrdenar] = useState<"nome" | "artigos" | "estado" | "atualizacao">("nome");

  const linhas = useMemo(
    () => filtrarOrdenarPacotes(dados.linhas, { q, estado, ordenar }),
    [dados.linhas, q, estado, ordenar],
  );
  const metricas = metricasProcurement(dados.linhas);

  if (dados.isLoading) {
    return <div className="space-y-4 p-4 sm:p-6" aria-label="A carregar pacotes"><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>;
  }

  if (dados.isError) {
    return <div className="p-4 sm:p-6"><EstadoVazio titulo="Não foi possível carregar os pacotes" descricao="Verifique a ligação e tente novamente." accao={<Button variant="outline" size="sm" className="mt-2" onClick={() => dados.refetch()}>Tentar novamente</Button>} /></div>;
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Pacotes de Consulta</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organize e prepare as consultas ao mercado a partir dos mapas validados desta obra.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2" aria-label="Resumo dos pacotes">
        <Metrica rotulo="Pacotes criados" valor={metricas.total} />
        <Metrica rotulo="Consultas enviadas" valor={metricas.consultas_enviadas} />
        <Metrica rotulo="Propostas recebidas" valor={metricas.propostas_recebidas} />
        <Metrica rotulo="Em comparação" valor={metricas.em_comparacao} />
      </section>

      <section className="space-y-3" aria-label="Pesquisa e filtros">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Input placeholder="Pesquisar pacote…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar pacote" />
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos os estados</SelectItem>{ESTADOS_FASE1.map((e) => <SelectItem key={e} value={e}>{rotuloEstado(e)}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ordenar} onValueChange={(v) => setOrdenar(v as typeof ordenar)}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Ordenar"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="nome">Nome</SelectItem><SelectItem value="artigos">Número de artigos</SelectItem><SelectItem value="estado">Estado</SelectItem><SelectItem value="atualizacao">Atualização</SelectItem></SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">{linhas.length} de {dados.linhas.length} pacotes</p>
      </section>

      {!linhas.length ? (
        <EstadoVazio titulo={dados.linhas.length ? "Nenhum pacote corresponde aos filtros" : "Ainda não há pacotes nesta obra"} descricao={dados.linhas.length ? "Altere a pesquisa ou os filtros." : "Valide a separação em Preparação de Consultas. Cada subempreitada com artigos elegíveis dá origem a um pacote."} icone={<ClipboardList className="h-8 w-8" />} />
      ) : (
        <section className="space-y-2" aria-label="Pastas de consulta">
          {linhas.map((linha) => (
            <Link key={linha.id} to="/obras/$id/procurement/pacotes/$pacoteId" params={{ id, pacoteId: linha.id }} search={BUSCA_INICIAL} className="group block rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5">
              <span className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><FolderKanban className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-start justify-between gap-2"><span className="font-semibold text-foreground">{linha.nome}</span><EstadoBadge estado={linha.estado} /></span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{linha.artigos} artigos</span><span aria-hidden="true">·</span><span>{linha.empresas} empresas</span><span aria-hidden="true">·</span><span>{linha.consultas_enviadas} consultas</span><span aria-hidden="true">·</span><span>{linha.respostas} respostas</span>{dataPT(linha.atualizado_em) && <><span aria-hidden="true">·</span><span>Atualizado em {dataPT(linha.atualizado_em)}</span></>}
                  </span>
                  {linha.alertas.length > 0 && <span className="mt-2 block"><Alertas alertas={linha.alertas} /></span>}
                </span>
                <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}