import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, CheckCircle2, X, Edit3, Sparkles, Play, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { runClassificacao, aprenderClassificacao, registarAprendizagem, type Candidato, type Metodo } from "@/lib/classificacao/engine";
import { ClassificacaoSidePanel, type PanelRow } from "@/components/classificacao/ClassificacaoSidePanel";
import { ResultadoIABadge } from "@/components/classificacao/ResultadoIABadge";
import { ConfiancaBar } from "@/components/classificacao/ConfiancaBar";
import { ProximaAcaoChip, calcularProximaAcao } from "@/components/classificacao/ProximaAcaoChip";

export const Route = createFileRoute("/_app/motor-classificacao")({
  head: () => ({ meta: [{ title: "Centro de Classificação Inteligente — MV OS" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ orcamento: (s.orcamento as string) || "" }),
  component: CentroClassificacao,
});

type EstadoCls = "classificado_auto" | "necessita_revisao" | "sem_classificacao" | "validado";
type ClsRow = {
  id: string; orcamento_id: string; artigo_origem_id: string;
  orcamento_artigos?: {
    ordem: number;
    capitulo_id?: string | null;
    capitulo?: { id: string; codigo: string | null; descricao: string | null; ordem: number | null } | null;
  } | null;
  descricao_original: string; unidade_original: string | null; quantidade_original: number | null;
  especialidade_id: string | null; subespecialidade_id: string | null;
  categoria_id: string | null; artigo_mestre_id: string | null;
  confianca: number; estado: EstadoCls;
  metodo_match: Metodo; motivo: string | null; candidatos: Candidato[] | null;
};

async function fetchClassificacaoRows(orcamentoId: string, estadoFilter = "all", search = "") {
  const out: ClsRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let q = supabase.from("classificacao_artigos").select("*, orcamento_artigos!inner(ordem, capitulo_id, capitulo:orcamento_capitulos(id, codigo, descricao, ordem))")
      .eq("orcamento_id", orcamentoId)
      .order("created_at", { ascending: true });
    if (estadoFilter !== "all") q = q.eq("estado", estadoFilter as EstadoCls);
    if (search.trim()) q = q.ilike("descricao_original", `%${search.trim()}%`);
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...((data ?? []) as ClsRow[]));
    if (!data || data.length < pageSize) break;
  }
  return out.sort((a, b) => {
    const ao = a.orcamento_artigos?.ordem ?? Number.MAX_SAFE_INTEGER;
    const bo = b.orcamento_artigos?.ordem ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.descricao_original.localeCompare(b.descricao_original, "pt-PT");
  });
}

async function countClassificacoes(orcamentoId: string) {
  const estados: EstadoCls[] = ["classificado_auto", "necessita_revisao", "sem_classificacao", "validado"];
  const counts = await Promise.all([
    supabase.from("classificacao_artigos").select("id", { count: "exact", head: true }).eq("orcamento_id", orcamentoId),
    ...estados.map((estado) => supabase.from("classificacao_artigos").select("id", { count: "exact", head: true }).eq("orcamento_id", orcamentoId).eq("estado", estado)),
  ]);
  const failed = counts.find((r) => r.error);
  if (failed?.error) throw failed.error;
  const [total, auto, parcial, sem, validados] = counts.map((r) => r.count ?? 0);
  return { total, auto, parcial, sem, validados };
}

const ESTADO_META: Record<EstadoCls, { label: string; cls: string }> = {
  validado: { label: "Validado", cls: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/40" },
  classificado_auto: { label: "Auto", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40" },
  necessita_revisao: { label: "Rever", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/40" },
  sem_classificacao: { label: "Sem classif.", cls: "bg-muted text-muted-foreground border-border" },
};

const METODO_LABEL: Record<Metodo, string> = {
  exato: "Exato",
  aprendido: "Aprendido",
  keyword_artigo: "Keywords",
  keyword_subesp: "Keywords (subesp.)",
  keyword_esp: "Keywords (esp.)",
  manual: "Manual",
  nenhum: "—",
};

function CentroClassificacao() {
  const { orcamento } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialogRow, setDialogRow] = useState<ClsRow | null>(null);
  const [panelRow, setPanelRow] = useState<ClsRow | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ total: number; done: number; classificados: number; pendentes: number; porAnalisar: number } | null>(null);

  const { data: orcamentos = [] } = useQuery({
    queryKey: ["cc-orcamentos"],
    queryFn: async () => {
      const { data } = await supabase.from("orcamentos").select("id, nome, versao, obra_id").order("created_at", { ascending: false });
      return (data ?? []) as { id: string; nome: string; versao: number; obra_id: string | null }[];
    },
  });
  const obraIdAtual = orcamentos.find((o) => o.id === orcamento)?.obra_id ?? null;

  const { data: artigosCount = 0 } = useQuery({
    queryKey: ["cc-artigos-count", orcamento],
    enabled: !!orcamento,
    queryFn: async () => {
      const { count } = await supabase.from("orcamento_artigos")
        .select("id", { count: "exact", head: true }).eq("orcamento_id", orcamento);
      return count ?? 0;
    },
  });

  const { data: run } = useQuery({
    queryKey: ["cc-run", orcamento],
    enabled: !!orcamento,
    refetchInterval: running ? 1500 : false,
    queryFn: async () => {
      const { data } = await supabase.from("orcamento_classificacao_run")
        .select("*").eq("orcamento_id", orcamento).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data as any;
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cc-rows", orcamento, estadoFilter, search],
    enabled: !!orcamento && !!run && run.estado === "concluido",
    queryFn: () => fetchClassificacaoRows(orcamento, estadoFilter, search),
  });

  const { data: classCounts } = useQuery({
    queryKey: ["cc-classificacao-counts", orcamento],
    enabled: !!orcamento && !!run && run.estado === "concluido",
    queryFn: () => countClassificacoes(orcamento),
    refetchInterval: 8000,
  });

  const { data: memoriaTotal = 0 } = useQuery({
    queryKey: ["cc-memoria-total"],
    queryFn: async () => {
      const { count } = await supabase.from("classificacao_memoria").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: esps = [] } = useQuery({
    queryKey: ["cc-esps"],
    queryFn: async () => (await supabase.from("biblioteca_especialidades").select("id, nome").order("ordem")).data as any[],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["cc-subs"],
    queryFn: async () => (await supabase.from("biblioteca_subespecialidades").select("id, nome, especialidade_id").order("ordem")).data as any[],
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["cc-cats"],
    queryFn: async () => (await supabase.from("biblioteca_categorias").select("id, nome, subespecialidade_id").order("ordem")).data as any[],
  });
  const { data: arts = [] } = useQuery({
    queryKey: ["cc-arts"],
    queryFn: async () => (await supabase.from("biblioteca_artigos").select("id, descricao, unidade, tipo, categoria_id, subespecialidade_id").eq("ativo", true)).data as any[],
  });

  const espMap = useMemo(() => new Map(esps.map((e: any) => [e.id, e.nome])), [esps]);
  const subMap = useMemo(() => new Map(subs.map((s: any) => [s.id, s])), [subs]);
  const catMap = useMemo(() => new Map(cats.map((c: any) => [c.id, c])), [cats]);
  const artMap = useMemo(() => new Map(arts.map((a: any) => [a.id, a])), [arts]);

  const setOrcamentoUrl = (v: string) => {
    navigate({ to: "/motor-classificacao", search: v ? { orcamento: v } : { orcamento: "" }, replace: true });
  };

  const iniciar = async () => {
    if (!orcamento) return;
    setRunning(true);
    setProgress({ total: artigosCount, done: 0, classificados: 0, pendentes: 0, porAnalisar: artigosCount });
    try {
      await runClassificacao(orcamento, (snap) => setProgress(snap));
      toast.success("Classificação concluída");
      qc.invalidateQueries({ queryKey: ["cc-run", orcamento] });
      qc.invalidateQueries({ queryKey: ["cc-rows", orcamento] });
      qc.invalidateQueries({ queryKey: ["cc-classificacao-counts", orcamento] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const validar = async (row: ClsRow) => {
    if (!row.artigo_mestre_id) return toast.error("Atribui um Artigo Mestre antes de validar");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("classificacao_artigos").update({
      estado: "validado", validado_por: u.user?.id ?? null, validado_em: new Date().toISOString(),
    }).eq("id", row.id);
    if (error) return toast.error(error.message);
    await aprenderClassificacao(row.descricao_original, row.artigo_mestre_id);
    const espFinal = row.especialidade_id ? (espMap.get(row.especialidade_id) as string) ?? "—" : "—";
    const espSug = (row.candidatos?.[0] as any)?.keywords_hit?.find?.((h: any) => h.nivel === "especialidade")?.entidade_nome ?? null;
    await registarAprendizagem({
      descricaoOriginal: row.descricao_original,
      especialidadeSugerida: espSug,
      especialidadeFinal: espFinal,
      confiancaSugerida: row.confianca,
      obraId: obraIdAtual,
      acao: "validar",
    });
    toast.success("Validado e guardado na memória");
    qc.invalidateQueries({ queryKey: ["cc-rows"] });
    qc.invalidateQueries({ queryKey: ["cc-classificacao-counts"] });
  };

  const remover = async (row: ClsRow) => {
    const { error } = await supabase.from("classificacao_artigos").update({
      artigo_mestre_id: null, categoria_id: null, subespecialidade_id: null, especialidade_id: null,
      confianca: 0, estado: "sem_classificacao", metodo_match: "nenhum", motivo: "Removido manualmente",
      validado_por: null, validado_em: null,
    }).eq("id", row.id);
    if (error) return toast.error(error.message);
    const espSug = row.especialidade_id ? (espMap.get(row.especialidade_id) as string) ?? null : null;
    await registarAprendizagem({
      descricaoOriginal: row.descricao_original,
      especialidadeSugerida: espSug,
      especialidadeFinal: "(removido)",
      confiancaSugerida: row.confianca,
      obraId: obraIdAtual,
      acao: "remover",
    });
    toast.success("Classificação removida");
    qc.invalidateQueries({ queryKey: ["cc-rows"] });
    qc.invalidateQueries({ queryKey: ["cc-classificacao-counts"] });
  };

  const atribuir = async (row: ClsRow, artigoMestreId: string) => {
    const art: any = artMap.get(artigoMestreId);
    if (!art) return;
    const sub: any = subMap.get(art.subespecialidade_id);
    const espFinalId = sub?.especialidade_id ?? null;
    const { error } = await supabase.from("classificacao_artigos").update({
      artigo_mestre_id: artigoMestreId,
      categoria_id: art.categoria_id,
      subespecialidade_id: art.subespecialidade_id,
      especialidade_id: espFinalId,
      confianca: 100, estado: "classificado_auto", metodo_match: "manual",
      motivo: "Atribuído manualmente pelo utilizador",
    }).eq("id", row.id);
    if (error) return toast.error(error.message);
    const espSug = row.especialidade_id ? (espMap.get(row.especialidade_id) as string) ?? null : null;
    const espFinal = espFinalId ? (espMap.get(espFinalId) as string) ?? "—" : "—";
    await registarAprendizagem({
      descricaoOriginal: row.descricao_original,
      especialidadeSugerida: espSug,
      especialidadeFinal: espFinal,
      confiancaSugerida: row.confianca,
      obraId: obraIdAtual,
      acao: row.artigo_mestre_id === artigoMestreId ? "validar" : "corrigir",
    });
    toast.success("Artigo Mestre atribuído");
    qc.invalidateQueries({ queryKey: ["cc-rows"] });
    qc.invalidateQueries({ queryKey: ["cc-classificacao-counts"] });
    setDialogRow(null);
  };

  const stats = useMemo(() => {
    if (!run) return null;
    return {
      total: classCounts?.total ?? (run.total_artigos as number),
      auto: classCounts?.auto ?? ((run.auto_exato + run.auto_aprendido) as number),
      auto_exato: run.auto_exato as number,
      auto_aprendido: run.auto_aprendido as number,
      parcial: classCounts?.parcial ?? (run.parcial as number),
      sem: classCounts?.sem ?? (run.sem_classificacao as number),
      validados: classCounts?.validados ?? rows.filter((r) => r.estado === "validado").length,
    };
  }, [classCounts, run, rows]);

  return (
    <>
      <PageHeader
        title="Centro de Classificação Inteligente"
        subtitle="Analisa, explica e aprende com a classificação dos artigos do MQ"
        actions={
          run?.estado === "concluido" ? (
            <Button variant="outline" size="sm" onClick={iniciar} disabled={running} title="Aplica novas palavras-chave, regras, relações e Artigos Mestre">
              <Sparkles className="h-4 w-4 mr-1" /> Reexecutar Motor IA
            </Button>
          ) : null
        }
      />

      <div className="p-6 space-y-4">
        {/* Selector orçamento */}
        <Card className="bg-card border-border p-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1.5 min-w-[280px] flex-1">
            <label className="text-xs text-muted-foreground">Orçamento / Mapa de Quantidades</label>
            <Select value={orcamento || ""} onValueChange={setOrcamentoUrl}>
              <SelectTrigger><SelectValue placeholder="Selecionar orçamento..." /></SelectTrigger>
              <SelectContent>
                {orcamentos.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome} (v{o.versao})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {orcamento && run && (
            <div className="text-xs text-muted-foreground">
              Estado: <Badge variant="outline" className="ml-1">{run.estado}</Badge>
              {run.concluido_em && <span className="ml-2">Concluído {new Date(run.concluido_em).toLocaleString("pt-PT")}</span>}
            </div>
          )}
        </Card>

        {!orcamento && (
          <Card className="bg-card border-border p-12 text-center text-muted-foreground">
            Seleciona um orçamento para começar.
          </Card>
        )}

        {/* Estado pendente — sem run ainda */}
        {orcamento && !run && !running && (
          <Card className="bg-card border-border p-12 text-center space-y-4">
            <Sparkles className="h-12 w-12 mx-auto text-primary" />
            <h2 className="text-xl font-semibold">Pronto para classificar</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              O sistema vai analisar os <strong>{artigosCount}</strong> artigos importados e propor classificações
              com base na Biblioteca Mestra e nas validações anteriores. Vais poder rever, corrigir e validar cada resultado.
            </p>
            <Button size="lg" onClick={iniciar} disabled={!artigosCount} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Play className="h-4 w-4 mr-2" /> Iniciar Classificação
            </Button>
          </Card>
        )}

        {/* Em curso */}
        {running && (
          <Card className="bg-card border-border p-8 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <h3 className="font-semibold">A classificar artigos…</h3>
              </div>
              {progress && (
                <span className="text-sm font-mono text-muted-foreground tabular-nums">
                  {Math.round((progress.done / Math.max(1, progress.total)) * 100)}%
                </span>
              )}
            </div>
            {progress && (
              <>
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-semibold tabular-nums">{progress.total.toLocaleString("pt-PT")}</span> artigos
                </p>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-primary h-3 transition-all duration-300 ease-out"
                    style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md border border-border bg-background/40 p-3">
                    <div className="text-xs text-muted-foreground">classificados</div>
                    <div className="text-2xl font-semibold text-emerald-500 tabular-nums">
                      {progress.classificados.toLocaleString("pt-PT")}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-background/40 p-3">
                    <div className="text-xs text-muted-foreground">a rever</div>
                    <div className="text-2xl font-semibold text-amber-500 tabular-nums">
                      {progress.pendentes.toLocaleString("pt-PT")}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-background/40 p-3">
                    <div className="text-xs text-muted-foreground">por analisar</div>
                    <div className="text-2xl font-semibold text-muted-foreground tabular-nums animate-pulse">
                      {progress.porAnalisar.toLocaleString("pt-PT")}
                    </div>
                  </div>
                </div>
              </>
            )}
          </Card>
        )}

        {/* Concluído — resultados */}
        {orcamento && run?.estado === "concluido" && !running && stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <StatCard label="Total" value={stats.total} />
              <StatCard label="Validados" value={stats.validados} tone="green" />
              <StatCard label="Exato" value={stats.auto_exato} tone="blue" />
              <StatCard label="Aprendido" value={stats.auto_aprendido} tone="blue" sub={`${memoriaTotal.toLocaleString("pt-PT")} total na memória`} prefix="+" />
              <StatCard label="A rever" value={stats.parcial} tone="yellow" />
              <StatCard label="Sem classif." value={stats.sem} tone="muted" />
            </div>

            <Card className="bg-card border-border p-4 flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5 min-w-[180px]">
                <label className="text-xs text-muted-foreground">Filtrar estado</label>
                <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="sem_classificacao">Sem classificação</SelectItem>
                    <SelectItem value="necessita_revisao">Necessita revisão</SelectItem>
                    <SelectItem value="classificado_auto">Classificado auto</SelectItem>
                    <SelectItem value="validado">Validado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[240px]">
                <label className="text-xs text-muted-foreground">Pesquisar artigo</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Descrição..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
            </Card>

            <Card className="bg-card border-border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artigo Original</TableHead>
                      <TableHead>Classificação</TableHead>
                      <TableHead className="w-44">Resultado IA</TableHead>
                      <TableHead className="w-40">Confiança</TableHead>
                      <TableHead className="w-44">Próxima Ação</TableHead>
                      <TableHead className="w-32 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">A carregar…</TableCell></TableRow>}
                    {!isLoading && rows.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Sem resultados para os filtros.</TableCell></TableRow>
                    )}
                    {rows.map((r, index) => {
                      const art: any = r.artigo_mestre_id ? artMap.get(r.artigo_mestre_id) : null;
                      const espNome = r.especialidade_id ? espMap.get(r.especialidade_id) : null;
                      const subNome = r.subespecialidade_id ? (subMap.get(r.subespecialidade_id) as any)?.nome : null;
                      const catNome = r.categoria_id ? (catMap.get(r.categoria_id) as any)?.nome : null;
                      const trail = [espNome, subNome, catNome, art?.descricao].filter(Boolean) as string[];
                      const acao = calcularProximaAcao({ estado: r.estado, metodo: r.metodo_match, confianca: r.confianca, candidatos: r.candidatos });
                      const capitulo = r.orcamento_artigos?.capitulo ?? null;
                      const prevCapituloId = rows[index - 1]?.orcamento_artigos?.capitulo?.id ?? null;
                      const showCapitulo = !!capitulo && capitulo.id !== prevCapituloId;
                      const onAcao = () => {
                        if (acao.tipo === "aceitar") validar(r);
                        else if (acao.tipo === "corrigir" || acao.tipo === "escolher") setDialogRow(r);
                        else setPanelRow(r);
                      };
                      return (
                        <Fragment key={r.id}>
                          {showCapitulo && (
                            <TableRow className="bg-muted/60 hover:bg-muted/60">
                              <TableCell colSpan={6} className="py-2 text-xs font-semibold text-foreground">
                                {capitulo.codigo ? `${capitulo.codigo} — ` : ""}{capitulo.descricao ?? "Capítulo"}
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow className="cursor-pointer hover:bg-muted/30" onClick={() => setPanelRow(r)}>
                            <TableCell className="max-w-[280px]">
                              <div className="text-sm line-clamp-2">{r.descricao_original}</div>
                              <div className="text-[10px] text-muted-foreground">{r.unidade_original ?? ""} · qtd {r.quantidade_original ?? "—"}</div>
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              {trail.length === 0 ? (
                                <Badge variant="outline" className="text-muted-foreground">Sem destino</Badge>
                              ) : (
                                <div className="space-y-0.5">
                                  {trail.map((t, i) => (
                                    <div key={i} className="flex items-center gap-1 text-xs">
                                      {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                                      <span className={i === trail.length - 1 ? "font-medium" : "text-muted-foreground"}>{t}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell><ResultadoIABadge metodo={r.metodo_match} estado={r.estado} /></TableCell>
                            <TableCell><ConfiancaBar value={r.confianca} /></TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <ProximaAcaoChip acao={acao} onClick={onAcao} />
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="ghost" title="Pesquisar Artigo Mestre" onClick={() => setDialogRow(r)}>
                                  {r.artigo_mestre_id ? <Edit3 className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
                                </Button>
                                {r.estado !== "validado" && (
                                  <Button size="sm" variant="ghost" title="Validar" onClick={() => validar(r)} disabled={!r.artigo_mestre_id}>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {r.artigo_mestre_id && (
                                  <Button size="sm" variant="ghost" title="Remover" onClick={() => remover(r)}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        )}
      </div>

      <SearchBibliotecaDialog
        open={!!dialogRow} onClose={() => setDialogRow(null)}
        onPick={(artId) => dialogRow && atribuir(dialogRow, artId)}
        esps={esps} subs={subs} cats={cats} arts={arts}
        suggestion={dialogRow?.descricao_original ?? ""}
      />
      <ClassificacaoSidePanel
        row={panelRow as PanelRow | null}
        orcamentoId={orcamento || null}
        onClose={() => setPanelRow(null)}
        espMap={espMap as Map<string, string>}
        subMap={subMap as Map<string, any>}
        catMap={catMap as Map<string, any>}
        artMap={artMap as Map<string, any>}
        onAceitar={(r) => { validar(r as any); setPanelRow(null); }}
        onCorrigir={(r) => { setDialogRow(r as any); }}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["cc-rows"] })}
      />
    </>
  );
}



function StatCard({ label, value, tone, sub, prefix }: { label: string; value: number; tone?: "green" | "blue" | "yellow" | "muted"; sub?: string; prefix?: string }) {
  const cls =
    tone === "green" ? "text-green-600 dark:text-green-400" :
    tone === "blue" ? "text-blue-600 dark:text-blue-400" :
    tone === "yellow" ? "text-yellow-600 dark:text-yellow-400" :
    tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <Card className="bg-card border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${cls}`}>{prefix}{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function SearchBibliotecaDialog({
  open, onClose, onPick, esps, subs, cats, arts, suggestion,
}: {
  open: boolean; onClose: () => void; onPick: (id: string) => void;
  esps: any[]; subs: any[]; cats: any[]; arts: any[]; suggestion: string;
}) {
  const [espId, setEspId] = useState<string>("all");
  const [subId, setSubId] = useState<string>("all");
  const [catId, setCatId] = useState<string>("all");
  const [q, setQ] = useState(suggestion);

  const filteredSubs = subs.filter((s) => espId === "all" || s.especialidade_id === espId);
  const filteredCats = cats.filter((c) => {
    if (subId !== "all") return c.subespecialidade_id === subId;
    if (espId !== "all") return filteredSubs.some((s) => s.id === c.subespecialidade_id);
    return true;
  });
  const filteredArts = arts.filter((a) => {
    if (catId !== "all" && a.categoria_id !== catId) return false;
    if (subId !== "all" && a.subespecialidade_id !== subId) return false;
    if (espId !== "all") {
      const sub = subs.find((s) => s.id === a.subespecialidade_id);
      if (!sub || sub.especialidade_id !== espId) return false;
    }
    if (q.trim() && !a.descricao.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  }).slice(0, 200);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Pesquisar na Biblioteca Mestra</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Select value={espId} onValueChange={(v) => { setEspId(v); setSubId("all"); setCatId("all"); }}>
            <SelectTrigger><SelectValue placeholder="Especialidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas especialidades</SelectItem>
              {esps.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={subId} onValueChange={(v) => { setSubId(v); setCatId("all"); }}>
            <SelectTrigger><SelectValue placeholder="Subespecialidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas subespecialidades</SelectItem>
              {filteredSubs.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={catId} onValueChange={setCatId}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {filteredCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Pesquisar artigo..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="border border-border rounded-md overflow-auto flex-1 mt-2">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Descrição</TableHead><TableHead className="w-20">Un.</TableHead>
              <TableHead className="w-24">Tipo</TableHead><TableHead className="w-20"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredArts.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sem resultados</TableCell></TableRow>}
              {filteredArts.map((a) => (
                <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onPick(a.id)}>
                  <TableCell className="text-sm">{a.descricao}</TableCell>
                  <TableCell className="text-sm">{a.unidade ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.tipo}</TableCell>
                  <TableCell><Button size="sm" variant="outline">Selecionar</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
