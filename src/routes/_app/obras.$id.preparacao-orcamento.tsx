import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileSpreadsheet,
  Brain,
  ListChecks,
  ShieldCheck,
  Loader2,
  ArrowRight,
  ArrowLeft,
  FileText,
  AlertTriangle,
  Search,
  ChevronRight,
  Edit3,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { detectColumns, parseRows, type ParsedRow } from "@/lib/mq-parser";
import {
  runClassificacao,
  aprenderClassificacao,
  registarAprendizagem,
  type ClassificacaoProgress,
  type Candidato,
  type Metodo,
} from "@/lib/classificacao/engine";
import { ResultadoIABadge } from "@/components/classificacao/ResultadoIABadge";
import { ConfiancaBar } from "@/components/classificacao/ConfiancaBar";
import { ProximaAcaoChip, calcularProximaAcao } from "@/components/classificacao/ProximaAcaoChip";
import { ClassificacaoSidePanel, type PanelRow } from "@/components/classificacao/ClassificacaoSidePanel";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_app/obras/$id/preparacao-orcamento")({
  component: PreparacaoOrcamentoWizard,
});

// ----- Tipos de documentação esperados na obra (para o checklist) -----
const CHECKLIST = [
  { key: "arquitetura", label: "Arquitetura", folders: ["Arquitetura"], tipos: ["projeto"] },
  { key: "estruturas", label: "Estruturas", folders: ["Estruturas", "Especialidades"], tipos: ["projeto"] },
  { key: "especialidades", label: "Especialidades", folders: ["Especialidades"], tipos: ["projeto"] },
  { key: "caderno", label: "Caderno de Encargos", folders: ["Caderno de Encargos"], tipos: ["caderno_encargos"] },
  { key: "mq", label: "Mapa de Quantidades", folders: ["Mapa de Quantidades"], tipos: ["mq"], required: true },
  { key: "memoria", label: "Memória Descritiva", folders: ["Documentação", "Elementos de Concurso"], tipos: ["projeto", "outro"] },
  { key: "pecas", label: "Peças Desenhadas", folders: ["Arquitetura", "Especialidades", "Elementos de Concurso"], tipos: ["projeto"] },
] as const;

const PASSOS = [
  { idx: 0, label: "Documentação", icon: ClipboardCheck },
  { idx: 1, label: "Selecionar MQT", icon: FileSpreadsheet },
  { idx: 2, label: "Leitura IA", icon: Brain },
  { idx: 3, label: "Classificação", icon: ListChecks },
  { idx: 4, label: "Validação", icon: ShieldCheck },
];

function PreparacaoOrcamentoWizard() {
  const { id: obraId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Rascunho técnico ativo desta obra (se existir)
  const { data: rascunho, refetch: refetchRascunho } = useQuery({
    queryKey: ["prep-orc", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("obra_id", obraId)
        .eq("tipo", "rascunho_tecnico")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [passo, setPasso] = useState<number>(0);
  const [forcarReleituraMQT, setForcarReleituraMQT] = useState(false);
  useEffect(() => {
    if (rascunho) setPasso((p) => Math.max(p, rascunho.wizard_passo ?? 0));
  }, [rascunho]);

  // Documentação da obra
  const { data: doc } = useQuery({
    queryKey: ["prep-doc-obra", obraId],
    queryFn: async () => {
      const [{ data: pastas }, { data: docs }] = await Promise.all([
        supabase.from("documento_pastas").select("id, nome, parent_id").eq("obra_id", obraId),
        supabase.from("documentos").select("id, nome, tipo, pasta_id, storage_path, created_at, tamanho").eq("obra_id", obraId),
      ]);
      return { pastas: pastas ?? [], docs: docs ?? [] };
    },
  });

  const checklistRows = useMemo(() => {
    const pastas = (doc?.pastas ?? []) as { id: string; nome: string; parent_id: string | null }[];
    const docs = (doc?.docs ?? []) as { id: string; nome: string; tipo: string; pasta_id: string | null; created_at: string; tamanho: number | null }[];
    return CHECKLIST.map((c) => {
      const pastaIds: string[] = pastas
        .filter((p) => c.folders.some((f) => p.nome?.toLowerCase() === f.toLowerCase()))
        .map((p) => p.id);
      const matched = docs
        .filter((d) => (d.pasta_id && pastaIds.includes(d.pasta_id)) || (c.tipos as readonly string[]).includes(d.tipo))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { ...c, count: matched.length, present: matched.length > 0, docs: matched };
    });
  }, [doc]);



  // Pasta "Mapa de Quantidades" desta obra — única fonte autorizada de MQT
  const mqPastaInfo = useMemo(() => {
    const pastas = (doc?.pastas ?? []) as { id: string; nome: string }[];
    const found = pastas.find((p) => p.nome?.trim().toLowerCase() === "mapa de quantidades");
    return { existe: !!found, id: found?.id ?? null };
  }, [doc]);

  const mqDocs = useMemo(() => {
    if (!mqPastaInfo.id) return [];
    const docs = (doc?.docs ?? []) as { id: string; nome: string; tipo: string; pasta_id: string | null; storage_path: string; created_at: string; tamanho: number | null }[];
    return docs
      .filter((d) => d.pasta_id === mqPastaInfo.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [doc, mqPastaInfo.id]);

  // Documento MQT em uso pelo rascunho — só conta se ainda existir na pasta correta desta obra.
  const mqAtivo = useMemo(() => {
    if (!rascunho?.mq_documento_id) return null;
    return mqDocs.find((d) => d.id === rascunho.mq_documento_id) ?? null;
  }, [rascunho?.mq_documento_id, mqDocs]);

  const origemInvalida = !!rascunho?.mq_documento_id && !!doc && !mqAtivo;

  const { data: leituraMQT } = useQuery({
    queryKey: ["prep-leitura-mq", rascunho?.id, mqAtivo?.id],
    queryFn: async () => {
      if (!rascunho?.id || !mqAtivo) return { artigos: 0, ultimaLeitura: null as string | null };
      const [{ count }, { data: ultimo }] = await Promise.all([
        supabase.from("orcamento_artigos").select("id", { count: "exact", head: true }).eq("orcamento_id", rascunho.id),
        supabase.from("orcamento_artigos").select("created_at").eq("orcamento_id", rascunho.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return { artigos: count ?? 0, ultimaLeitura: (ultimo as any)?.created_at ?? null };
    },
    enabled: !!rascunho?.id && !!mqAtivo,
  });

  const leituraDesatualizada = !!mqAtivo && !!leituraMQT?.ultimaLeitura && new Date(leituraMQT.ultimaLeitura).getTime() < new Date(mqAtivo.created_at).getTime();
  const leituraEmFalta = !!mqAtivo && !!leituraMQT && leituraMQT.artigos === 0;

  // Se a origem ficou inválida (doc movido/apagado), forçar regresso ao Passo 1.
  useEffect(() => {
    if (origemInvalida) setPasso(1);
  }, [origemInvalida]);

  // Se o rascunho ainda tem artigos/classificações lidos antes do MQT selecionado, não deixar avançar com dados antigos.
  useEffect(() => {
    if ((leituraDesatualizada || leituraEmFalta) && passo > 2) setPasso(2);
  }, [leituraDesatualizada, leituraEmFalta, passo]);


  async function persistPasso(p: number) {
    if (!rascunho) return;
    if ((rascunho.wizard_passo ?? 0) >= p) return;
    await supabase.from("orcamentos").update({ wizard_passo: p }).eq("id", rascunho.id);
    qc.invalidateQueries({ queryKey: ["prep-orc", obraId] });
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <header>
        <h2 className="text-xl font-semibold">Preparação de Orçamento</h2>
        <p className="text-sm text-muted-foreground mt-1">
          A documentação da obra já foi carregada na Gestão Documental. Aqui apenas selecionamos o MQT a preparar — não há
          orçamento final nesta fase, apenas um rascunho técnico interno até receção das propostas dos subempreiteiros.
        </p>
      </header>

      {/* Origem do MQT — sempre visível */}
      {mqAtivo ? (
        <Card className="p-3 flex items-center justify-between gap-3 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-3 min-w-0">
            <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">A ler de Documentos → Mapa de Quantidades</div>
              <div className="text-sm font-medium truncate">{mqAtivo.nome}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(mqAtivo.created_at).toLocaleString("pt-PT")}
                {mqAtivo.tamanho ? ` · ${(mqAtivo.tamanho / 1024).toFixed(0)} KB` : ""}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setForcarReleituraMQT(true); setPasso(1); }}>Trocar MQT</Button>
        </Card>
      ) : origemInvalida ? (
        <Card className="p-3 border-destructive/40 bg-destructive/10 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            O MQT deste rascunho já não está disponível na pasta «Mapa de Quantidades» desta obra.
            Seleciona o MQT atual para continuar.
          </div>
        </Card>
      ) : null}

      {leituraDesatualizada && (
        <Card className="p-3 border-amber-500/40 bg-amber-500/10 text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            A leitura/classificação guardada é anterior ao MQT selecionado. Re-lê este MQT antes de continuar.
          </div>
        </Card>
      )}

      <Stepper passo={passo} setPasso={setPasso} maxPasso={rascunho?.wizard_passo ?? 0} />

      {passo === 0 && (
        <Passo0
          rows={checklistRows}
          obraId={obraId}
          onAvancar={() => setPasso(1)}
        />

      )}
      {passo === 1 && (
        <Passo1
          obraId={obraId}
          rascunho={rascunho}
          mqDocs={mqDocs}
          pastaExiste={mqPastaInfo.existe}
          forcarReleitura={forcarReleituraMQT}
          onSelecionado={async () => {
            await qc.invalidateQueries({ queryKey: ["prep-passo2"] });
            await qc.invalidateQueries({ queryKey: ["prep-passo3"] });
            await qc.invalidateQueries({ queryKey: ["prep-passo4-rows"] });
            await qc.invalidateQueries({ queryKey: ["prep-passo4-stats"] });
            await qc.invalidateQueries({ queryKey: ["artigo-original"] });
            await qc.invalidateQueries({ queryKey: ["cc-run"] });
            await qc.invalidateQueries({ queryKey: ["cc-rows"] });
            await qc.invalidateQueries({ queryKey: ["cc-artigos-count"] });
            await qc.invalidateQueries({ queryKey: ["prep-leitura-mq"] });
            await refetchRascunho();
            setForcarReleituraMQT(false);
            await persistPasso(1);
            setPasso(2);
          }}
        />
      )}
      {passo === 2 && rascunho && (
        <Passo2 rascunho={rascunho} mqAtivo={mqAtivo} obraId={obraId} onVoltar={() => setPasso(1)} onConcluido={async () => { await persistPasso(2); setPasso(3); }} />
      )}
      {passo === 3 && rascunho && (
        <Passo3 rascunho={rascunho} onConcluido={async () => { await persistPasso(3); setPasso(4); }} />
      )}
      {passo === 4 && rascunho && (
        <Passo4
          rascunho={rascunho}
          onAbrirValidacao={() => navigate({ to: "/motor-classificacao", search: { orcamento: rascunho.id } as any })}
          onConcluir={async () => { await persistPasso(4); toast.success("Rascunho técnico marcado como pronto."); }}
        />
      )}
    </div>
  );
}

// =========================================================================
//  Stepper
// =========================================================================
function Stepper({ passo, setPasso, maxPasso }: { passo: number; setPasso: (n: number) => void; maxPasso: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto">
      {PASSOS.map((p, i) => {
        const Icon = p.icon;
        const ativo = i === passo;
        const concluido = i < maxPasso || i < passo;
        const acessivel = i <= Math.max(maxPasso, passo);
        return (
          <li key={p.idx} className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => acessivel && setPasso(i)}
              disabled={!acessivel}
              className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
                ativo
                  ? "border-primary bg-primary/10 text-foreground"
                  : concluido
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-border bg-muted/30 text-muted-foreground"
              } ${acessivel ? "hover:border-primary cursor-pointer" : "cursor-not-allowed opacity-60"}`}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{i}. {p.label}</span>
            </button>
            {i < PASSOS.length - 1 && <span className="text-muted-foreground/40">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

// =========================================================================
//  Passo 0 — Documentação disponível
// =========================================================================
type ChecklistRow = {
  key: string;
  label: string;
  count: number;
  present: boolean;
  required?: boolean;
  docs: { id: string; nome: string; tipo: string; created_at: string; tamanho: number | null }[];
};

function Passo0({
  rows,
  obraId,
  onAvancar,
}: {
  rows: ChecklistRow[];
  obraId: string;
  onAvancar: () => void;
}) {
  const mqRow = rows.find((r) => r.key === "mq");
  const podeAvancar = !!mqRow?.present;
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start gap-3">
        <ClipboardCheck className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <h3 className="font-semibold">Documentação disponível na obra</h3>
          <p className="text-sm text-muted-foreground">
            Verificação automática contra a Gestão Documental. Clica em cada categoria para ver os ficheiros encontrados.
            Para iniciar a preparação, basta existir um Mapa de Quantidades.
          </p>
        </div>
      </div>
      <ul className="divide-y divide-border border border-border rounded-md overflow-hidden">
        {rows.map((r) => {
          const isOpen = !!open[r.key];
          return (
            <li key={r.key} className="bg-background">
              <button
                type="button"
                onClick={() => r.present && setOpen((s) => ({ ...s, [r.key]: !s[r.key] }))}
                disabled={!r.present}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                  r.present ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"
                }`}
              >
                <div className="flex items-center gap-3">
                  {r.present ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : r.required ? (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/50" />
                  )}
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {r.label}
                      {r.required && <span className="text-[10px] uppercase tracking-wider text-amber-600">obrigatório</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.present ? `${r.count} ficheiro(s) encontrados${r.present ? " — clica para ver" : ""}` : "Sem ficheiros nesta categoria"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={r.present ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-border text-muted-foreground"}>
                    {r.present ? "OK" : "Em falta"}
                  </Badge>
                  {r.present && (
                    <span className={`text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                  )}
                </div>
              </button>
              {isOpen && r.present && (
                <div className="px-4 pb-3 pt-1 bg-muted/20 border-t border-border/60">
                  <ul className="divide-y divide-border/60">
                    {r.docs.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{d.nome}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {new Date(d.created_at).toLocaleString("pt-PT")}
                              {d.tamanho ? ` · ${(d.tamanho / 1024).toFixed(0)} KB` : ""}
                              {d.tipo ? ` · ${d.tipo.replace("_", " ")}` : ""}
                            </div>
                          </div>
                        </div>
                        <a
                          href={`/obras/${obraId}/documentos`}
                          className="text-xs text-primary hover:underline shrink-0"
                        >
                          Abrir em Documentos
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end">
        <Button onClick={onAvancar} disabled={!podeAvancar} className="bg-primary text-primary-foreground hover:bg-primary/90">
          Iniciar Preparação do Orçamento <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </Card>
  );
}

// =========================================================================
//  Passo 1 — Selecionar MQT da Gestão Documental
// =========================================================================
function Passo1({
  obraId,
  rascunho,
  mqDocs,
  pastaExiste,
  forcarReleitura,
  onSelecionado,
}: {
  obraId: string;
  rascunho: any;
  mqDocs: { id: string; nome: string; storage_path: string; created_at: string; tamanho: number | null }[];
  pastaExiste: boolean;
  forcarReleitura: boolean;
  onSelecionado: () => Promise<void>;
}) {
  const [escolhido, setEscolhido] = useState<string | null>(rascunho?.mq_documento_id ?? null);
  const [revisao, setRevisao] = useState<string>(rascunho?.mq_revisao ?? "");
  const [working, setWorking] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    setEscolhido(rascunho?.mq_documento_id ?? null);
    setRevisao(rascunho?.mq_revisao ?? "");
  }, [rascunho?.mq_documento_id, rascunho?.mq_revisao]);

  const selecionarDoc = (docId: string) => {
    setEscolhido(docId);
    if (docId !== rascunho?.mq_documento_id) setRevisao("");
  };

  async function confirmar() {
    if (!escolhido) return;
    setWorking(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const docNome = mqDocs.find((m) => m.id === escolhido)?.nome ?? "MQT";
      const revisaoLimpa = revisao.trim() || null;
      if (rascunho) {
        const mudouMQT = rascunho.mq_documento_id !== escolhido;
        const deveReiniciarMQT = mudouMQT || forcarReleitura;

        if (deveReiniciarMQT) {
          const { error: clsErr } = await supabase.from("classificacao_artigos").delete().eq("orcamento_id", rascunho.id);
          if (clsErr) throw clsErr;
          const { error: artsErr } = await supabase.from("orcamento_artigos").delete().eq("orcamento_id", rascunho.id);
          if (artsErr) throw artsErr;
          const { error: capsErr } = await supabase.from("orcamento_capitulos").delete().eq("orcamento_id", rascunho.id);
          if (capsErr) throw capsErr;
          const { error: runsErr } = await supabase.from("orcamento_classificacao_run").delete().eq("orcamento_id", rascunho.id);
          if (runsErr) throw runsErr;
          const { error: alertasErr } = await supabase.from("orcamento_alertas_tecnicos").delete().eq("orcamento_id", rascunho.id);
          if (alertasErr) throw alertasErr;
        }

        // Atualiza rascunho existente
        const { error } = await supabase
          .from("orcamentos")
          .update({
            nome: `Rascunho técnico — ${docNome}`,
            mq_documento_id: escolhido,
            mq_revisao: revisaoLimpa,
            wizard_passo: 1,
            estado_mq: deveReiniciarMQT ? "importado" : rascunho.estado_mq,
          })
          .eq("id", rascunho.id);
        if (error) throw error;

        qc.setQueryData(["prep-orc", obraId], {
          ...rascunho,
          nome: `Rascunho técnico — ${docNome}`,
          mq_documento_id: escolhido,
          mq_revisao: revisaoLimpa,
          wizard_passo: 1,
          estado_mq: deveReiniciarMQT ? "importado" : rascunho.estado_mq,
        });
      } else {
        // Cria rascunho técnico
        const { data: existentes } = await supabase
          .from("orcamentos")
          .select("versao")
          .eq("obra_id", obraId)
          .order("versao", { ascending: false })
          .limit(1);
        const proxVersao = ((existentes?.[0]?.versao as number | undefined) ?? 0) + 1;
        const versaoLabel = `v${proxVersao}`;
        const { error } = await supabase.from("orcamentos").insert({
          obra_id: obraId,
          nome: `Rascunho técnico ${versaoLabel} — ${docNome}`,
          versao: proxVersao,
          versao_label: versaoLabel,
          estado: "rascunho",
          estado_mq: "importado",
          tipo: "rascunho_tecnico",
          wizard_passo: 1,
          mq_documento_id: escolhido,
          mq_revisao: revisaoLimpa,
          created_by: u.user?.id ?? null,
        });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["prep-orc", obraId] });
      await qc.invalidateQueries({ queryKey: ["prep-passo2"] });
      await qc.invalidateQueries({ queryKey: ["prep-passo3"] });
      await qc.invalidateQueries({ queryKey: ["prep-passo4-rows"] });
      await qc.invalidateQueries({ queryKey: ["prep-passo4-stats"] });
      await onSelecionado();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setWorking(false);
    }
  }

  if (!mqDocs.length) {
    return (
      <Card className="p-8 text-center space-y-3">
        <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/60" />
        <h3 className="font-semibold">
          {pastaExiste ? "Pasta «Mapa de Quantidades» vazia" : "Pasta «Mapa de Quantidades» não existe"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {pastaExiste
            ? "A pasta «Mapa de Quantidades» desta obra está vazia. Adiciona o ficheiro MQT na Gestão Documental."
            : "Cria a pasta «Mapa de Quantidades» na Gestão Documental desta obra e coloca lá o ficheiro MQT."}
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={`/obras/${obraId}/documentos`}>Abrir Documentos da obra</a>
        </Button>
      </Card>
    );
  }


  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start gap-3">
        <FileSpreadsheet className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <h3 className="font-semibold">Selecionar MQT</h3>
          <p className="text-sm text-muted-foreground">
            Os MQT são carregados na Gestão Documental. Escolhe a revisão que queres preparar agora — podes mudar mais tarde.
          </p>
        </div>
      </div>

      <ul className="divide-y divide-border border border-border rounded-md overflow-hidden">
        {mqDocs.map((d) => {
          const sel = escolhido === d.id;
          return (
            <li key={d.id}>
              <button
                onClick={() => selecionarDoc(d.id)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                  sel ? "bg-primary/10 border-l-2 border-primary" : "bg-background hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">{d.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleString("pt-PT")}
                      {d.tamanho ? ` · ${(d.tamanho / 1024).toFixed(0)} KB` : ""}
                    </div>
                  </div>
                </div>
                {sel && <CheckCircle2 className="h-5 w-5 text-primary" />}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Etiqueta de revisão (opcional)</label>
          <input
            value={revisao}
            onChange={(e) => setRevisao(e.target.value)}
            placeholder="ex.: Rev A, Final, …"
            className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
          />
        </div>
        <Button onClick={confirmar} disabled={!escolhido || working} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {working && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Avançar para leitura <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </Card>
  );
}

// =========================================================================
//  Passo 2 — Leitura IA do MQT (download + parse + insert imutável)
// =========================================================================
function Passo2({
  rascunho,
  mqAtivo,
  obraId,
  onVoltar,
  onConcluido,
}: {
  rascunho: any;
  mqAtivo: { id: string; nome: string; storage_path: string; created_at: string; tamanho: number | null } | null;
  obraId: string;
  onVoltar: () => void;
  onConcluido: () => Promise<void>;
}) {
  const qc = useQueryClient();
  const [working, setWorking] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { data: status, refetch } = useQuery({
    queryKey: ["prep-passo2", rascunho.id, mqAtivo?.id],
    queryFn: async () => {
      const [{ count: artigos }, { count: caps }, { data: ultimo }] = await Promise.all([
        supabase.from("orcamento_artigos").select("id", { count: "exact", head: true }).eq("orcamento_id", rascunho.id),
        supabase.from("orcamento_capitulos").select("id", { count: "exact", head: true }).eq("orcamento_id", rascunho.id),
        supabase.from("orcamento_artigos").select("created_at").eq("orcamento_id", rascunho.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const ultimaLeitura = (ultimo as any)?.created_at ?? null;
      const desatualizado = !!mqAtivo?.created_at && !!ultimaLeitura && new Date(ultimaLeitura).getTime() < new Date(mqAtivo.created_at).getTime();
      return {
        artigos: desatualizado ? 0 : artigos ?? 0,
        caps: desatualizado ? 0 : caps ?? 0,
        artigosAntigos: artigos ?? 0,
        desatualizado,
        docNome: mqAtivo?.nome ?? "—",
        storagePath: mqAtivo?.storage_path ?? null,
      };
    },
    enabled: !!mqAtivo,
  });

  async function executar() {
    if (!mqAtivo) {
      toast.error("O MQT já não está disponível na pasta «Mapa de Quantidades» desta obra.");
      onVoltar();
      return;
    }
    const storagePath = mqAtivo.storage_path;
    if (!storagePath) return;
    setWorking(true);
    setErro(null);
    try {
      // Download do storage
      const { data: blob, error: dlErr } = await supabase.storage.from("documentos").download(storagePath);
      if (dlErr) throw dlErr;
      const buf = await blob.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      // Escolhe a primeira folha com cabeçalho detetável
      let parsed: ParsedRow[] | null = null;
      for (const name of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null }) as any[][];
        const detected = detectColumns(rows);
        if (detected) {
          parsed = parseRows(rows, detected.headerRowIdx, detected.map);
          if (parsed.length) break;
        }
      }
      if (!parsed || !parsed.length) throw new Error("Não foi possível detetar a estrutura do MQT neste ficheiro.");

      // Limpa qualquer leitura anterior deste rascunho (mantém imutabilidade entre leituras: ao re-ler substituímos)
      await supabase.from("classificacao_artigos").delete().eq("orcamento_id", rascunho.id);
      await supabase.from("orcamento_alertas_tecnicos").delete().eq("orcamento_id", rascunho.id);
      await supabase.from("orcamento_classificacao_run").delete().eq("orcamento_id", rascunho.id);
      await supabase.from("orcamento_artigos").delete().eq("orcamento_id", rascunho.id);
      await supabase.from("orcamento_capitulos").delete().eq("orcamento_id", rascunho.id);

      // Capítulos
      const caps = parsed.filter((r) => r.isCapitulo);
      const capIds = new Map<string, string>();
      if (caps.length) {
        const { data: insertedCaps, error: e1 } = await supabase
          .from("orcamento_capitulos")
          .insert(caps.map((c, i) => ({
            orcamento_id: rascunho.id,
            codigo: c.codigo,
            descricao: c.descricao,
            ordem: (i + 1) * 10,
          })))
          .select("id, descricao");
        if (e1) throw e1;
        insertedCaps?.forEach((c) => capIds.set(c.descricao, c.id));
      }

      // Artigos (preço deliberadamente zero — esta fase é só estrutura/quantidades)
      let currentCap: string | null = null;
      const payload = parsed
        .map((r, idx) => {
          if (r.isCapitulo) {
            currentCap = capIds.get(r.descricao) ?? null;
            return null;
          }
          return {
            orcamento_id: rascunho.id,
            capitulo_id: currentCap,
            codigo: r.codigo,
            descricao: r.descricao,
            unidade: r.unidade,
            unidade_normalizada: r.unidade?.toLowerCase().trim() ?? null,
            quantidade: r.quantidade,
            preco_unitario: 0,
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

      toast.success(`Leitura concluída: ${caps.length} capítulos, ${payload.length} artigos.`);
      await qc.invalidateQueries({ queryKey: ["prep-leitura-mq"] });
      await qc.invalidateQueries({ queryKey: ["prep-passo3"] });
      await qc.invalidateQueries({ queryKey: ["prep-passo4-rows"] });
      await qc.invalidateQueries({ queryKey: ["prep-passo4-stats"] });
      await qc.invalidateQueries({ queryKey: ["artigo-original"] });
      await refetch();
      await onConcluido();
    } catch (e: any) {
      setErro(e.message ?? "Erro na leitura");
      toast.error(e.message ?? "Erro");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start gap-3">
        <Brain className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <h3 className="font-semibold">Leitura IA do MQT</h3>
          <p className="text-sm text-muted-foreground">
            O sistema lê o ficheiro <strong>{status?.docNome}</strong> e regista capítulos e artigos. O texto original do Dono de
            Obra (código, descrição, unidade, quantidade, notas) fica <strong>imutável</strong> a partir deste passo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KPI label="Capítulos lidos" value={status?.caps ?? 0} />
        <KPI label="Artigos lidos" value={status?.artigos ?? 0} />
        <KPI label="Estado" value={status && status.artigos > 0 ? "Lido" : "Por ler"} />
      </div>

      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      {status?.desatualizado && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          Existem {status.artigosAntigos} artigos de uma leitura anterior. Ao carregar em «Ler MQT», serão substituídos pelo ficheiro selecionado.
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={executar} disabled={working} variant={status && status.artigos > 0 ? "outline" : "default"}>
          {working && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {status && status.artigos > 0 ? "Re-ler MQT" : "Ler MQT"}
        </Button>
        {status && status.artigos > 0 && (
          <Button onClick={onConcluido} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Avançar para classificação <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </Card>
  );
}

// =========================================================================
//  Passo 3 — Classificação IA contra Biblioteca Mestra
// =========================================================================
function Passo3({ rascunho, onConcluido }: { rascunho: any; onConcluido: () => Promise<void> }) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ClassificacaoProgress | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["prep-passo3", rascunho.id],
    queryFn: async () => {
      const [{ count: total }, { data: cls }] = await Promise.all([
        supabase.from("orcamento_artigos").select("id", { count: "exact", head: true }).eq("orcamento_id", rascunho.id),
        supabase.from("classificacao_artigos").select("estado").eq("orcamento_id", rascunho.id),
      ]);
      const lista = (cls ?? []) as { estado: string }[];
      return {
        total: total ?? 0,
        validados: lista.filter((x) => x.estado === "validado").length,
        auto: lista.filter((x) => x.estado === "classificado_auto").length,
        rever: lista.filter((x) => x.estado === "necessita_revisao").length,
        sem: lista.filter((x) => x.estado === "sem_classificacao").length,
      };
    },
    refetchInterval: running ? 1500 : false,
  });

  async function executar() {
    setRunning(true);
    setProgress({ total: stats?.total ?? 0, done: 0, classificados: 0, pendentes: 0, porAnalisar: stats?.total ?? 0 });
    try {
      await runClassificacao(rascunho.id, (snap) => setProgress(snap));
      toast.success("Classificação concluída");
      qc.invalidateQueries({ queryKey: ["prep-passo3", rascunho.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  const classificados = (stats?.auto ?? 0) + (stats?.validados ?? 0);
  const podeAvancar = classificados > 0;

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start gap-3">
        <ListChecks className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <h3 className="font-semibold">Classificação automática</h3>
          <p className="text-sm text-muted-foreground">
            Cruzamento com a Biblioteca Mestra: Especialidade · Subespecialidade · Categoria · Artigo Mestre · Sistema · Unidade.
            Artigos abaixo do limiar de confiança ficam na lista «A validar».
          </p>
        </div>
      </div>

      {running && progress && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> A classificar…</span>
            <span className="font-mono tabular-nums">{Math.round((progress.done / Math.max(1, progress.total)) * 100)}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-3 bg-primary transition-all" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Total" value={stats?.total ?? 0} />
        <KPI label="Auto-classif." value={stats?.auto ?? 0} tone="blue" />
        <KPI label="Validados" value={stats?.validados ?? 0} tone="emerald" />
        <KPI label="A validar" value={stats?.rever ?? 0} tone="amber" />
        <KPI label="Sem classif." value={stats?.sem ?? 0} tone="muted" />
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={executar} disabled={running} variant={classificados > 0 ? "outline" : "default"}>
          {running && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {classificados > 0 ? "Re-classificar" : "Classificar agora"}
        </Button>
        {podeAvancar && (
          <Button onClick={onConcluido} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Avançar para validação <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </Card>
  );
}

// =========================================================================
//  Passo 4 — Validação manual + aprendizagem (tabela completa do MQT)
// =========================================================================
type EstadoCls = "classificado_auto" | "necessita_revisao" | "sem_classificacao" | "validado";
type ClsRow = {
  id: string; orcamento_id: string; artigo_origem_id: string;
  descricao_original: string; unidade_original: string | null; quantidade_original: number | null;
  especialidade_id: string | null; subespecialidade_id: string | null;
  categoria_id: string | null; artigo_mestre_id: string | null;
  confianca: number; estado: EstadoCls;
  metodo_match: Metodo; motivo: string | null; candidatos: Candidato[] | null;
};

function Passo4({ rascunho, onAbrirValidacao, onConcluir }: { rascunho: any; onAbrirValidacao: () => void; onConcluir: () => Promise<void> }) {
  const qc = useQueryClient();
  const orcamentoId = rascunho.id as string;
  const obraIdAtual = rascunho.obra_id as string | null;
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialogRow, setDialogRow] = useState<ClsRow | null>(null);
  const [panelRow, setPanelRow] = useState<ClsRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["prep-passo4-rows", orcamentoId, estadoFilter, search],
    queryFn: async () => {
      let q = supabase.from("classificacao_artigos").select("*")
        .eq("orcamento_id", orcamentoId).order("created_at", { ascending: true });
      if (estadoFilter !== "all") q = q.eq("estado", estadoFilter as EstadoCls);
      if (search.trim()) q = q.ilike("descricao_original", `%${search.trim()}%`);
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      return (data ?? []) as ClsRow[];
    },
  });

  const { data: allRows = [] } = useQuery({
    queryKey: ["prep-passo4-stats", orcamentoId],
    queryFn: async () => {
      const { data } = await supabase.from("classificacao_artigos").select("estado").eq("orcamento_id", orcamentoId).limit(10000);
      return (data ?? []) as { estado: EstadoCls }[];
    },
    refetchInterval: 8000,
  });

  const stats = useMemo(() => ({
    total: allRows.length,
    validados: allRows.filter((x) => x.estado === "validado").length,
    auto: allRows.filter((x) => x.estado === "classificado_auto").length,
    rever: allRows.filter((x) => x.estado === "necessita_revisao").length,
    sem: allRows.filter((x) => x.estado === "sem_classificacao").length,
  }), [allRows]);

  const { data: esps = [] } = useQuery({
    queryKey: ["prep-esps"],
    queryFn: async () => (await supabase.from("biblioteca_especialidades").select("id, nome").order("ordem")).data ?? [],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["prep-subs"],
    queryFn: async () => (await supabase.from("biblioteca_subespecialidades").select("id, nome, especialidade_id").order("ordem")).data ?? [],
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["prep-cats"],
    queryFn: async () => (await supabase.from("biblioteca_categorias").select("id, nome, subespecialidade_id").order("ordem")).data ?? [],
  });
  const { data: arts = [] } = useQuery({
    queryKey: ["prep-arts"],
    queryFn: async () => (await supabase.from("biblioteca_artigos").select("id, descricao, unidade, tipo, categoria_id, subespecialidade_id").eq("ativo", true)).data ?? [],
  });

  const espMap = useMemo(() => new Map(esps.map((e: any) => [e.id, e.nome])), [esps]);
  const subMap = useMemo(() => new Map(subs.map((s: any) => [s.id, s])), [subs]);
  const catMap = useMemo(() => new Map(cats.map((c: any) => [c.id, c])), [cats]);
  const artMap = useMemo(() => new Map(arts.map((a: any) => [a.id, a])), [arts]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["prep-passo4-rows", orcamentoId] });
    qc.invalidateQueries({ queryKey: ["prep-passo4-stats", orcamentoId] });
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
    await registarAprendizagem({
      descricaoOriginal: row.descricao_original,
      especialidadeSugerida: null,
      especialidadeFinal: espFinal,
      confiancaSugerida: row.confianca,
      obraId: obraIdAtual,
      acao: "validar",
    });
    toast.success("Validado e guardado na memória");
    invalidate();
  };

  const remover = async (row: ClsRow) => {
    const { error } = await supabase.from("classificacao_artigos").update({
      artigo_mestre_id: null, categoria_id: null, subespecialidade_id: null, especialidade_id: null,
      confianca: 0, estado: "sem_classificacao", metodo_match: "nenhum", motivo: "Removido manualmente",
      validado_por: null, validado_em: null,
    }).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Classificação removida");
    invalidate();
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
    invalidate();
    setDialogRow(null);
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <h3 className="font-semibold">Mapa de Quantidades classificado</h3>
          <p className="text-sm text-muted-foreground">
            Cada linha do MQT original com a classificação proposta contra a Biblioteca Mestra. Aceita, corrige ou atribui um Artigo Mestre.
            <strong> Cada correção alimenta a aprendizagem do sistema.</strong>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Total" value={stats.total} />
        <KPI label="Auto" value={stats.auto} tone="blue" />
        <KPI label="Validados" value={stats.validados} tone="emerald" />
        <KPI label="A validar" value={stats.rever} tone="amber" />
        <KPI label="Sem classif." value={stats.sem} tone="muted" />
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1.5 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Filtrar estado</label>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="sem_classificacao">Sem classificação</SelectItem>
              <SelectItem value="necessita_revisao">A validar</SelectItem>
              <SelectItem value="classificado_auto">Auto-classificados</SelectItem>
              <SelectItem value="validado">Validados</SelectItem>
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
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Artigo Original (MQT)</TableHead>
                <TableHead>Classificação proposta</TableHead>
                <TableHead className="w-40">Resultado IA</TableHead>
                <TableHead className="w-36">Confiança</TableHead>
                <TableHead className="w-40">Próxima ação</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">A carregar…</TableCell></TableRow>}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Sem resultados para os filtros.</TableCell></TableRow>
              )}
              {rows.map((r) => {
                const art: any = r.artigo_mestre_id ? artMap.get(r.artigo_mestre_id) : null;
                const espNome = r.especialidade_id ? espMap.get(r.especialidade_id) : null;
                const subNome = r.subespecialidade_id ? (subMap.get(r.subespecialidade_id) as any)?.nome : null;
                const catNome = r.categoria_id ? (catMap.get(r.categoria_id) as any)?.nome : null;
                const trail = [espNome, subNome, catNome, art?.descricao].filter(Boolean) as string[];
                const acao = calcularProximaAcao({ estado: r.estado, metodo: r.metodo_match, confianca: r.confianca, candidatos: r.candidatos });
                const onAcao = () => {
                  if (acao.tipo === "aceitar") validar(r);
                  else if (acao.tipo === "corrigir" || acao.tipo === "escolher") setDialogRow(r);
                  else setPanelRow(r);
                };
                return (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setPanelRow(r)}>
                    <TableCell className="max-w-[300px]">
                      <div className="text-sm line-clamp-2">{r.descricao_original}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.unidade_original ?? "—"} · qtd {r.quantidade_original ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[280px]">
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">Nenhum orçamento final será gerado nesta fase.</p>
        <p className="text-muted-foreground">
          Este rascunho técnico fica guardado para servir de base aos pacotes de consulta a subempreiteiros (Procurement). O
          orçamento ao Dono de Obra só é compilado após receber, comparar e adjudicar as propostas.
        </p>
      </div>

      <div className="flex justify-between gap-2">
        <Button onClick={onAbrirValidacao} variant="ghost" size="sm" className="text-muted-foreground">
          Abrir em página inteira <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
        <Button onClick={onConcluir} className="bg-primary text-primary-foreground hover:bg-primary/90">
          Marcar rascunho técnico como pronto
        </Button>
      </div>

      <SearchBibliotecaDialog
        open={!!dialogRow} onClose={() => setDialogRow(null)}
        onPick={(artId) => dialogRow && atribuir(dialogRow, artId)}
        esps={esps} subs={subs} cats={cats} arts={arts}
        suggestion={dialogRow?.descricao_original ?? ""}
      />
      <ClassificacaoSidePanel
        row={panelRow as PanelRow | null}
        orcamentoId={orcamentoId}
        onClose={() => setPanelRow(null)}
        espMap={espMap as Map<string, string>}
        subMap={subMap as Map<string, any>}
        catMap={catMap as Map<string, any>}
        artMap={artMap as Map<string, any>}
        onAceitar={(r) => { validar(r as any); setPanelRow(null); }}
        onCorrigir={(r) => { setDialogRow(r as any); }}
        onRefresh={invalidate}
      />
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
  useEffect(() => { setQ(suggestion); }, [suggestion]);

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

// =========================================================================
//  KPI helper
// =========================================================================
function KPI({ label, value, tone }: { label: string; value: number | string; tone?: "blue" | "emerald" | "amber" | "muted" }) {
  const cls =
    tone === "blue" ? "text-blue-600 dark:text-blue-400" :
    tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
    tone === "amber" ? "text-amber-600 dark:text-amber-400" :
    tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

// Suprimir warning de import não usado em build estrito quando passo 4 nao renderiza ArrowLeft.
void ArrowLeft;
