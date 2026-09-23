import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ArrowDownAZ, ArrowUpAZ, Folder, Loader2, Package, Search } from "lucide-react";
import {
  derivarPastas,
  estadoMapas,
  filtrarPastas,
  reconciliarPastas,
  sanitizarNomeFicheiro,
  dataPT,
  type OrdemPastas,
} from "@/lib/mapas/pastas";
import { MIME_ZIP, descarregar, useMapasObra } from "@/lib/mapas/dados";
import { gerarZipMapas, type ModoZip } from "@/lib/mapas/zip";
import { exigeRevisao } from "@/lib/consultas/revisao";

export const Route = createFileRoute("/_app/obras/$id/mapas/")({
  component: MapasGrelha,
  head: () => ({
    meta: [
      { title: "Mapas por Subempreitada · MV OC" },
      {
        name: "description",
        content:
          "Grelha de mapas de quantidades organizados por subempreitada, com exportação Excel, PDF e ZIP para consulta ao mercado.",
      },
      { property: "og:title", content: "Mapas por Subempreitada · MV OC" },
      {
        property: "og:description",
        content: "Mapas de quantidades por subempreitada prontos para consulta a subempreiteiros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MapasGrelha() {
  const { id: obraId } = Route.useParams();
  const { data, isLoading } = useMapasObra(obraId);
  const [pesquisa, setPesquisa] = useState("");
  const [ordem, setOrdem] = useState<OrdemPastas>("az");
  const [modo, setModo] = useState<ModoZip>("ambos");
  const [aExportar, setAExportar] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const artigos = data?.artigos ?? [];
  const pastas = useMemo(
    () => derivarPastas(artigos, data?.subempreitadas ?? []),
    [artigos, data?.subempreitadas],
  );
  const visiveis = useMemo(() => filtrarPastas(pastas, pesquisa, ordem), [pastas, pesquisa, ordem]);
  const reconciliacao = useMemo(() => reconciliarPastas(artigos, pastas), [artigos, pastas]);

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

  async function exportarTodos() {
    if (aExportar || visiveis.length === 0) return;
    setAExportar(true);
    setProgresso(0);
    try {
      const { bytes, relatorio } = await gerarZipMapas(
        pastas,
        {
          obra_nome: data?.obra?.nome ?? "Obra",
          obra_cliente: data?.obra?.cliente ?? null,
          orcamento_nome: data?.orcamento?.nome ?? "Mapa de Quantidades",
          data: dataPT(),
          provisorio: estado.provisorio,
          versao: dataPT(),
        },
        modo,
        async (feitos, total) => {
          setProgresso(Math.round((feitos / total) * 100));
          await new Promise((r) => setTimeout(r, 0));
        },
      );
      if (!bytes) {
        toast.error("Não foi possível gerar nenhum mapa.");
        return;
      }
      descarregar(bytes, `mapas_${sanitizarNomeFicheiro(data?.obra?.nome ?? "obra", 40)}.zip`, MIME_ZIP);
      if (relatorio.falhas.length) {
        toast.warning(
          `${relatorio.ficheiros} mapas exportados. Falharam: ${relatorio.falhas
            .map((f) => `${f.pasta} (${f.formato})`)
            .join(", ")}.`,
        );
      } else {
        toast.success(`${relatorio.ficheiros} mapas exportados.`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível exportar os mapas.");
    } finally {
      setAExportar(false);
      setProgresso(0);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <nav className="text-xs text-muted-foreground" aria-label="Percurso">
        <Link to="/obras/$id/preparacao-consultas" params={{ id: obraId }} className="hover:text-foreground">
          Preparação de Consultas
        </Link>
        <span className="mx-1">→</span>
        <span className="text-foreground">Mapas por Subempreitada</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Mapas por Subempreitada</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Cada pasta corresponde a uma subempreitada com artigos atribuídos. O conteúdo é lido diretamente do Mapa de
            Quantidades, pelo que reflete sempre a situação atual.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={modo} onValueChange={(v) => setModo(v as ModoZip)}>
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="excel">Todos em Excel</SelectItem>
              <SelectItem value="pdf">Todos em PDF</SelectItem>
              <SelectItem value="ambos">Excel e PDF</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportarTodos} disabled={aExportar || pastas.length === 0}>
            {aExportar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            {aExportar ? `A gerar… ${progresso}%` : "Exportar Todos os Mapas"}
          </Button>
        </div>
      </div>

      {estado.provisorio && (
        <Card className="p-3 border-amber-500/40 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
          <span>
            Separação incompleta ({estado.motivos.join(", ")}). Os mapas podem ser consultados e exportados, mas saem
            marcados como <strong>PROVISÓRIOS</strong>.
          </span>
        </Card>
      )}

      {!reconciliacao.ok && (
        <Card className="p-3 border-destructive/40 text-sm">
          Verificação de integridade: {reconciliacao.em_pastas} artigos em pastas +{" "}
          {reconciliacao.sem_classificacao} sem classificação não correspondem aos {reconciliacao.total_mq} artigos do
          Mapa de Quantidades.
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            aria-label="Pesquisar subempreitada"
            placeholder="Pesquisar subempreitada…"
            className="pl-8 w-[260px]"
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setOrdem(ordem === "az" ? "za" : "az")}>
          {ordem === "az" ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
          {ordem === "az" ? "A–Z" : "Z–A"}
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">
          {pastas.length} pastas · {reconciliacao.em_pastas} artigos atribuídos ·{" "}
          {reconciliacao.sem_classificacao} sem subempreitada
        </span>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">A carregar mapas…</p>}

      {!isLoading && visiveis.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {pastas.length === 0
            ? "Ainda não existe nenhuma subempreitada com artigos atribuídos. Faça primeiro a separação em Preparação de Consultas."
            : "Nenhuma subempreitada corresponde à pesquisa."}
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visiveis.map((p) => (
          <Link
            key={p.subempreitada_id}
            to="/obras/$id/mapas/$subId"
            params={{ id: obraId, subId: p.subempreitada_id }}
            search={{ q: "", capitulo: "", subcapitulo: "", ordenar: "original", direcao: "asc", pagina: 1, tamanho: 25 }}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          >
            <Card className="p-4 h-full hover:bg-muted/40 transition-colors space-y-2">
              <div className="flex items-start gap-2">
                <Folder className="h-5 w-5 text-primary shrink-0" />
                <div className="font-medium text-sm leading-snug">{p.etiqueta}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{p.total} artigos</Badge>
                <Badge variant={p.validada && !estado.provisorio ? "default" : "outline"}>
                  {p.validada && !estado.provisorio ? "Validado" : "Provisório"}
                </Badge>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Atualizado: {p.atualizado_em ? new Date(p.atualizado_em).toLocaleString("pt-PT") : "—"}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
