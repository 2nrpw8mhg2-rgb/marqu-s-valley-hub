import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { Search, CheckCircle2, X, Edit3, RotateCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/motor-classificacao")({
  head: () => ({ meta: [{ title: "Motor de Classificação — MV OS" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    orcamento: (s.orcamento as string) || "",
  }),
  component: MotorClassificacaoPage,
});

type EstadoCls = "classificado_auto" | "necessita_revisao" | "sem_classificacao" | "validado";

type ClsRow = {
  id: string;
  orcamento_id: string;
  artigo_origem_id: string;
  descricao_original: string;
  unidade_original: string | null;
  quantidade_original: number | null;
  especialidade_id: string | null;
  subespecialidade_id: string | null;
  categoria_id: string | null;
  artigo_mestre_id: string | null;
  confianca: number;
  estado: EstadoCls;
};

const ESTADO_META: Record<EstadoCls, { label: string; cls: string }> = {
  validado: { label: "Validado", cls: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/40" },
  classificado_auto: { label: "Auto", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40" },
  necessita_revisao: { label: "Rever", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/40" },
  sem_classificacao: { label: "Sem classif.", cls: "bg-muted text-muted-foreground border-border" },
};

function MotorClassificacaoPage() {
  const { orcamento } = Route.useSearch();
  const qc = useQueryClient();
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialogRow, setDialogRow] = useState<ClsRow | null>(null);

  const { data: orcamentos = [] } = useQuery({
    queryKey: ["mc-orcamentos"],
    queryFn: async () => {
      const { data } = await supabase.from("orcamentos").select("id, nome, versao").order("created_at", { ascending: false });
      return (data ?? []) as { id: string; nome: string; versao: number }[];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["classificacao", orcamento, estadoFilter, search],
    queryFn: async () => {
      let q = supabase.from("classificacao_artigos").select("*").order("created_at", { ascending: true });
      if (orcamento) q = q.eq("orcamento_id", orcamento);
      if (estadoFilter !== "all") q = q.eq("estado", estadoFilter as EstadoCls);
      if (search.trim()) q = q.ilike("descricao_original", `%${search.trim()}%`);
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return (data ?? []) as ClsRow[];
    },
  });

  const { data: esps = [] } = useQuery({
    queryKey: ["mc-esps"],
    queryFn: async () => (await supabase.from("biblioteca_especialidades").select("id, nome").order("ordem")).data as { id: string; nome: string }[],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["mc-subs"],
    queryFn: async () => (await supabase.from("biblioteca_subespecialidades").select("id, nome, especialidade_id").order("ordem")).data as { id: string; nome: string; especialidade_id: string }[],
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["mc-cats"],
    queryFn: async () => (await supabase.from("biblioteca_categorias").select("id, nome, subespecialidade_id").order("ordem")).data as { id: string; nome: string; subespecialidade_id: string }[],
  });
  const { data: arts = [] } = useQuery({
    queryKey: ["mc-arts"],
    queryFn: async () => (await supabase.from("biblioteca_artigos").select("id, descricao, unidade, tipo, estado_ia, categoria_id, subespecialidade_id").eq("ativo", true)).data as any[],
  });

  const espMap = useMemo(() => new Map(esps.map((e) => [e.id, e.nome])), [esps]);
  const subMap = useMemo(() => new Map(subs.map((s) => [s.id, s])), [subs]);
  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
  const artMap = useMemo(() => new Map(arts.map((a) => [a.id, a])), [arts]);

  const counts = useMemo(() => {
    const c = { total: rows.length, validado: 0, auto: 0, rever: 0, sem: 0 };
    for (const r of rows) {
      if (r.estado === "validado") c.validado++;
      else if (r.estado === "classificado_auto") c.auto++;
      else if (r.estado === "necessita_revisao") c.rever++;
      else c.sem++;
    }
    return c;
  }, [rows]);

  const validar = async (row: ClsRow) => {
    if (!row.artigo_mestre_id) {
      toast.error("Atribui um Artigo Mestre antes de validar");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("classificacao_artigos")
      .update({ estado: "validado", validado_por: u.user?.id ?? null, validado_em: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Classificação validada");
    qc.invalidateQueries({ queryKey: ["classificacao"] });
  };

  const remover = async (row: ClsRow) => {
    const { error } = await supabase
      .from("classificacao_artigos")
      .update({
        artigo_mestre_id: null, categoria_id: null, subespecialidade_id: null, especialidade_id: null,
        confianca: 0, estado: "sem_classificacao", validado_por: null, validado_em: null,
      })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Classificação removida");
    qc.invalidateQueries({ queryKey: ["classificacao"] });
  };

  const atribuir = async (row: ClsRow, artigoMestreId: string) => {
    const art = artMap.get(artigoMestreId);
    if (!art) return;
    const cat = catMap.get(art.categoria_id);
    const sub = subMap.get(art.subespecialidade_id);
    const { error } = await supabase
      .from("classificacao_artigos")
      .update({
        artigo_mestre_id: artigoMestreId,
        categoria_id: art.categoria_id,
        subespecialidade_id: art.subespecialidade_id,
        especialidade_id: sub?.especialidade_id ?? null,
        confianca: 100,
        estado: "classificado_auto",
      })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Artigo Mestre atribuído");
    qc.invalidateQueries({ queryKey: ["classificacao"] });
    setDialogRow(null);
  };

  const reclassificarAuto = async () => {
    const semClass = rows.filter((r) => r.estado === "sem_classificacao");
    let n = 0;
    for (const r of semClass) {
      const match = arts.filter((a) => a.descricao.toLowerCase() === r.descricao_original.toLowerCase());
      if (match.length === 1) {
        await atribuirSilent(r, match[0].id);
        n++;
      }
    }
    toast.success(`${n} artigo(s) reclassificado(s) automaticamente`);
    qc.invalidateQueries({ queryKey: ["classificacao"] });
  };

  const atribuirSilent = async (row: ClsRow, artigoMestreId: string) => {
    const art = artMap.get(artigoMestreId);
    if (!art) return;
    const sub = subMap.get(art.subespecialidade_id);
    await supabase.from("classificacao_artigos").update({
      artigo_mestre_id: artigoMestreId,
      categoria_id: art.categoria_id,
      subespecialidade_id: art.subespecialidade_id,
      especialidade_id: sub?.especialidade_id ?? null,
      confianca: 100,
      estado: "classificado_auto",
    }).eq("id", row.id);
  };

  return (
    <>
      <PageHeader
        title="Motor de Classificação"
        subtitle="Classifica artigos do Mapa de Quantidades contra a Biblioteca Mestra"
        actions={
          <Button variant="outline" size="sm" onClick={reclassificarAuto}>
            <RotateCw className="h-4 w-4 mr-1" /> Re-correr automática
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total" value={counts.total} />
          <StatCard label="Validados" value={counts.validado} tone="green" />
          <StatCard label="Auto" value={counts.auto} tone="blue" />
          <StatCard label="A rever" value={counts.rever} tone="yellow" />
          <StatCard label="Sem classif." value={counts.sem} tone="muted" />
        </div>

        <Card className="bg-card border-border p-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1.5 min-w-[240px]">
            <label className="text-xs text-muted-foreground">Orçamento / MQ</label>
            <Select
              value={orcamento || "all"}
              onValueChange={(v) => {
                const url = new URL(window.location.href);
                if (v === "all") url.searchParams.delete("orcamento");
                else url.searchParams.set("orcamento", v);
                window.history.replaceState(null, "", url.toString());
                qc.invalidateQueries({ queryKey: ["classificacao"] });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os orçamentos</SelectItem>
                {orcamentos.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome} (v{o.versao})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-[180px]">
            <label className="text-xs text-muted-foreground">Estado</label>
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
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Subespecialidade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Artigo Mestre</TableHead>
                  <TableHead className="w-20">Un.</TableHead>
                  <TableHead className="w-24">Confiança</TableHead>
                  <TableHead className="w-32">Estado</TableHead>
                  <TableHead className="w-48 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">A carregar...</TableCell></TableRow>}
                {!isLoading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Sem artigos para classificar. Importa um MQ para começar.</TableCell></TableRow>
                )}
                {rows.map((r) => {
                  const art = r.artigo_mestre_id ? artMap.get(r.artigo_mestre_id) : null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-[320px]">
                        <div className="text-sm">{r.descricao_original}</div>
                        <div className="text-[10px] text-muted-foreground">{r.unidade_original ?? ""} · qtd {r.quantidade_original ?? "—"}</div>
                      </TableCell>
                      <TableCell className="text-sm">{r.especialidade_id ? espMap.get(r.especialidade_id) : "—"}</TableCell>
                      <TableCell className="text-sm">{r.subespecialidade_id ? subMap.get(r.subespecialidade_id)?.nome : "—"}</TableCell>
                      <TableCell className="text-sm">{r.categoria_id ? catMap.get(r.categoria_id)?.nome : "—"}</TableCell>
                      <TableCell className="text-sm">{art?.descricao ?? "—"}</TableCell>
                      <TableCell className="text-sm">{art?.unidade ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{r.confianca}%</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={ESTADO_META[r.estado].cls}>{ESTADO_META[r.estado].label}</Badge></TableCell>
                      <TableCell className="text-right">
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
                            <Button size="sm" variant="ghost" title="Remover classificação" onClick={() => remover(r)}>
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
        </Card>
      </div>

      <SearchBibliotecaDialog
        open={!!dialogRow}
        onClose={() => setDialogRow(null)}
        onPick={(artId) => dialogRow && atribuir(dialogRow, artId)}
        esps={esps} subs={subs} cats={cats} arts={arts}
        suggestion={dialogRow?.descricao_original ?? ""}
      />
    </>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "green" | "blue" | "yellow" | "muted" }) {
  const cls =
    tone === "green" ? "text-green-600 dark:text-green-400" :
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

function SearchBibliotecaDialog({
  open, onClose, onPick, esps, subs, cats, arts, suggestion,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (artigoMestreId: string) => void;
  esps: { id: string; nome: string }[];
  subs: { id: string; nome: string; especialidade_id: string }[];
  cats: { id: string; nome: string; subespecialidade_id: string }[];
  arts: any[];
  suggestion: string;
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
        <DialogHeader>
          <DialogTitle>Pesquisar na Biblioteca Mestra</DialogTitle>
        </DialogHeader>
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
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-20">Un.</TableHead>
                <TableHead className="w-24">Tipo</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredArts.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sem resultados</TableCell></TableRow>
              )}
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
