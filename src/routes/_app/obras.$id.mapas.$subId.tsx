import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import {
  dataPT,
  derivarCapitulos,
  derivarPastas,
  estadoMapas,
  nomeFicheiroMapa,
} from "@/lib/mapas/pastas";
import { MIME_PDF, MIME_XLSX, descarregar, useMapasObra } from "@/lib/mapas/dados";
import { excelMapaBytes, type MetaMapa } from "@/lib/mapas/excel";
import { pdfMapaBytes } from "@/lib/mapas/pdf";
import { exigeRevisao } from "@/lib/consultas/revisao";

export const Route = createFileRoute("/_app/obras/$id/mapas/$subId")({
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
  const { data, isLoading } = useMapasObra(obraId);
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

  return (
    <div className="p-6 space-y-5">
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

      {isLoading && <p className="text-sm text-muted-foreground">A carregar mapa…</p>}

      {!isLoading && !pasta && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Esta subempreitada já não tem artigos atribuídos.
        </Card>
      )}

      {pasta && (
        <>
          <Card className="p-4 flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">
                {meta.obra_nome}
                {data?.obra?.cliente ? ` · ${data.obra.cliente}` : ""}
              </div>
              <h2 className="text-xl font-semibold tracking-tight">{pasta.etiqueta}</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={pasta.validada && !estado.provisorio ? "default" : "outline"}>
                  {pasta.validada && !estado.provisorio ? "Validado" : "Provisório"}
                </Badge>
                <span>{pasta.total} artigos</span>
                <span>Versão {meta.versao}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => exportar("xlsx")} disabled={aExportar !== null}>
                {aExportar === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Exportar Excel
              </Button>
              <Button variant="outline" onClick={() => exportar("pdf")} disabled={aExportar !== null}>
                {aExportar === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar PDF
              </Button>
            </div>
          </Card>

          {estado.provisorio && (
            <Card className="p-3 border-amber-500/40 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
              <span>
                Separação incompleta ({estado.motivos.join(", ")}). As exportações saem marcadas como{" "}
                <strong>PROVISÓRIAS</strong>.
              </span>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left p-2 w-24">Código</th>
                    <th className="text-left p-2 min-w-[320px]">Descrição original</th>
                    <th className="text-left p-2 w-16">Un.</th>
                    <th className="text-right p-2 w-24">Quantidade</th>
                    <th className="text-left p-2 w-40">Capítulo</th>
                    <th className="text-left p-2 w-40">Subcapítulo</th>
                    <th className="text-left p-2 w-48">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {pasta.artigos.map((a) => {
                    const c = derivarCapitulos(a);
                    return (
                      <tr key={a.artigo_id} className="border-b last:border-0 align-top">
                        <td className="p-2 font-mono text-xs">{a.codigo ?? "—"}</td>
                        <td className="p-2 whitespace-pre-wrap break-words">{a.descricao}</td>
                        <td className="p-2">{a.unidade ?? "—"}</td>
                        <td className="p-2 text-right tabular-nums">{a.quantidade}</td>
                        <td className="p-2 text-xs">{c.capitulo || "—"}</td>
                        <td className="p-2 text-xs">{c.subcapitulo || "—"}</td>
                        <td className="p-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                          {a.observacoes ?? a.referencia_documental ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
