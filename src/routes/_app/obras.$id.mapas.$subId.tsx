import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapaQuantidadesView } from "@/components/mapas/MapaQuantidadesView";
import { AlertTriangle, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import {
  dataPT,
  derivarPastas,
  estadoMapas,
  nomeFicheiroMapa,
} from "@/lib/mapas/pastas";
import { MIME_PDF, MIME_XLSX, descarregar, useMapasObra } from "@/lib/mapas/dados";
import { excelMapaBytes, type MetaMapa } from "@/lib/mapas/excel";
import { pdfMapaBytes } from "@/lib/mapas/pdf";
import { exigeRevisao } from "@/lib/consultas/revisao";
import { validarMapaSearch } from "@/lib/mapas/view";

export const Route = createFileRoute("/_app/obras/$id/mapas/$subId")({
  validateSearch: validarMapaSearch,
  component: MapaSubempreitada,
  head: () => ({
    meta: [
      { title: "Mapa da Subempreitada · MV OC" },
      {
        name: "description",
        content:
          "Mapa de quantidades de uma subempreitada, com descrições originais integrais e exportação em Excel e PDF.",
      },
      { property: "og:title", content: "Mapa da Subempreitada · MV OC" },
      {
        property: "og:description",
        content: "Artigos do Mapa de Quantidades atribuídos a uma subempreitada, prontos para consulta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MapaSubempreitada() {
  const { id: obraId, subId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/obras/$id/mapas/$subId" });
  const { data, isLoading, isError, refetch } = useMapasObra(obraId);
  const [aExportar, setAExportar] = useState<"xlsx" | "pdf" | null>(null);

  const artigos = data?.artigos ?? [];
  const pastas = useMemo(
    () => derivarPastas(artigos, data?.subempreitadas ?? []),
    [artigos, data?.subempreitadas],
  );
  const pasta = pastas.find((p) => p.subempreitada_id === subId) ?? null;

  const aRever = artigos.filter((a) =>
    exigeRevisao({
      artigo_id: a.artigo_id,
      codigo: a.codigo,
      descricao: a.descricao,
      unidade: a.unidade,
      quantidade: a.quantidade,
      capitulo_codigo: a.capitulo_codigo,
      capitulo_descricao: a.capitulo_descricao,
      classificado: a.classificado,
      subempreitada_id: a.subempreitada_id,
      subempreitada_ia_id: null,
      confianca: a.confianca,
      confianca_ia: a.confianca,
      necessita_revisao: a.necessita_revisao,
      validado_manual: a.validado_manual,
      sugestao_nova_subempreitada: a.sugestao_nova_subempreitada,
    }),
  ).length;
  const pendentes = artigos.filter((a) => !a.classificado).length;
  const estado = estadoMapas({ pendentes, falhados: 0, a_rever: aRever });

  const meta: MetaMapa = {
    obra_nome: data?.obra?.nome ?? "Obra",
    obra_cliente: data?.obra?.cliente ?? null,
    orcamento_nome: data?.orcamento?.nome ?? "Mapa de Quantidades",
    data: dataPT(),
    provisorio: estado.provisorio,
    versao: dataPT(pasta?.atualizado_em ? new Date(pasta.atualizado_em) : new Date()),
  };

  function exportar(formato: "xlsx" | "pdf") {
    if (!pasta || aExportar) return;
    setAExportar(formato);
    try {
      const bytes = formato === "xlsx" ? excelMapaBytes(pasta, meta) : pdfMapaBytes(pasta, meta);
      descarregar(
        bytes,
        nomeFicheiroMapa(meta.obra_nome, pasta.etiqueta, formato),
        formato === "xlsx" ? MIME_XLSX : MIME_PDF,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar o ficheiro.");
    } finally {
      setAExportar(null);
    }
  }

  function alterarVista(patch: Partial<typeof search>, reiniciar = false) {
    navigate({
      search: (anterior) => ({
        ...anterior,
        ...patch,
        ...(reiniciar ? { pagina: 1 } : {}),
      }),
      replace: true,
    });
  }

  return (
    <div className="space-y-4 p-3 sm:p-5 lg:p-6">
      <nav className="text-xs text-muted-foreground" aria-label="Percurso">
        <Link to="/obras/$id/preparacao-consultas" params={{ id: obraId }} className="hover:text-foreground">
          Preparação de Consultas
        </Link>
        <span className="mx-1">→</span>
        <Link to="/obras/$id/mapas" params={{ id: obraId }} className="hover:text-foreground">
          Mapas por Subempreitada
        </Link>
        <span className="mx-1">→</span>
        <span className="text-foreground">{pasta?.etiqueta ?? "—"}</span>
      </nav>

      {isLoading && <div className="space-y-3" aria-label="A carregar mapa"><Skeleton className="h-24 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-96 w-full" /></div>}

      {isError && <div className="rounded-md border bg-card p-8 text-center"><p className="text-sm font-medium">Não foi possível carregar o mapa.</p><Button variant="outline" className="mt-3" onClick={() => refetch()}>Tentar novamente</Button></div>}

      {!isLoading && !pasta && (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          Esta subempreitada já não tem artigos atribuídos.
        </div>
      )}

      {pasta && (
        <>
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b pb-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="text-xs text-muted-foreground">
                {meta.obra_nome}
                {data?.obra?.cliente ? ` · ${data.obra.cliente}` : ""}
              </div>
              <h1 className="truncate text-xl font-semibold sm:text-2xl">{pasta.etiqueta}</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={pasta.validada && !estado.provisorio ? "default" : "outline"}>
                  {pasta.validada && !estado.provisorio ? "Validado" : "Provisório"}
                </Badge>
                <span>{pasta.total} artigos</span>
                <span>Versão {meta.versao}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button variant="outline" size="sm" onClick={() => exportar("xlsx")} disabled={aExportar !== null}>
                {aExportar === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Exportar Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportar("pdf")} disabled={aExportar !== null}>
                {aExportar === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar PDF
              </Button>
            </div>
          </header>

          {estado.provisorio && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                Separação incompleta ({estado.motivos.join(", ")}). As exportações saem marcadas como{" "}
                <strong>PROVISÓRIAS</strong>.
              </span>
            </div>
          )}

          <MapaQuantidadesView artigos={pasta.artigos} estado={search} onEstado={alterarVista} />
        </>
      )}
    </div>
  );
}
