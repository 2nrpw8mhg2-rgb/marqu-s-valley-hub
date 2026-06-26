import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Tag, Wand2, Cog } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/biblioteca-mestra/disciplinas")({
  head: () => ({ meta: [{ title: "Disciplinas Técnicas (MEP) — Biblioteca Mestra — MV OS" }] }),
  component: DisciplinasPage,
});

type Disciplina = {
  id: string;
  codigo: string | null;
  nome: string;
  slug: string | null;
  cor: string | null;
  pastas_padrao: string[];
  sequencia_construtiva: any;
};

type Keyword = { id: string; subespecialidade_id: string; termo: string; tipo: "positiva" | "negativa"; peso: number };
type Regra = { id: string; subespecialidade_id: string; categoria_id: string | null; padrao: string; descricao: string | null; prioridade: number };
type Categoria = { id: string; subespecialidade_id: string; nome: string };

function DisciplinasPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Disciplina | null>(null);

  const { data: esp110 } = useQuery({
    queryKey: ["bm-esp-110"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_especialidades")
        .select("id, codigo, nome")
        .eq("codigo", "110")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: disciplinas = [] } = useQuery({
    queryKey: ["bm-disciplinas-110", esp110?.id],
    enabled: !!esp110?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_subespecialidades")
        .select("id, codigo, nome, slug, cor, pastas_padrao, sequencia_construtiva")
        .eq("especialidade_id", esp110!.id)
        .eq("ativa", true)
        .order("codigo");
      if (error) throw error;
      return (data ?? []) as Disciplina[];
    },
  });

  const subIds = useMemo(() => disciplinas.map((d) => d.id), [disciplinas]);

  const { data: kwCounts = {} } = useQuery({
    queryKey: ["bm-disc-kw-counts", subIds.join(",")],
    enabled: subIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_subespecialidade_keywords")
        .select("subespecialidade_id")
        .in("subespecialidade_id", subIds)
        .eq("ativo", true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { counts[r.subespecialidade_id] = (counts[r.subespecialidade_id] ?? 0) + 1; });
      return counts;
    },
  });

  const { data: regraCounts = {} } = useQuery({
    queryKey: ["bm-disc-regra-counts", subIds.join(",")],
    enabled: subIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_subespecialidade_regras")
        .select("subespecialidade_id")
        .in("subespecialidade_id", subIds)
        .eq("ativo", true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { counts[r.subespecialidade_id] = (counts[r.subespecialidade_id] ?? 0) + 1; });
      return counts;
    },
  });

  return (
    <>
      <PageHeader
        title="Disciplinas Técnicas (MEP)"
        subtitle="As 14 disciplinas da Especialidade 110 funcionam internamente como unidades técnicas autónomas. Aqui configuras a identidade, palavras-chave e regras de cada uma."
      />
      <div className="p-6 space-y-4">
        <Card className="p-4 bg-muted/40">
          <p className="text-sm text-muted-foreground">
            Para o utilizador, a Biblioteca continua a mostrar apenas <strong>110 — Especialidades Técnicas (MEP)</strong>.
            Internamente, cada disciplina (Eletricidade, AVAC, ITED…) é tratada de forma independente em Procurement, Histórico de Preços, Dashboards e IA.
          </p>
        </Card>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {disciplinas.map((d) => (
            <Card key={d.id} className="p-4 hover:bg-accent/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="h-9 w-9 rounded-md shrink-0 border"
                    style={{ background: (d.cor ?? "#888") + "20", borderColor: (d.cor ?? "#888") + "60" }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{d.codigo}</p>
                    <p className="font-semibold truncate">{d.nome}</p>
                    {d.slug && <p className="text-[11px] text-muted-foreground">slug: <code>{d.slug}</code></p>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setSelected(d)}>
                  <Cog className="h-3.5 w-3.5 mr-1.5" /> Configurar
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="gap-1">
                  <Tag className="h-3 w-3" /> {kwCounts[d.id] ?? 0} keywords
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Wand2 className="h-3 w-3" /> {regraCounts[d.id] ?? 0} regras
                </Badge>
                {Array.isArray(d.pastas_padrao) && d.pastas_padrao.length > 0 && (
                  <Badge variant="outline">{d.pastas_padrao.length} pastas-tipo</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>

        {disciplinas.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            Nenhuma disciplina ativa na 110 — MEP.
          </Card>
        )}
      </div>

      <DisciplinaConfigDialog
        disciplina={selected}
        onOpenChange={(v) => !v && setSelected(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["bm-disc-kw-counts"] });
          qc.invalidateQueries({ queryKey: ["bm-disc-regra-counts"] });
        }}
      />
    </>
  );
}

function DisciplinaConfigDialog({
  disciplina,
  onOpenChange,
  onSaved,
}: {
  disciplina: Disciplina | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const open = !!disciplina;

  const { data: keywords = [] } = useQuery({
    queryKey: ["bm-disc-kw", disciplina?.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_subespecialidade_keywords")
        .select("*")
        .eq("subespecialidade_id", disciplina!.id)
        .order("tipo")
        .order("termo");
      if (error) throw error;
      return (data ?? []) as Keyword[];
    },
  });

  const { data: regras = [] } = useQuery({
    queryKey: ["bm-disc-regras", disciplina?.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_subespecialidade_regras")
        .select("*")
        .eq("subespecialidade_id", disciplina!.id)
        .order("prioridade");
      if (error) throw error;
      return (data ?? []) as Regra[];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["bm-disc-cats", disciplina?.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_categorias")
        .select("id, subespecialidade_id, nome")
        .eq("subespecialidade_id", disciplina!.id)
        .eq("ativa", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });

  const [novoTermo, setNovoTermo] = useState("");
  const [novoTipo, setNovoTipo] = useState<"positiva" | "negativa">("positiva");
  const [novoPadrao, setNovoPadrao] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novaCategoria, setNovaCategoria] = useState<string>("none");
  const [novaPrioridade, setNovaPrioridade] = useState<number>(100);

  const addKw = useMutation({
    mutationFn: async () => {
      if (!disciplina || !novoTermo.trim()) return;
      const { error } = await supabase.from("biblioteca_subespecialidade_keywords").insert({
        subespecialidade_id: disciplina.id,
        termo: novoTermo.trim(),
        tipo: novoTipo,
        peso: 1.0,
        origem: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovoTermo("");
      qc.invalidateQueries({ queryKey: ["bm-disc-kw", disciplina?.id] });
      onSaved();
      toast.success("Palavra-chave adicionada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delKw = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("biblioteca_subespecialidade_keywords").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-disc-kw", disciplina?.id] });
      onSaved();
    },
  });

  const addRegra = useMutation({
    mutationFn: async () => {
      if (!disciplina || !novoPadrao.trim()) return;
      const { error } = await supabase.from("biblioteca_subespecialidade_regras").insert({
        subespecialidade_id: disciplina.id,
        categoria_id: novaCategoria === "none" ? null : novaCategoria,
        padrao: novoPadrao.trim(),
        descricao: novaDescricao.trim() || null,
        prioridade: novaPrioridade,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovoPadrao(""); setNovaDescricao(""); setNovaCategoria("none"); setNovaPrioridade(100);
      qc.invalidateQueries({ queryKey: ["bm-disc-regras", disciplina?.id] });
      onSaved();
      toast.success("Regra adicionada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delRegra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("biblioteca_subespecialidade_regras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-disc-regras", disciplina?.id] });
      onSaved();
    },
  });

  if (!disciplina) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-5 w-5 rounded" style={{ background: disciplina.cor ?? "#888" }} />
            {disciplina.codigo} — {disciplina.nome}
          </DialogTitle>
          <DialogDescription>
            Configura o conhecimento técnico desta disciplina. Estas keywords e regras alimentam o classificador automático
            de artigos e a geração de pacotes de procurement.
          </DialogDescription>
        </DialogHeader>

        {/* KEYWORDS */}
        <section className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2"><Tag className="h-4 w-4" /> Palavras-chave</h4>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">Termo</Label>
              <Input value={novoTermo} onChange={(e) => setNovoTermo(e.target.value)} placeholder="ex: quadro elétrico" />
            </div>
            <div className="w-36">
              <Label className="text-xs">Tipo</Label>
              <Select value={novoTipo} onValueChange={(v: any) => setNovoTipo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="positiva">+ Positiva</SelectItem>
                  <SelectItem value="negativa">− Negativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => addKw.mutate()} disabled={!novoTermo.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {keywords.map((k) => (
              <Badge
                key={k.id}
                variant={k.tipo === "positiva" ? "secondary" : "outline"}
                className={`gap-1.5 ${k.tipo === "negativa" ? "border-destructive/40 text-destructive" : ""}`}
              >
                {k.tipo === "positiva" ? "+" : "−"} {k.termo}
                <button onClick={() => delKw.mutate(k.id)} className="hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {keywords.length === 0 && <p className="text-xs text-muted-foreground">Sem palavras-chave.</p>}
          </div>
        </section>

        {/* REGRAS */}
        <section className="space-y-2 mt-2">
          <h4 className="text-sm font-semibold flex items-center gap-2"><Wand2 className="h-4 w-4" /> Regras de classificação</h4>
          <p className="text-xs text-muted-foreground">
            Regras determinísticas (regex case-insensitive). Aplicadas antes das palavras-chave e da IA.
            Menor prioridade = avaliada primeiro.
          </p>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_120px_auto] items-end">
            <div>
              <Label className="text-xs">Padrão (regex)</Label>
              <Input value={novoPadrao} onChange={(e) => setNovoPadrao(e.target.value)} placeholder="ex: tomada|interruptor" />
            </div>
            <div>
              <Label className="text-xs">Categoria-alvo (opcional)</Label>
              <Select value={novaCategoria} onValueChange={setNovaCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma —</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Input type="number" value={novaPrioridade} onChange={(e) => setNovaPrioridade(Number(e.target.value))} />
            </div>
            <Button onClick={() => addRegra.mutate()} disabled={!novoPadrao.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div>
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input value={novaDescricao} onChange={(e) => setNovaDescricao(e.target.value)} placeholder="ex: tomadas pertencem sempre a Eletricidade" />
          </div>

          <div className="mt-3 space-y-1.5">
            {regras.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div className="min-w-0">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.padrao}</code>
                  {r.descricao && <span className="ml-2 text-muted-foreground">— {r.descricao}</span>}
                  <span className="ml-2 text-[10px] text-muted-foreground">prio {r.prioridade}</span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => delRegra.mutate(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {regras.length === 0 && <p className="text-xs text-muted-foreground">Sem regras.</p>}
          </div>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button asChild>
            <Link to="/biblioteca-mestra/artigos">Ver artigos desta disciplina</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
