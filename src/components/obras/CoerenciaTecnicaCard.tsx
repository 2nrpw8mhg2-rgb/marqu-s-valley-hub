import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ShieldCheck, Info, RotateCw, ChevronDown, ChevronUp, Check, X, MessageSquare } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { analisarOmissoes, marcarAlerta, type AcaoAlerta } from "@/lib/relacoes/analise";
import { TIPO_RELACAO_META, OBRIGATORIEDADE_META } from "@/lib/relacoes/config";
import type { AlertaTecnico } from "@/lib/relacoes/types";
import type { ArtigoMestre } from "@/lib/biblioteca-mestra/types";
import type { SistemaConstrutivo } from "@/lib/relacoes/types";

type Props = { orcamentoId: string };

export function CoerenciaTecnicaCard({ orcamentoId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["alertas-tecnicos", orcamentoId],
    queryFn: async () =>
      ((await supabase.from("orcamento_alertas_tecnicos").select("*").eq("orcamento_id", orcamentoId).order("severidade").order("created_at"))
        .data ?? []) as AlertaTecnico[],
  });

  const abertos = alertas.filter((a) => a.estado === "aberto");
  const criticos = abertos.filter((a) => a.severidade === "critico").length;
  const avisos = abertos.filter((a) => a.severidade === "aviso").length;
  const infos = abertos.filter((a) => a.severidade === "info").length;

  const reanalisar = async () => {
    setRunning(true);
    try {
      const r = await analisarOmissoes(orcamentoId);
      qc.invalidateQueries({ queryKey: ["alertas-tecnicos", orcamentoId] });
      toast.success(`Análise concluída — ${r.total} esperados (${r.criticos} críticos)`);
    } catch (e: any) { toast.error(e.message ?? "Erro"); }
    finally { setRunning(false); }
  };

  if (isLoading) return null;

  if (alertas.length === 0) {
    return (
      <Card className="bg-card border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          <div>
            <div className="text-sm font-medium">Coerência técnica</div>
            <div className="text-xs text-muted-foreground">Sem análise ou sem omissões detetadas.</div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={reanalisar} disabled={running}>
          <RotateCw className={`h-4 w-4 mr-1 ${running ? "animate-spin" : ""}`} /> Analisar
        </Button>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {criticos > 0 ? <AlertTriangle className="h-5 w-5 text-red-500" /> :
             avisos > 0 ? <AlertTriangle className="h-5 w-5 text-amber-500" /> :
             <ShieldCheck className="h-5 w-5 text-emerald-500" />}
            <div>
              <div className="text-sm font-medium">Coerência técnica</div>
              <div className="text-xs text-muted-foreground">
                {abertos.length === 0
                  ? "Sem alertas em aberto."
                  : `${abertos.length} alertas em aberto.`}
              </div>
            </div>
            <div className="flex gap-2 ml-2">
              {criticos > 0 && <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40">{criticos} crítico{criticos !== 1 ? "s" : ""}</Badge>}
              {avisos > 0 && <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40">{avisos} aviso{avisos !== 1 ? "s" : ""}</Badge>}
              {infos > 0 && <Badge variant="outline" className="bg-muted text-muted-foreground border-border">{infos} info</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reanalisar} disabled={running}>
              <RotateCw className={`h-4 w-4 mr-1 ${running ? "animate-spin" : ""}`} /> Reanalisar
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>Ver alertas</Button>
          </div>
        </div>
      </Card>

      <AlertasTecnicosDialog open={open} onOpenChange={setOpen} orcamentoId={orcamentoId} alertas={alertas} />
    </>
  );
}

function AlertasTecnicosDialog({
  open, onOpenChange, orcamentoId, alertas,
}: { open: boolean; onOpenChange: (v: boolean) => void; orcamentoId: string; alertas: AlertaTecnico[] }) {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<"abertos" | "todos">("abertos");

  const esperadosIds = useMemo(() => Array.from(new Set(alertas.map((a) => a.artigo_mestre_esperado_id))), [alertas]);
  const origemIds = useMemo(() => Array.from(new Set(alertas.map((a) => a.artigo_mestre_origem_id).filter(Boolean) as string[])), [alertas]);
  const sistemaIds = useMemo(() => Array.from(new Set(alertas.map((a) => a.sistema_id).filter(Boolean) as string[])), [alertas]);

  const { data: artigos = [] } = useQuery({
    queryKey: ["alerts-artigos", orcamentoId, esperadosIds.length, origemIds.length],
    enabled: open,
    queryFn: async () => {
      const ids = Array.from(new Set([...esperadosIds, ...origemIds]));
      if (!ids.length) return [];
      return (await supabase.from("biblioteca_artigos").select("id, descricao, codigo").in("id", ids)).data as Pick<ArtigoMestre, "id" | "descricao" | "codigo">[];
    },
  });
  const { data: sistemas = [] } = useQuery({
    queryKey: ["alerts-sistemas", orcamentoId, sistemaIds.length],
    enabled: open && sistemaIds.length > 0,
    queryFn: async () =>
      (await supabase.from("biblioteca_sistemas_construtivos").select("id, nome, categoria_sistema").in("id", sistemaIds)).data as SistemaConstrutivo[],
  });

  const artMap = new Map(artigos.map((a) => [a.id, a]));
  const sysMap = new Map(sistemas.map((s) => [s.id, s]));

  const lista = alertas.filter((a) => filtro === "todos" ? true : a.estado === "aberto");

  const act = useMutation({
    mutationFn: async (vars: { id: string; acao: AcaoAlerta; justificacao?: string }) => marcarAlerta(vars.id, vars.acao, vars.justificacao),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["alertas-tecnicos", orcamentoId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>Alertas de coerência técnica</span>
            <div className="flex gap-1">
              <Button size="sm" variant={filtro === "abertos" ? "default" : "outline"} onClick={() => setFiltro("abertos")}>Abertos</Button>
              <Button size="sm" variant={filtro === "todos" ? "default" : "outline"} onClick={() => setFiltro("todos")}>Todos</Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto space-y-2">
          {lista.length === 0 && <div className="text-sm text-muted-foreground text-center py-10">Sem alertas para mostrar.</div>}
          {lista.map((a) => (
            <AlertaRow
              key={a.id}
              alerta={a}
              esperado={artMap.get(a.artigo_mestre_esperado_id)}
              origem={a.artigo_mestre_origem_id ? artMap.get(a.artigo_mestre_origem_id) : undefined}
              sistema={a.sistema_id ? sysMap.get(a.sistema_id) : undefined}
              busy={act.isPending}
              onAcao={(acao, justificacao) => act.mutate({ id: a.id, acao, justificacao })}
            />
          ))}
        </div>

        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AlertaRow({ alerta, esperado, origem, sistema, busy, onAcao }: {
  alerta: AlertaTecnico;
  esperado?: Pick<ArtigoMestre, "id" | "descricao" | "codigo">;
  origem?: Pick<ArtigoMestre, "id" | "descricao" | "codigo">;
  sistema?: SistemaConstrutivo;
  busy: boolean;
  onAcao: (acao: AcaoAlerta, justificacao?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [justOpen, setJustOpen] = useState(false);
  const [just, setJust] = useState("");

  const sev = alerta.severidade;
  const sevCls =
    sev === "critico" ? "border-l-red-500" :
    sev === "aviso" ? "border-l-amber-500" : "border-l-muted";
  const sevIcon =
    sev === "critico" ? <AlertTriangle className="h-4 w-4 text-red-500" /> :
    sev === "aviso" ? <AlertTriangle className="h-4 w-4 text-amber-500" /> :
    <Info className="h-4 w-4 text-muted-foreground" />;

  const tipoMeta = TIPO_RELACAO_META[alerta.tipo_relacao];
  const obrigMeta = OBRIGATORIEDADE_META[alerta.obrigatoriedade];

  const motivo = sistema
    ? `O sistema "${sistema.nome}" inclui "${esperado?.descricao ?? "—"}" (${obrigMeta.label.toLowerCase()}), em falta.`
    : `"${origem?.descricao ?? "—"}" ${tipoMeta.label.toLowerCase()} "${esperado?.descricao ?? "—"}" (${obrigMeta.label.toLowerCase()}), em falta.`;

  const isAberto = alerta.estado === "aberto";
  const estadoBadge = {
    aberto: { label: "Aberto", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40" },
    aceite_omissao: { label: "Aceite como omissão", cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40" },
    justificado: { label: "Justificado", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40" },
    ignorado: { label: "Ignorado", cls: "bg-muted text-muted-foreground border-border" },
    resolvido: { label: "Resolvido", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40" },
  }[alerta.estado];

  return (
    <div className={`rounded-md border border-border border-l-4 ${sevCls} bg-background/40 p-3`}>
      <div className="flex items-start gap-3">
        {sevIcon}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{motivo}</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <Badge variant="outline" className={`text-[10px] ${tipoMeta.cls}`}>{tipoMeta.label}</Badge>
            <Badge variant="outline" className={`text-[10px] ${obrigMeta.cls}`}>{obrigMeta.label}</Badge>
            <Badge variant="outline" className={`text-[10px] ${estadoBadge.cls}`}>{estadoBadge.label}</Badge>
            {sistema && <Badge variant="outline" className="text-[10px]">Sistema: {sistema.nome}</Badge>}
          </div>
          {expanded && (
            <div className="mt-2 text-xs text-muted-foreground space-y-1">
              {origem && <div>Detetado a partir de: <span className="font-medium text-foreground">{origem.descricao}</span></div>}
              {esperado && <div>Artigo esperado: <span className="font-medium text-foreground">{esperado.descricao}</span></div>}
              {alerta.justificacao && <div>Justificação: <span className="italic">{alerta.justificacao}</span></div>}
            </div>
          )}
        </div>
        <Button size="icon" variant="ghost" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {isAberto && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-border/60 flex-wrap">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onAcao("aceitar_omissao")}>
            <Check className="h-3.5 w-3.5 mr-1" /> Aceitar omissão
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setJustOpen(true)}>
            <MessageSquare className="h-3.5 w-3.5 mr-1" /> Justificar
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAcao("ignorar")}>
            <X className="h-3.5 w-3.5 mr-1" /> Ignorar
          </Button>
        </div>
      )}
      {!isAberto && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-border/60">
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAcao("reabrir")}>Reabrir</Button>
        </div>
      )}

      <Dialog open={justOpen} onOpenChange={setJustOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Justificar omissão</DialogTitle></DialogHeader>
          <Textarea rows={4} value={just} onChange={(e) => setJust(e.target.value)} placeholder="Explica porque é que este artigo não consta deste MQ..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setJustOpen(false)}>Cancelar</Button>
            <Button onClick={() => { onAcao("justificar", just); setJustOpen(false); setJust(""); }} disabled={!just.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
