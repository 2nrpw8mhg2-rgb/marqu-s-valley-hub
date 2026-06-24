import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  COST_CATEGORIES,
  type CostKey,
  custoTotal,
  pvUnitario,
  totalVenda,
  fmtEUR,
  fmtNum,
  fmtPct,
} from "@/lib/orcamento-utils";
import { AssociarFonteDialog } from "@/components/orcamentos/AssociarFonteDialog";
import {
  ArrowLeft,
  Save,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Link as LinkIcon,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/orcamentos/$id/decomposicao")({
  head: () => ({ meta: [{ title: "Decomposição de Preços — MV OS" }] }),
  component: DecomposicaoPage,
});

type Cap = { id: string; codigo: string | null; descricao: string; ordem: number };
type Art = {
  id: string;
  capitulo_id: string | null;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  margem_pct: number;
  ordem: number;
  custo_mao_obra: number;
  custo_tarefeiros: number;
  custo_subempreitadas: number;
  custo_materiais: number;
  custo_equipamentos: number;
  custo_transportes: number;
  custo_encargos_gerais: number;
  custo_outros: number;
  _dirty?: boolean;
};
type Fonte = {
  id: string;
  artigo_id: string;
  categoria: string;
  subempreiteiro_id: string | null;
  descricao: string;
  valor: number;
  selecionado: boolean;
  notas: string | null;
};

function DecomposicaoPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [fonteDialog, setFonteDialog] = useState<{ artigoId: string | null; cat?: any }>({ artigoId: null });
  const [saving, setSaving] = useState(false);
  const [globalMargin, setGlobalMargin] = useState<number>(0);

  const { data, isLoading } = useQuery({
    queryKey: ["decomposicao", id],
    queryFn: async () => {
      const { data: orc, error: e1 } = await supabase
        .from("orcamentos").select("*, obra:obras(id, nome, codigo, cliente)").eq("id", id).single();
      if (e1) throw e1;
      const { data: caps, error: e2 } = await supabase
        .from("orcamento_capitulos").select("*").eq("orcamento_id", id).order("ordem");
      if (e2) throw e2;
      const { data: arts, error: e3 } = await supabase
        .from("orcamento_artigos").select("*").eq("orcamento_id", id).order("ordem");
      if (e3) throw e3;
      const ids = (arts ?? []).map((a: any) => a.id);
      let fontes: Fonte[] = [];
      if (ids.length) {
        const { data: f, error: e4 } = await supabase
          .from("orcamento_artigo_fontes").select("*").in("artigo_id", ids);
        if (e4) throw e4;
        fontes = (f ?? []).map((x: any) => ({ ...x, valor: Number(x.valor) }));
      }
      return {
        orcamento: orc,
        capitulos: caps as Cap[],
        artigos: (arts as any[]).map(a => ({
          ...a,
          quantidade: Number(a.quantidade),
          margem_pct: Number(a.margem_pct),
          custo_mao_obra: Number(a.custo_mao_obra),
          custo_tarefeiros: Number(a.custo_tarefeiros),
          custo_subempreitadas: Number(a.custo_subempreitadas),
          custo_materiais: Number(a.custo_materiais),
          custo_equipamentos: Number(a.custo_equipamentos),
          custo_transportes: Number(a.custo_transportes),
          custo_encargos_gerais: Number(a.custo_encargos_gerais),
          custo_outros: Number(a.custo_outros),
        })) as Art[],
        fontes,
      };
    },
  });

  const [arts, setArts] = useState<Art[]>([]);
  const [fontes, setFontes] = useState<Fonte[]>([]);
  useEffect(() => {
    if (!data) return;
    setArts(data.artigos);
    setFontes(data.fontes);
    setGlobalMargin(Number(data.orcamento.margem_global_pct) || 0);
  }, [data]);

  const updateArt = (idx: number, patch: Partial<Art>) => {
    setArts(prev => prev.map((a, i) => i === idx ? { ...a, ...patch, _dirty: true } : a));
  };

  const totals = useMemo(() => {
    const totCusto = arts.reduce((s, a) => s + custoTotal(a) * (a.quantidade || 0), 0);
    const totVenda = arts.reduce((s, a) => s + totalVenda(a), 0);
    const lucro = totVenda - totCusto;
    const margem = totCusto > 0 ? (lucro / totCusto) * 100 : 0;
    const porCategoria = COST_CATEGORIES.map(c => ({
      label: c.label,
      key: c.key,
      total: arts.reduce((s, a) => s + (Number(a[c.key]) || 0) * (a.quantidade || 0), 0),
    }));
    return { totCusto, totVenda, lucro, margem, porCategoria };
  }, [arts]);

  const fontesPorArtigo = useMemo(() => {
    const m: Record<string, Fonte[]> = {};
    fontes.forEach(f => { (m[f.artigo_id] ||= []).push(f); });
    return m;
  }, [fontes]);

  const selecionarFonte = async (fonte: Fonte) => {
    // unselect others in same categoria & artigo
    const sameCat = fontes.filter(f => f.artigo_id === fonte.artigo_id && f.categoria === fonte.categoria);
    await supabase.from("orcamento_artigo_fontes")
      .update({ selecionado: false })
      .in("id", sameCat.map(f => f.id));
    await supabase.from("orcamento_artigo_fontes")
      .update({ selecionado: true }).eq("id", fonte.id);

    // update cost column
    const colKey = `custo_${fonte.categoria}` as CostKey;
    const idx = arts.findIndex(a => a.id === fonte.artigo_id);
    if (idx >= 0) updateArt(idx, { [colKey]: fonte.valor } as Partial<Art>);

    setFontes(prev => prev.map(f =>
      f.artigo_id === fonte.artigo_id && f.categoria === fonte.categoria
        ? { ...f, selecionado: f.id === fonte.id }
        : f
    ));
    toast.success("Fonte selecionada");
  };

  const removerFonte = async (id: string) => {
    await supabase.from("orcamento_artigo_fontes").delete().eq("id", id);
    setFontes(prev => prev.filter(f => f.id !== id));
  };

  const aplicarMargemGlobal = () => {
    setArts(prev => prev.map(a => ({ ...a, margem_pct: globalMargin, _dirty: true })));
    toast.success(`Margem ${globalMargin}% aplicada a todos os artigos`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dirty = arts.filter(a => a._dirty);
      for (const a of dirty) {
        const pv = pvUnitario(a);
        const { _dirty, ...rest } = a;
        const { error } = await supabase.from("orcamento_artigos").update({
          ...rest,
          preco_unitario: pv,
        }).eq("id", a.id);
        if (error) throw error;
      }
      // persist global margin
      await supabase.from("orcamentos").update({ margem_global_pct: globalMargin }).eq("id", id);
      toast.success("Decomposição guardada · orçamento comercial atualizado");
      qc.invalidateQueries({ queryKey: ["decomposicao", id] });
      qc.invalidateQueries({ queryKey: ["orcamento", id] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const reloadFontes = async () => {
    const ids = arts.map(a => a.id);
    if (!ids.length) return;
    const { data: f } = await supabase.from("orcamento_artigo_fontes").select("*").in("artigo_id", ids);
    setFontes(((f ?? []) as any[]).map(x => ({ ...x, valor: Number(x.valor) })));
  };

  if (isLoading || !data) {
    return <div className="p-12 text-center text-muted-foreground">A carregar...</div>;
  }

  const capById = new Map(data.capitulos.map(c => [c.id, c]));

  return (
    <>
      <PageHeader
        title="Decomposição de Preços"
        subtitle={`${data.orcamento.nome} · v${data.orcamento.versao}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/orcamentos/$id" params={{ id }}>
              <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Mapa de Quantidades</Button>
            </Link>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "A guardar..." : "Guardar"}
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          <Link to="/orcamentos/$id" params={{ id }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Mapa de Quantidades
          </Link>
          <div className="px-4 py-2 text-sm font-medium border-b-2 border-primary text-foreground">
            Decomposição de Preços
          </div>
        </div>

        {/* Resumo global */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Total de Custos" value={fmtEUR(totals.totCusto)} />
          <SummaryCard label="Total de Venda" value={fmtEUR(totals.totVenda)} accent />
          <SummaryCard label="Lucro Bruto" value={fmtEUR(totals.lucro)} positive={totals.lucro >= 0} />
          <SummaryCard label="Margem Média" value={fmtPct(totals.margem)} />
        </div>

        {/* Distribuição por categoria */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Distribuição de custos por categoria</h3>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Margem global %</Label>
              <Input type="number" step="0.1" value={globalMargin} onChange={e => setGlobalMargin(Number(e.target.value))} className="h-8 w-24" />
              <Button size="sm" variant="outline" onClick={aplicarMargemGlobal}>Aplicar a todos</Button>
            </div>
          </div>
          <div className="space-y-2">
            {totals.porCategoria.map(c => {
              const pct = totals.totCusto > 0 ? (c.total / totals.totCusto) * 100 : 0;
              return (
                <div key={c.key} className="grid grid-cols-[140px_1fr_120px_60px] gap-3 items-center text-xs">
                  <span className="text-muted-foreground">{c.label}</span>
                  <Progress value={pct} className="h-2" />
                  <span className="text-right tabular-nums">{fmtEUR(c.total)}</span>
                  <span className="text-right tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Grelha */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-8"></th>
                  <th className="text-left px-2 py-2 w-20">Código</th>
                  <th className="text-left px-2 py-2 min-w-[200px]">Descrição</th>
                  <th className="text-left px-2 py-2 w-14">Un.</th>
                  <th className="text-right px-2 py-2 w-20">Qtd</th>
                  <th className="text-right px-2 py-2 w-24">Custo Un.</th>
                  <th className="text-right px-2 py-2 w-20">Margem %</th>
                  <th className="text-right px-2 py-2 w-24">PV Unit.</th>
                  <th className="text-right px-2 py-2 w-28">Total Venda</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {arts.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">
                    Sem artigos. Importa um Mapa de Quantidades na aba anterior.
                  </td></tr>
                )}
                {arts.map((a, idx) => {
                  const cap = a.capitulo_id ? capById.get(a.capitulo_id) : null;
                  const prevCap = idx > 0 ? arts[idx - 1].capitulo_id : null;
                  const showCapHeader = cap && a.capitulo_id !== prevCap;
                  const cu = custoTotal(a);
                  const pv = pvUnitario(a);
                  const tv = totalVenda(a);
                  const isExp = expanded[a.id];
                  return (
                    <Fragment key={a.id}>
                      {showCapHeader && cap && (
                        <tr key={`cap-${cap.id}`} className="bg-primary/5 border-t border-border">
                          <td colSpan={10} className="px-3 py-2 font-mono text-xs text-primary font-semibold">
                            {cap.codigo} · <span className="font-sans uppercase tracking-wide">{cap.descricao}</span>
                          </td>
                        </tr>
                      )}
                      <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                        <td className="text-center">
                          <button onClick={() => setExpanded(s => ({ ...s, [a.id]: !s[a.id] }))}>
                            {isExp ? <ChevronDown className="h-4 w-4 mx-auto" /> : <ChevronRight className="h-4 w-4 mx-auto" />}
                          </button>
                        </td>
                        <td className="px-2 font-mono text-[11px]">{a.codigo}</td>
                        <td className="px-2">{a.descricao}</td>
                        <td className="px-2 text-muted-foreground">{a.unidade}</td>
                        <td className="px-2 text-right tabular-nums">{fmtNum(a.quantidade)}</td>
                        <td className="px-2 text-right tabular-nums font-medium">{fmtEUR(cu)}</td>
                        <td className="px-2">
                          <Input
                            className="h-7 text-xs text-right tabular-nums"
                            type="number" step="0.1" value={a.margem_pct}
                            onChange={e => updateArt(idx, { margem_pct: Number(e.target.value) })}
                          />
                        </td>
                        <td className="px-2 text-right tabular-nums">{fmtEUR(pv)}</td>
                        <td className="px-2 text-right tabular-nums font-semibold text-primary">{fmtEUR(tv)}</td>
                        <td className="text-center">
                          <button
                            title="Associar fonte"
                            onClick={() => setFonteDialog({ artigoId: a.id })}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <LinkIcon className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                      {isExp && (
                        <tr className="bg-muted/20">
                          <td colSpan={10} className="p-4">
                            <div className="grid md:grid-cols-2 gap-4">
                              {/* Inputs de custo */}
                              <div>
                                <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Componentes de custo (€/un.)</h4>
                                <div className="grid grid-cols-2 gap-2">
                                  {COST_CATEGORIES.map(c => (
                                    <div key={c.key} className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">{c.label}</Label>
                                      <Input
                                        className="h-7 text-xs text-right tabular-nums"
                                        type="number" step="0.01"
                                        value={a[c.key]}
                                        onChange={e => updateArt(idx, { [c.key]: Number(e.target.value) } as Partial<Art>)}
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3 flex justify-between text-xs">
                                  <span className="text-muted-foreground">Custo unitário</span>
                                  <span className="font-semibold tabular-nums">{fmtEUR(cu)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">PV (custo × {1 + a.margem_pct / 100}) </span>
                                  <span className="font-semibold tabular-nums text-primary">{fmtEUR(pv)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Total venda ({fmtNum(a.quantidade)} {a.unidade ?? ""})</span>
                                  <span className="font-semibold tabular-nums">{fmtEUR(tv)}</span>
                                </div>
                              </div>

                              {/* Fontes */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground">Propostas / cotações associadas</h4>
                                  <Button size="sm" variant="outline" className="h-7 text-xs"
                                    onClick={() => setFonteDialog({ artigoId: a.id })}>
                                    <Plus className="h-3 w-3 mr-1" /> Associar
                                  </Button>
                                </div>
                                <div className="space-y-1">
                                  {(fontesPorArtigo[a.id] ?? []).length === 0 && (
                                    <p className="text-xs text-muted-foreground italic">Sem propostas associadas.</p>
                                  )}
                                  {(fontesPorArtigo[a.id] ?? []).map(f => {
                                    const cat = COST_CATEGORIES.find(c => c.fonte === f.categoria);
                                    return (
                                      <div key={f.id} className="flex items-center gap-2 p-2 rounded border border-border bg-card text-xs">
                                        <button onClick={() => selecionarFonte(f)} title="Selecionar (alimenta custo)">
                                          {f.selecionado
                                            ? <CheckCircle2 className="h-4 w-4 text-primary" />
                                            : <Circle className="h-4 w-4 text-muted-foreground" />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                          <div className="truncate font-medium">{f.descricao}</div>
                                          <div className="text-[10px] text-muted-foreground">{cat?.label ?? f.categoria}</div>
                                        </div>
                                        <div className="tabular-nums font-semibold">{fmtEUR(f.valor)}</div>
                                        <button onClick={() => removerFonte(f.id)} className="text-muted-foreground hover:text-destructive">
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 border-t border-border">
                  <td colSpan={5} className="px-3 py-2 text-right font-medium">Totais</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold">{fmtEUR(totals.totCusto)}</td>
                  <td></td>
                  <td></td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold text-primary">{fmtEUR(totals.totVenda)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>

      <AssociarFonteDialog
        open={!!fonteDialog.artigoId}
        artigoId={fonteDialog.artigoId}
        onClose={() => setFonteDialog({ artigoId: null })}
        onCreated={reloadFontes}
      />
    </>
  );
}

function SummaryCard({ label, value, accent, positive }: { label: string; value: string; accent?: boolean; positive?: boolean }) {
  return (
    <Card className={`p-4 ${accent ? "bg-primary/5 border-primary/20" : ""}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${
        accent ? "text-primary" : positive === false ? "text-destructive" : ""
      }`}>{value}</div>
    </Card>
  );
}
