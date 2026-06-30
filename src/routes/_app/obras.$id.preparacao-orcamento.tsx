import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { toast } from "sonner";
import { detectColumns, parseRows, type ParsedRow } from "@/lib/mq-parser";
import { runClassificacao, type ClassificacaoProgress } from "@/lib/classificacao/engine";
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



  const mqDocs = useMemo(() => {
    const pastas = (doc?.pastas ?? []) as { id: string; nome: string }[];
    const docs = (doc?.docs ?? []) as { id: string; nome: string; tipo: string; pasta_id: string | null; storage_path: string; created_at: string; tamanho: number | null }[];
    const mqPastas = new Set(pastas.filter((p) => p.nome?.toLowerCase() === "mapa de quantidades").map((p) => p.id));
    return docs
      .filter((d) => d.tipo === "mq" || (d.pasta_id && mqPastas.has(d.pasta_id)))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [doc]);


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

      <Stepper passo={passo} setPasso={setPasso} maxPasso={rascunho?.wizard_passo ?? 0} />

      {passo === 0 && (
        <Passo0
          rows={checklistRows}
          onAvancar={() => setPasso(1)}
        />
      )}
      {passo === 1 && (
        <Passo1
          obraId={obraId}
          rascunho={rascunho}
          mqDocs={mqDocs}
          onSelecionado={async () => {
            await refetchRascunho();
            await persistPasso(1);
            setPasso(2);
          }}
        />
      )}
      {passo === 2 && rascunho && (
        <Passo2 rascunho={rascunho} onConcluido={async () => { await persistPasso(2); setPasso(3); }} />
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
function Passo0({
  rows,
  onAvancar,
}: {
  rows: { key: string; label: string; count: number; present: boolean; required?: boolean }[];
  onAvancar: () => void;
}) {
  const mqRow = rows.find((r) => r.key === "mq");
  const podeAvancar = !!mqRow?.present;
  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start gap-3">
        <ClipboardCheck className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <h3 className="font-semibold">Documentação disponível na obra</h3>
          <p className="text-sm text-muted-foreground">
            Verificação automática contra a Gestão Documental. Para iniciar a preparação, basta existir um Mapa de Quantidades.
          </p>
        </div>
      </div>
      <ul className="divide-y divide-border border border-border rounded-md overflow-hidden">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between px-4 py-3 bg-background">
            <div className="flex items-center gap-3">
              {r.present ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : r.required ? (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/50" />
              )}
              <div>
                <div className="font-medium text-sm">
                  {r.label}
                  {r.required && <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-600">obrigatório</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.present ? `${r.count} ficheiro(s) encontrados` : "Sem ficheiros nesta categoria"}
                </div>
              </div>
            </div>
            <Badge variant="outline" className={r.present ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-border text-muted-foreground"}>
              {r.present ? "OK" : "Em falta"}
            </Badge>
          </li>
        ))}
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
  onSelecionado,
}: {
  obraId: string;
  rascunho: any;
  mqDocs: { id: string; nome: string; storage_path: string; created_at: string; tamanho: number | null }[];
  onSelecionado: () => Promise<void>;
}) {
  const [escolhido, setEscolhido] = useState<string | null>(rascunho?.mq_documento_id ?? null);
  const [revisao, setRevisao] = useState<string>(rascunho?.mq_revisao ?? "");
  const [working, setWorking] = useState(false);

  async function confirmar() {
    if (!escolhido) return;
    setWorking(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (rascunho) {
        // Atualiza rascunho existente
        await supabase
          .from("orcamentos")
          .update({ mq_documento_id: escolhido, mq_revisao: revisao || null })
          .eq("id", rascunho.id);
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
        const docNome = mqDocs.find((m) => m.id === escolhido)?.nome ?? "MQT";
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
          mq_revisao: revisao || null,
          created_by: u.user?.id ?? null,
        });
        if (error) throw error;
      }
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
        <h3 className="font-semibold">Sem MQT na Gestão Documental</h3>
        <p className="text-sm text-muted-foreground">
          Adiciona o Mapa de Quantidades à pasta «Mapa de Quantidades» (ou marca-o como tipo «MQ») no separador Documentos
          desta obra. Esta fase não permite uploads diretos.
        </p>
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
                onClick={() => setEscolhido(d.id)}
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
function Passo2({ rascunho, onConcluido }: { rascunho: any; onConcluido: () => Promise<void> }) {
  const [working, setWorking] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { data: status, refetch } = useQuery({
    queryKey: ["prep-passo2", rascunho.id],
    queryFn: async () => {
      const [{ count: artigos }, { count: caps }, { data: docInfo }] = await Promise.all([
        supabase.from("orcamento_artigos").select("id", { count: "exact", head: true }).eq("orcamento_id", rascunho.id),
        supabase.from("orcamento_capitulos").select("id", { count: "exact", head: true }).eq("orcamento_id", rascunho.id),
        supabase.from("documentos").select("nome, storage_path").eq("id", rascunho.mq_documento_id).maybeSingle(),
      ]);
      return { artigos: artigos ?? 0, caps: caps ?? 0, docNome: docInfo?.nome ?? "—", storagePath: docInfo?.storage_path ?? null };
    },
  });

  async function executar() {
    if (!status?.storagePath) return;
    setWorking(true);
    setErro(null);
    try {
      // Download do storage
      const { data: blob, error: dlErr } = await supabase.storage.from("documentos").download(status.storagePath);
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
//  Passo 4 — Validação manual + aprendizagem
// =========================================================================
function Passo4({ rascunho, onAbrirValidacao, onConcluir }: { rascunho: any; onAbrirValidacao: () => void; onConcluir: () => Promise<void> }) {
  const { data: stats } = useQuery({
    queryKey: ["prep-passo4", rascunho.id],
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
    refetchInterval: 4000,
  });
  const pendentes = (stats?.rever ?? 0) + (stats?.sem ?? 0);

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <h3 className="font-semibold">Validação e aprendizagem</h3>
          <p className="text-sm text-muted-foreground">
            Confirma ou corrige a classificação dos artigos que ficaram incertos. <strong>Cada correção alimenta a aprendizagem do
            sistema</strong> — a Biblioteca Mestra fica mais inteligente para a próxima obra.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Total" value={stats?.total ?? 0} />
        <KPI label="Auto" value={stats?.auto ?? 0} tone="blue" />
        <KPI label="Validados" value={stats?.validados ?? 0} tone="emerald" />
        <KPI label="A validar" value={stats?.rever ?? 0} tone="amber" />
        <KPI label="Sem classif." value={stats?.sem ?? 0} tone="muted" />
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">Nenhum orçamento final será gerado nesta fase.</p>
        <p className="text-muted-foreground">
          Este rascunho técnico fica guardado para servir de base aos pacotes de consulta a subempreiteiros (Procurement). O
          orçamento ao Dono de Obra só é compilado após receber, comparar e adjudicar as propostas.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={onAbrirValidacao} variant="outline">
          Abrir Motor de Classificação <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        <Button onClick={onConcluir} className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={pendentes > 0 && (stats?.total ?? 0) > 0 && pendentes === stats?.total}>
          Marcar rascunho técnico como pronto
        </Button>
      </div>
    </Card>
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
