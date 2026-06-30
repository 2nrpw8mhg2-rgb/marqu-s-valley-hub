import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  previewKnowledgeScope,
  startKnowledgeRun,
  getKnowledgeRunStatus,
  cancelKnowledgeRun,
} from "@/lib/biblioteca-mestra/knowledge-builder.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, Play, Square, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { KnowledgeRunReport } from "@/components/biblioteca-mestra/KnowledgeRunReport";

export const Route = createFileRoute("/_app/biblioteca-mestra/knowledge-builder")({
  head: () => ({ meta: [{ title: "Knowledge Builder — Biblioteca Mestra" }] }),
  component: KnowledgeBuilderPage,
});

type ScopeTipo = "todas" | "especialidade" | "subespecialidade" | "artigo";
type Modo = "manter" | "novos" | "regenerar";

function KnowledgeBuilderPage() {
  const qc = useQueryClient();
  const [scopeTipo, setScopeTipo] = useState<ScopeTipo>("especialidade");
  const [espId, setEspId] = useState<string>("");
  const [subId, setSubId] = useState<string>("");
  const [artId, setArtId] = useState<string>("");
  const [modo, setModo] = useState<Modo>("novos");
  const [runId, setRunId] = useState<string | null>(null);

  const previewFn = useServerFn(previewKnowledgeScope);
  const startFn = useServerFn(startKnowledgeRun);
  const statusFn = useServerFn(getKnowledgeRunStatus);
  const cancelFn = useServerFn(cancelKnowledgeRun);

  // load especialidades
  const { data: especialidades = [] } = useQuery({
    queryKey: ["kb-especialidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_especialidades")
        .select("id, codigo, nome")
        .eq("ativa", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: subespecialidades = [] } = useQuery({
    queryKey: ["kb-subesp", espId],
    queryFn: async () => {
      if (!espId) return [];
      const { data, error } = await supabase
        .from("biblioteca_subespecialidades")
        .select("id, codigo, nome")
        .eq("especialidade_id", espId)
        .eq("ativa", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!espId,
  });

  const { data: artigos = [] } = useQuery({
    queryKey: ["kb-artigos", subId],
    queryFn: async () => {
      if (!subId) return [];
      const { data, error } = await supabase
        .from("biblioteca_artigos")
        .select("id, codigo, descricao")
        .eq("subespecialidade_id", subId)
        .eq("ativo", true)
        .order("codigo");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!subId && scopeTipo === "artigo",
  });

  const { data: activeRun } = useQuery({
    queryKey: ["kb-active-run"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_knowledge_run")
        .select("id, estado")
        .in("estado", ["pendente", "em_curso"])
        .order("iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    refetchInterval: runId ? false : 4000,
  });

  useEffect(() => {
    if (!runId && activeRun?.id) setRunId(activeRun.id as string);
  }, [activeRun, runId]);

  const scope = useMemo(() => {
    if (scopeTipo === "especialidade" && espId) return { tipo: "especialidade" as const, especialidadeId: espId };
    if (scopeTipo === "subespecialidade" && subId) return { tipo: "subespecialidade" as const, subespecialidadeId: subId };
    if (scopeTipo === "artigo" && artId) return { tipo: "artigo" as const, artigoId: artId };
    return null;
  }, [scopeTipo, espId, subId, artId]);

  const preview = useMutation({
    mutationFn: async () => {
      if (!scope) throw new Error("Seleciona um âmbito válido");
      return await previewFn({ data: { scope } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const start = useMutation({
    mutationFn: async () => {
      if (!scope) throw new Error("Seleciona um âmbito válido");
      const res = await startFn({ data: { scope, modo } });
      return res.runId as string;
    },
    onSuccess: (id) => {
      setRunId(id);
      toast.success("Knowledge Builder iniciado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: status } = useQuery({
    queryKey: ["kb-run", runId],
    queryFn: async () => (runId ? await statusFn({ data: { runId } }) : null),
    enabled: !!runId,
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.estado;
      return s === "em_curso" || s === "pendente" ? 1500 : false;
    },
  });

  useEffect(() => {
    if (status && (status as any).estado === "concluido") {
      qc.invalidateQueries({ queryKey: ["bm-conhecimento"] });
    }
  }, [status, qc]);

  const cancel = useMutation({
    mutationFn: async () => runId && (await cancelFn({ data: { runId } })),
    onSuccess: () => toast.info("Pedido de cancelamento enviado"),
  });

  const s = status as any;
  const pct = s?.total_artigos ? Math.round((s.processados / s.total_artigos) * 100) : 0;
  const isRunning = s?.estado === "em_curso" || s?.estado === "pendente";

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <PageHeader
        title="Knowledge Builder"
        subtitle="Enriquece a Biblioteca Mestra com IA, aprendendo a partir dos mapas de quantidades reais."
      />


      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Âmbito</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={scopeTipo} onValueChange={(v) => setScopeTipo(v as ScopeTipo)} className="space-y-2">
              <div className="flex items-center gap-2 opacity-50">
                <RadioGroupItem value="todas" id="r-todas" disabled />
                <Label htmlFor="r-todas">Toda a Biblioteca <span className="text-xs text-muted-foreground">(disponível após validação)</span></Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="especialidade" id="r-esp" />
                <Label htmlFor="r-esp">Uma Especialidade</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="subespecialidade" id="r-sub" />
                <Label htmlFor="r-sub">Uma Subespecialidade</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="artigo" id="r-art" />
                <Label htmlFor="r-art">Um único Artigo Mestre</Label>
              </div>
            </RadioGroup>

            {scopeTipo !== "todas" && (
              <div className="space-y-3 pt-2 border-t">
                <div>
                  <Label className="text-xs">Especialidade</Label>
                  <Select value={espId} onValueChange={(v) => { setEspId(v); setSubId(""); setArtId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                    <SelectContent>
                      {especialidades.map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>{e.codigo} — {e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(scopeTipo === "subespecialidade" || scopeTipo === "artigo") && (
                  <div>
                    <Label className="text-xs">Subespecialidade</Label>
                    <Select value={subId} onValueChange={(v) => { setSubId(v); setArtId(""); }} disabled={!espId}>
                      <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                      <SelectContent>
                        {subespecialidades.map((e: any) => (
                          <SelectItem key={e.id} value={e.id}>{e.codigo ?? ""} — {e.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {scopeTipo === "artigo" && (
                  <div>
                    <Label className="text-xs">Artigo</Label>
                    <Select value={artId} onValueChange={setArtId} disabled={!subId}>
                      <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                      <SelectContent>
                        {artigos.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>{a.codigo ?? ""} — {a.descricao}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Modo de execução</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={modo} onValueChange={(v) => setModo(v as Modo)} className="space-y-2">
              <div className="flex items-start gap-2">
                <RadioGroupItem value="manter" id="m-manter" className="mt-1" />
                <Label htmlFor="m-manter" className="font-normal">
                  <span className="font-medium">Manter existente</span><br />
                  <span className="text-xs text-muted-foreground">Só processa artigos sem qualquer conhecimento</span>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="novos" id="m-novos" className="mt-1" />
                <Label htmlFor="m-novos" className="font-normal">
                  <span className="font-medium">Adicionar apenas novos</span><br />
                  <span className="text-xs text-muted-foreground">Preserva tudo o que existe e acrescenta termos novos</span>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="regenerar" id="m-reg" className="mt-1" />
                <Label htmlFor="m-reg" className="font-normal">
                  <span className="font-medium">Regenerar tudo (apenas IA)</span><br />
                  <span className="text-xs text-muted-foreground">Apaga termos de origem IA e gera de novo; preserva os do utilizador</span>
                </Label>
              </div>
            </RadioGroup>

            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => preview.mutate()} disabled={!scope || preview.isPending}>
                <Search className="h-4 w-4 mr-2" />
                Analisar fontes
              </Button>
              <Button onClick={() => start.mutate()} disabled={!scope || start.isPending || isRunning} className="ml-auto">
                <Sparkles className="h-4 w-4 mr-2" />
                Enriquecer com IA
              </Button>
            </div>

            {preview.data && (
              <div className="rounded-md bg-muted/40 p-3 text-sm grid grid-cols-3 gap-3">
                <div><div className="text-xs text-muted-foreground">Artigos</div><div className="text-xl font-semibold tabular-nums">{preview.data.artigos}</div></div>
                <div><div className="text-xs text-muted-foreground">Classif. reais</div><div className="text-xl font-semibold tabular-nums">{preview.data.classificacoesReais}</div></div>
                <div><div className="text-xs text-muted-foreground">Sem dados MQ</div><div className="text-xl font-semibold tabular-nums">{preview.data.artigosSemDados}</div></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {s && s.estado === "concluido" && (s.resumo as any)?.termos && runId && (
        <KnowledgeRunReport
          runId={runId}
          report={s.resumo as any}
          onClose={() => setRunId(null)}
          onRegenerar={() => {
            setModo("regenerar");
            setRunId(null);
            setTimeout(() => start.mutate(), 50);
          }}
        />
      )}

      {s && !(s.estado === "concluido" && (s.resumo as any)?.termos) && (

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="h-4 w-4" />
              Progresso
              <Badge variant={s.estado === "concluido" ? "default" : s.estado === "erro" ? "destructive" : "secondary"}>
                {s.estado}
              </Badge>
            </CardTitle>
            {isRunning && (
              <Button variant="outline" size="sm" onClick={() => cancel.mutate()}>
                <Square className="h-3.5 w-3.5 mr-1" />Cancelar
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={pct} />
            <div className="text-xs text-muted-foreground">
              {s.processados} / {s.total_artigos} artigos · {s.saltados} saltados · {s.falhados} falhados
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-sm">
              {[
                ["Palavras-chave", "palavra_chave"],
                ["Sinónimos", "sinonimo"],
                ["Expressões", "expressao"],
                ["Materiais", "material"],
                ["Unidades", "unidade_compativel"],
                ["Capítulos", "capitulo_tipico"],
                ["Exemplos", "exemplo_real"],
                ["Excluídas", "negativo_incompativel"],
              ].map(([label, key]) => (
                <div key={key} className="rounded border p-2 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
                  <div className="text-lg font-semibold tabular-nums">{(s.counts ?? {})[key] ?? 0}</div>
                </div>
              ))}
            </div>
            {s.ultimo_artigo && (
              <div className="text-xs"><span className="text-muted-foreground">Último: </span>{s.ultimo_artigo}</div>
            )}
            {s.erro_msg && (
              <div className="text-xs text-destructive">Erro: {s.erro_msg}</div>
            )}
            <div className="rounded-md border bg-muted/20 max-h-64 overflow-y-auto p-2 font-mono text-[11px] space-y-0.5">
              {((s.log as any[]) ?? []).slice().reverse().map((l, i) => (
                <div key={i}><span className="text-muted-foreground">{new Date(l.ts).toLocaleTimeString()}</span> {l.msg}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
