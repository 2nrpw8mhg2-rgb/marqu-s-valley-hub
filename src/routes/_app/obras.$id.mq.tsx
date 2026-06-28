import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, ListChecks, GitBranch, GitCompare, ShoppingCart, CheckCircle2, RotateCw } from "lucide-react";
import { ImportMQDialog } from "@/components/orcamentos/ImportMQDialog";
import { runClassificacao, type ClassificacaoProgress } from "@/lib/classificacao/engine";
import { CoerenciaTecnicaCard } from "@/components/obras/CoerenciaTecnicaCard";
import { toast } from "sonner";
import type { ParsedRow } from "@/lib/mq-parser";

export const Route = createFileRoute("/_app/obras/$id/mq")({
  component: MQModule,
});

const ESTADO_MQ_META: Record<string, { label: string; cls: string }> = {
  importado: { label: "Importado", cls: "bg-muted text-muted-foreground border-border" },
  em_classificacao: { label: "Em classificação", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40" },
  aguardando_validacao: { label: "A aguardar validação", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/40" },
  validado: { label: "Validado", cls: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/40" },
  convertido_pacotes: { label: "Em procurement", cls: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/40" },
};

function MQModule() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ClassificacaoProgress | null>(null);

  const { data: orc, refetch } = useQuery({
    queryKey: ["obra-mq", id],
    queryFn: async () => {
      const { data: orcs } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("obra_id", id)
        .order("created_at", { ascending: false })
        .limit(1);
      const o = (orcs ?? [])[0];
      if (!o) return null;
      const [{ count: total }, { data: cls }] = await Promise.all([
        supabase.from("orcamento_artigos").select("id", { count: "exact", head: true }).eq("orcamento_id", o.id),
        supabase.from("classificacao_artigos").select("estado").eq("orcamento_id", o.id),
      ]);
      const lista = (cls ?? []) as { estado: string }[];
      return {
        orc: o,
        total: total ?? 0,
        validados: lista.filter((x) => x.estado === "validado").length,
        auto: lista.filter((x) => x.estado === "classificado_auto").length,
        rever: lista.filter((x) => x.estado === "necessita_revisao").length,
        sem: lista.filter((x) => x.estado === "sem_classificacao").length,
      };
    },
  });

  useEffect(() => {
    if (!orc?.orc) return;
    if (orc.orc.estado_mq === "em_classificacao") {
      const t = setInterval(() => refetch(), 1500);
      return () => clearInterval(t);
    }
  }, [orc?.orc?.estado_mq, refetch]);

  const handleImport = async (rows: ParsedRow[]) => {
    const { data: u } = await supabase.auth.getUser();
    // Cria orçamento + versão seguinte
    const proxVersao = ((orc?.orc?.versao as number | undefined) ?? 0) + 1;
    const versaoLabel = `v${proxVersao}`;
    const { data: novo, error: e0 } = await supabase
      .from("orcamentos")
      .insert({
        obra_id: id,
        nome: `MQ ${versaoLabel}`,
        versao: proxVersao,
        versao_label: versaoLabel,
        estado: "rascunho",
        estado_mq: "importado",
        created_by: u.user?.id ?? null,
      })
      .select("id")
      .single();
    if (e0) throw e0;
    const orcId = novo.id;

    // Capítulos primeiro
    const caps = rows.filter((r) => r.isCapitulo);
    const capIds = new Map<string, string>();
    if (caps.length) {
      const { data: insertedCaps, error: e1 } = await supabase
        .from("orcamento_capitulos")
        .insert(caps.map((c, i) => ({
          orcamento_id: orcId,
          codigo: c.codigo,
          descricao: c.descricao,
          ordem: (i + 1) * 10,
        })))
        .select("id, descricao");
      if (e1) throw e1;
      insertedCaps?.forEach((c) => capIds.set(c.descricao, c.id));
    }

    // Artigos
    const artigos = rows.filter((r) => !r.isCapitulo);
    if (artigos.length) {
      // Best-effort: associa cada artigo ao último capítulo declarado antes dele
      let currentCap: string | null = null;
      const payload = rows
        .map((r, idx) => {
          if (r.isCapitulo) {
            currentCap = capIds.get(r.descricao) ?? null;
            return null;
          }
          return {
            orcamento_id: orcId,
            capitulo_id: currentCap,
            codigo: r.codigo,
            descricao: r.descricao,
            unidade: r.unidade,
            quantidade: r.quantidade,
            preco_unitario: r.preco_unitario,
            margem_pct: 0,
            ordem: (idx + 1) * 10,
          };
        })
        .filter(Boolean) as any[];

      for (let k = 0; k < payload.length; k += 300) {
        const chunk = payload.slice(k, k + 300);
        const { error } = await supabase.from("orcamento_artigos").insert(chunk);
        if (error) throw error;
      }
    }

    toast.success(`${artigos.length} artigos importados — a classificar…`);
    setImportOpen(false);
    qc.invalidateQueries({ queryKey: ["obra-mq", id] });

    // Auto-classificação
    setRunning(true);
    setProgress({ total: artigos.length, done: 0, classificados: 0, pendentes: 0, porAnalisar: artigos.length });
    try {
      await runClassificacao(orcId, (snap) => setProgress(snap));
      toast.success("Classificação concluída");
      qc.invalidateQueries({ queryKey: ["obra-mq", id] });
      qc.invalidateQueries({ queryKey: ["obra-resumo", id] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro na classificação");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const reClassificar = async () => {
    if (!orc?.orc) return;
    setRunning(true);
    setProgress({ total: orc.total, done: 0, classificados: 0, pendentes: 0, porAnalisar: orc.total });
    try {
      await runClassificacao(orc.orc.id, (snap) => setProgress(snap));
      toast.success("Classificação concluída");
      qc.invalidateQueries({ queryKey: ["obra-mq", id] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  // Estado: sem MQ
  if (!orc) {
    return (
      <div className="p-6">
        <Card className="bg-card border-border p-12 text-center space-y-4">
          <ListChecks className="h-12 w-12 mx-auto text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Sem Mapa de Quantidades</h2>
            <p className="text-muted-foreground max-w-xl mx-auto mt-1">
              Importa o primeiro MQ desta obra. O sistema vai extrair os artigos e classificá-los automaticamente
              utilizando a Biblioteca Mestra.
            </p>
          </div>
          <Button size="lg" onClick={() => setImportOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Upload className="h-4 w-4 mr-2" /> Importar Mapa de Quantidades
          </Button>
        </Card>
        <ImportMQDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
      </div>
    );
  }

  const pct = orc.total ? Math.round(((orc.validados + orc.auto) / orc.total) * 100) : 0;
  const estadoMeta = ESTADO_MQ_META[orc.orc.estado_mq] ?? ESTADO_MQ_META.importado;

  return (
    <div className="p-6 space-y-4">
      {/* Cabeçalho do MQ */}
      <Card className="bg-card border-border p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{orc.orc.nome}</h2>
              <span className="text-xs font-mono text-muted-foreground">{orc.orc.versao_label}</span>
              <Badge variant="outline" className={estadoMeta.cls}>{estadoMeta.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Importado em {new Date(orc.orc.created_at).toLocaleString("pt-PT")}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <GitBranch className="h-4 w-4 mr-1" /> Importar nova versão
            </Button>
            <Button variant="outline" size="sm" disabled title="Em breve">
              <GitCompare className="h-4 w-4 mr-1" /> Comparar versões
            </Button>
            <Button variant="outline" size="sm" onClick={reClassificar} disabled={running}>
              <RotateCw className="h-4 w-4 mr-1" /> Re-classificar
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() =>
                navigate({ to: "/motor-classificacao", search: { orcamento: orc.orc.id } })
              }
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Rever classificação
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/procurement/pacotes" })}>
              <ShoppingCart className="h-4 w-4 mr-1" /> Gerar Pacotes
            </Button>
          </div>
        </div>
      </Card>

      {/* Em classificação */}
      {running && progress && (
        <Card className="bg-card border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="font-medium">A classificar artigos…</span>
            </div>
            <span className="text-sm font-mono text-muted-foreground tabular-nums">
              {Math.round((progress.done / Math.max(1, progress.total)) * 100)}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="bg-primary h-3 transition-all duration-300 ease-out"
              style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="classificados" value={progress.classificados} tone="emerald" />
            <Stat label="a rever" value={progress.pendentes} tone="amber" />
            <Stat label="por analisar" value={progress.porAnalisar} tone="muted" pulse />
          </div>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Total artigos" value={orc.total} />
        <KPI label="Classificados" value={orc.auto + orc.validados} tone="blue" />
        <KPI label="% Classificação" value={`${pct}%`} tone="blue" />
        <KPI label="A validar" value={orc.rever} tone="yellow" />
        <KPI label="Sem classif." value={orc.sem} tone="muted" />
      </div>

      <ImportMQDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: number | string; tone?: "blue" | "yellow" | "muted" }) {
  const cls =
    tone === "blue" ? "text-blue-600 dark:text-blue-400" :
    tone === "yellow" ? "text-yellow-600 dark:text-yellow-400" :
    tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <Card className="bg-card border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${cls}`}>{value}</div>
    </Card>
  );
}

function Stat({ label, value, tone, pulse }: { label: string; value: number; tone: "emerald" | "amber" | "muted"; pulse?: boolean }) {
  const cls =
    tone === "emerald" ? "text-emerald-500" :
    tone === "amber" ? "text-amber-500" : "text-muted-foreground";
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${cls} ${pulse ? "animate-pulse" : ""}`}>
        {value.toLocaleString("pt-PT")}
      </div>
    </div>
  );
}
