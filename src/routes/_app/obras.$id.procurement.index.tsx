import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoVazio, FluxoProcurement, Metrica } from "@/components/procurement/ui";
import { metricasProcurement } from "@/lib/procurement/fase1";
import { reconciliarPacotes, useInvalidarProcurement, useProcurementObra } from "@/lib/procurement/dados";
import { ClipboardList, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/obras/$id/procurement/")({
  head: () => ({
    meta: [
      { title: "Procurement da Obra · MV OC" },
      { name: "description", content: "Visão geral do processo de consulta ao mercado de uma obra: pacotes, preparação e pendências." },
      { property: "og:title", content: "Procurement da Obra · MV OC" },
      { property: "og:description", content: "Métricas reais dos pacotes de consulta por obra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VisaoGeral,
});

function VisaoGeral() {
  const { id } = Route.useParams();
  const dados = useProcurementObra(id);
  const invalidar = useInvalidarProcurement(id);
  const [aSincronizar, setASincronizar] = useState(false);
  const tentado = useRef(false);

  const metricas = metricasProcurement(dados.linhas);

  async function sincronizar(manual = true) {
    if (!dados.orcamento?.id || aSincronizar) return;
    setASincronizar(true);
    try {
      const r = await reconciliarPacotes(dados.orcamento.id);
      await invalidar();
      if (manual) toast.success(`${r.pacotes_criados} pacotes criados, ${r.pacotes_atualizados} atualizados.`);
    } catch (e: any) {
      if (manual) toast.error(e?.message ?? "Não foi possível sincronizar os pacotes.");
    } finally {
      setASincronizar(false);
    }
  }

  // Reconciliação automática e idempotente: se a separação já estava validada
  // antes deste módulo, os pacotes aparecem sem repetir a validação.
  useEffect(() => {
    if (tentado.current || dados.isLoading || !dados.orcamento?.id) return;
    if (dados.emFalta > 0) {
      tentado.current = true;
      void sincronizar(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados.isLoading, dados.emFalta, dados.orcamento?.id]);

  if (dados.isLoading) {
    return (
      <div className="space-y-4 p-4 sm:p-6" aria-label="A carregar">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!dados.orcamento) {
    return (
      <div className="p-4 sm:p-6">
        <EstadoVazio
          titulo="Ainda não existe Mapa de Quantidades nesta obra"
          descricao="O Procurement parte dos Mapas por Subempreitada. Importe e classifique o mapa em Preparação de Consultas."
          icone={<ClipboardList className="h-8 w-8" />}
          accao={
            <Link to="/obras/$id/preparacao-consultas" params={{ id }}>
              <Button variant="outline" size="sm" className="mt-2">Ir para Preparação de Consultas</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Visão Geral</h2>
          <p className="text-sm text-muted-foreground">
            {dados.orcamento.nome} · {dados.esperados.length} subempreitadas com artigos elegíveis
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => sincronizar()} disabled={aSincronizar}>
          <RefreshCw className={`h-4 w-4 ${aSincronizar ? "animate-spin" : ""}`} /> Sincronizar pacotes
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica rotulo="Total de pacotes" valor={metricas.total} />
        <Metrica rotulo="Por preparar" valor={metricas.por_preparar} />
        <Metrica rotulo="Em preparação" valor={metricas.em_preparacao} />
        <Metrica rotulo="Pendências" valor={metricas.alertas} />
        <Metrica rotulo="Consultas enviadas" valor={metricas.consultas_enviadas} nota="Disponível numa fase seguinte" />
        <Metrica rotulo="Propostas recebidas" valor={metricas.propostas_recebidas} nota="Disponível numa fase seguinte" />
        <Metrica rotulo="Em comparação" valor={metricas.em_comparacao} nota="Disponível numa fase seguinte" />
        <Metrica rotulo="Adjudicadas" valor={metricas.adjudicadas} nota="Disponível numa fase seguinte" />
      </div>

      <FluxoProcurement />

      {metricas.total === 0 && (
        <EstadoVazio
          titulo="Ainda não há pacotes nesta obra"
          descricao="Cada subempreitada validada com artigos elegíveis dá origem a um pacote. Valide a separação em Preparação de Consultas ou sincronize."
          icone={<ClipboardList className="h-8 w-8" />}
          accao={
            <Button variant="outline" size="sm" className="mt-2" onClick={() => sincronizar()} disabled={aSincronizar}>
              Sincronizar pacotes
            </Button>
          }
        />
      )}
    </div>
  );
}
