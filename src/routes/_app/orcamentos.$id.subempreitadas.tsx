import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { fmtEUR } from "@/lib/orcamento-utils";
import { classificarOrcamento, alterarSubempreitadaArtigo } from "@/lib/subempreitadas/classify.functions";
import { gerarPacotesSubempreitadas } from "@/lib/subempreitadas/pacotes.functions";
import { exportarExcelPorSubempreitada, exportarPDFPorSubempreitada, type ArtigoExport } from "@/lib/subempreitadas/export";
import { ArrowLeft, Wand2, FileSpreadsheet, FileDown, Send, CheckCircle2, AlertTriangle, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/orcamentos/$id/subempreitadas")({
  head: () => ({ meta: [{ title: "Separação por subempreitada — MV OS" }] }),
  component: SubempreitadasOrcamento,
});

type Artigo = {
  id: string;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  preco_unitario: number;
  capitulo_id: string | null;
  subempreitada_id: string | null;
  subempreitada_confianca: number | null;
  subempreitada_origem: string | null;
  subempreitada_validada_manual: boolean;
};

type Cap = { id: string; codigo: string | null; descricao: string };
type Sub = { id: string; codigo: string; nome: string; ordem: number };

function SubempreitadasOrcamento() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [filtroSub, setFiltroSub] = useState<string>("todas");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [texto, setTexto] = useState("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [gerando, setGerando] = useState(false);
  const classificarFn = useServerFn(classificarOrcamento);
  const alterarFn = useServerFn(alterarSubempreitadaArtigo);
  const gerarPacotesFn = useServerFn(gerarPacotesSubempreitadas);

  const { data, isLoading } = useQuery({
    queryKey: ["orc-subempreitadas", id],
    refetchOnMount: "always",
    queryFn: async () => {
      const [{ data: orc }, { data: arts }, { data: caps }, { data: subs }] = await Promise.all([
        supabase.from("orcamentos").select("id, nome, obra:obras(nome, cliente)").eq("id", id).single(),
        supabase.from("orcamento_artigos").select("*").eq("orcamento_id", id).order("ordem"),
        supabase.from("orcamento_capitulos").select("id, codigo, descricao").eq("orcamento_id", id),
        supabase.from("subempreitadas").select("id, codigo, nome, ordem").eq("ativo", true).order("ordem"),
      ]);
      return {
        orcamento: orc as any,
        artigos: (arts ?? []).map((a: any) => ({ ...a, quantidade: Number(a.quantidade), preco_unitario: Number(a.preco_unitario) })) as Artigo[],
        capitulos: (caps ?? []) as Cap[],
        subs: (subs ?? []) as Sub[],
      };
    },
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const bySub = new Map<string, { count: number; total: number; baixa: number; valida: number }>();
    let semSub = 0;
    let baixaGlobal = 0;
    let conflitos = 0;
    let semRegra = 0;
    let totalGlobal = 0;
    for (const a of data.artigos) {
      const t = a.quantidade * a.preco_unitario;
      totalGlobal += t;
      if (!a.subempreitada_id) {
        semSub++;
        if (a.subempreitada_origem === "conflito") conflitos++;
        else if (a.subempreitada_origem === "baixa_confianca") baixaGlobal++;
        else semRegra++;
        continue;
      }
      const cur = bySub.get(a.subempreitada_id) ?? { count: 0, total: 0, baixa: 0, valida: 0 };
      cur.count++;
      cur.total += t;
      if (a.subempreitada_validada_manual) cur.valida++;
      if ((a.subempreitada_confianca ?? 0) < 0.7 && !a.subempreitada_validada_manual) {
        cur.baixa++;
        baixaGlobal++;
      }
      bySub.set(a.subempreitada_id, cur);
    }
    return { bySub, semSub, baixaGlobal, conflitos, semRegra, totalGlobal };
  }, [data]);

  const capMap = useMemo(() => new Map((data?.capitulos ?? []).map((c) => [c.id, c])), [data]);
  const subMap = useMemo(() => new Map((data?.subs ?? []).map((s) => [s.id, s])), [data]);

  const filtradas = useMemo(() => {
    if (!data) return [];
    const t = texto.toLowerCase().trim();
    return data.artigos.filter((a) => {
      if (filtroSub !== "todas") {
        if (filtroSub === "sem" && a.subempreitada_id) return false;
        if (filtroSub !== "sem" && a.subempreitada_id !== filtroSub) return false;
      }
      if (filtroEstado === "baixa" && a.subempreitada_origem !== "baixa_confianca") return false;
      if (filtroEstado === "conflito" && a.subempreitada_origem !== "conflito") return false;
      if (filtroEstado === "sem_regra" && a.subempreitada_origem !== "sem_regra") return false;
      if (filtroEstado === "validado" && !a.subempreitada_validada_manual) return false;
      if (filtroEstado === "sem" && a.subempreitada_id) return false;
      if (t && !`${a.codigo ?? ""} ${a.descricao}`.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [data, filtroSub, filtroEstado, texto]);

  const reclassificar = async () => {
    const t = toast.loading("A reclassificar...");
    try {
      const r = await classificarFn({ data: { orcamento_id: id } });
      toast.success(`${r.atribuidos} de ${r.total} artigos classificados; ${r.sem_atribuir} necessitam de revisão.`, { id: t });
      qc.invalidateQueries({ queryKey: ["orc-subempreitadas", id] });
    } catch (e: any) {
      toast.error(e.message, { id: t });
    }
  };

  const alterar = async (artigoId: string, subId: string | null) => {
    try {
      await alterarFn({ data: { artigo_id: artigoId, subempreitada_id: subId } });
      qc.invalidateQueries({ queryKey: ["orc-subempreitadas", id] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const gerarPacotes = async () => {
    if (!stats) return;
    if (stats.semSub > 0 || stats.baixaGlobal > 0) {
      setFiltroEstado(stats.semSub > 0 ? "sem" : "baixa");
      setActiveTab("separacao");
      toast.error("A separação ainda precisa de validação", {
        description: `${stats.semRegra} sem regra, ${stats.baixaGlobal} com baixa confiança e ${stats.conflitos} com conflito.`,
      });
      return;
    }

    setGerando(true);
    const t = toast.loading("A gerar pacotes de consulta...");
    try {
      const r = await gerarPacotesFn({ data: { orcamento_id: id } });
      toast.success(
        `${r.pacotes_criados} pacote(s) criado(s), ${r.pacotes_atualizados} atualizado(s) e ${r.artigos_incluidos} artigo(s) incluído(s).`,
        { id: t },
      );
      navigate({ to: "/procurement/pacotes" });
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível gerar os pacotes", { id: t });
    } finally {
      setGerando(false);
    }
  };

  const construirArtigosExport = (): ArtigoExport[] => {
    if (!data) return [];
    return data.artigos.map((a) => {
      const cap = a.capitulo_id ? capMap.get(a.capitulo_id) : null;
      const sub = a.subempreitada_id ? subMap.get(a.subempreitada_id) : null;
      return {
        codigo: a.codigo,
        capitulo_codigo: cap?.codigo ?? null,
        capitulo_descricao: cap?.descricao ?? null,
        descricao: a.descricao,
        unidade: a.unidade,
        quantidade: a.quantidade,
        preco_unitario: a.preco_unitario,
        subempreitada_id: a.subempreitada_id,
        subempreitada_nome: sub?.nome ?? null,
      };
    });
  };

  const subsSelecionadas = () => {
    if (!data) return [];
    const ids = selecionadas.size ? Array.from(selecionadas) : data.subs.map((s) => s.id);
    return ids.map((sid) => data.subs.find((s) => s.id === sid)).filter(Boolean).map((s) => ({ id: s!.id, nome: s!.nome }));
  };

  const doExcel = (proposta = false) => {
    if (!data) return;
    exportarExcelPorSubempreitada({
      orcamento_nome: data.orcamento.nome,
      obra_nome: data.orcamento.obra?.nome ?? "",
      obra_cliente: data.orcamento.obra?.cliente ?? null,
      subempreitadas_selecionadas: subsSelecionadas(),
      artigos: construirArtigosExport(),
      pedido_proposta: proposta,
    });
  };
  const doPDF = (proposta = false) => {
    if (!data) return;
    exportarPDFPorSubempreitada({
      orcamento_nome: data.orcamento.nome,
      obra_nome: data.orcamento.obra?.nome ?? "",
      obra_cliente: data.orcamento.obra?.cliente ?? null,
      subempreitadas_selecionadas: subsSelecionadas(),
      artigos: construirArtigosExport(),
      pedido_proposta: proposta,
    });
  };

  if (isLoading || !data || !stats) return <div className="p-6 text-muted-foreground">A carregar...</div>;

  return (
    <>
      <PageHeader
        title={`Separação por subempreitada — ${data.orcamento.nome}`}
        subtitle="Cada artigo é atribuído automaticamente à subempreitada que executa aquele trabalho"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/orcamentos/$id" params={{ id }}>
              <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
            </Link>
            <Button variant="outline" onClick={reclassificar}><Wand2 className="h-4 w-4 mr-1" /> Reclassificar</Button>
            <Button onClick={gerarPacotes} disabled={gerando}>
              <ShoppingCart className="h-4 w-4 mr-1" /> {gerando ? "A gerar..." : "Gerar pacotes"}
            </Button>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="separacao">Separação por subempreitada</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Card className="p-4"><div className="text-xs text-muted-foreground">Total do orçamento</div><div className="text-2xl font-semibold">{fmtEUR(stats.totalGlobal)}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Artigos sem subempreitada</div><div className="text-2xl font-semibold">{stats.semSub}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Necessitam validação</div><div className="text-2xl font-semibold text-amber-500">{stats.baixaGlobal}</div></Card>
              <Card className="p-4"><div className="text-xs text-muted-foreground">Subempreitadas ativas</div><div className="text-2xl font-semibold">{stats.bySub.size}</div></Card>
            </div>

            <Card className={`p-4 border ${stats.semSub > 0 || stats.baixaGlobal > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {stats.semSub > 0 || stats.baixaGlobal > 0 ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                    {stats.semSub > 0 || stats.baixaGlobal > 0
                      ? "Revisão necessária antes de gerar"
                      : "Separação pronta para gerar pacotes"}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {stats.semSub > 0 || stats.baixaGlobal > 0
                      ? `${stats.semRegra} sem regra, ${stats.baixaGlobal} com baixa confiança e ${stats.conflitos} com conflito.`
                      : `Os artigos estão distribuídos por ${stats.bySub.size} subempreitada(s). A geração pode ser repetida sem duplicar pacotes enquanto estiverem por preparar.`}
                  </p>
                </div>
                {stats.semSub > 0 || stats.baixaGlobal > 0 ? (
                  <Button variant="outline" onClick={() => {
                    setFiltroEstado(stats.semSub > 0 ? "sem" : "baixa");
                    setActiveTab("separacao");
                  }}>
                    Rever artigos
                  </Button>
                ) : (
                  <Button onClick={gerarPacotes} disabled={gerando}>
                    <ShoppingCart className="h-4 w-4 mr-1" /> {gerando ? "A gerar..." : "Gerar pacotes de consulta"}
                  </Button>
                )}
              </div>
            </Card>

            <Card>
              <div className="p-4 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">Selecionar subempreitadas para exportar</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => doExcel(false)}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
                  <Button size="sm" variant="outline" onClick={() => doPDF(false)}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
                  <Button size="sm" onClick={() => doPDF(true)}><Send className="h-4 w-4 mr-1" /> Pedido de proposta (PDF)</Button>
                  <Button size="sm" variant="secondary" onClick={() => doExcel(true)}><Send className="h-4 w-4 mr-1" /> Pedido de proposta (Excel)</Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Subempreitada</TableHead>
                    <TableHead className="text-right">Artigos</TableHead>
                    <TableHead className="text-right">Validação</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">A validar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.subs.map((s) => {
                    const st = stats.bySub.get(s.id) ?? { count: 0, total: 0, baixa: 0, valida: 0 };
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Checkbox
                            checked={selecionadas.has(s.id)}
                            onCheckedChange={(v) => {
                              const n = new Set(selecionadas);
                              if (v) n.add(s.id); else n.delete(s.id);
                              setSelecionadas(n);
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{s.nome}</TableCell>
                        <TableCell className="text-right">{st.count}</TableCell>
                        <TableCell className="text-right">{st.valida > 0 && <span className="text-xs text-emerald-500">{st.valida} validados</span>}</TableCell>
                        <TableCell className="text-right font-mono">{fmtEUR(st.total)}</TableCell>
                        <TableCell className="text-right">{st.baixa > 0 && <Badge variant="outline" className="border-amber-500/40 text-amber-500">{st.baixa}</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                  {stats.semSub > 0 && (
                    <TableRow>
                      <TableCell></TableCell>
                      <TableCell className="text-muted-foreground italic">Sem subempreitada atribuída</TableCell>
                      <TableCell className="text-right">{stats.semSub}</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="separacao" className="space-y-3">
            <Card className="p-3 flex flex-wrap gap-2 items-center">
              <Input placeholder="Pesquisar código ou descrição..." value={texto} onChange={(e) => setTexto(e.target.value)} className="max-w-xs" />
              <Select value={filtroSub} onValueChange={setFiltroSub}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as subempreitadas</SelectItem>
                  <SelectItem value="sem">Sem subempreitada</SelectItem>
                  {data.subs.map((s) => (<SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os estados</SelectItem>
                  <SelectItem value="baixa">Baixa confiança</SelectItem>
                  <SelectItem value="conflito">Conflito</SelectItem>
                  <SelectItem value="sem_regra">Sem regra</SelectItem>
                  <SelectItem value="validado">Validado manualmente</SelectItem>
                  <SelectItem value="sem">Sem subempreitada</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto text-xs text-muted-foreground">{filtradas.length} artigos</div>
            </Card>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead className="w-32">Capítulo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-16">Un.</TableHead>
                    <TableHead className="text-right w-20">Qtd.</TableHead>
                    <TableHead className="text-right w-24">Preço</TableHead>
                    <TableHead className="text-right w-24">Total</TableHead>
                    <TableHead className="w-56">Subempreitada</TableHead>
                    <TableHead className="w-32">Confiança</TableHead>
                    <TableHead className="w-24">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((a) => {
                    const cap = a.capitulo_id ? capMap.get(a.capitulo_id) : null;
                    const conf = a.subempreitada_confianca ?? 0;
                    const baixa = conf < 0.7 && !a.subempreitada_validada_manual;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.codigo ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-32">{cap?.codigo ?? ""} {cap?.descricao ?? ""}</TableCell>
                        <TableCell className="text-sm">{a.descricao}</TableCell>
                        <TableCell className="text-xs">{a.unidade ?? ""}</TableCell>
                        <TableCell className="text-right text-xs">{a.quantidade}</TableCell>
                        <TableCell className="text-right text-xs">{fmtEUR(a.preco_unitario)}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{fmtEUR(a.quantidade * a.preco_unitario)}</TableCell>
                        <TableCell>
                          <Select value={a.subempreitada_id ?? "__none__"} onValueChange={(v) => alterar(a.id, v === "__none__" ? null : v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— sem —</SelectItem>
                              {data.subs.map((s) => (<SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {a.subempreitada_id ? (
                            <div className="flex items-center gap-1">
                              <Progress value={conf * 100} className="h-1.5" />
                              <span className="text-xs w-8 text-right">{Math.round(conf * 100)}%</span>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {a.subempreitada_validada_manual ? (
                            <Badge variant="secondary" className="text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Validado</Badge>
                          ) : !a.subempreitada_id ? (
                            <Badge variant="outline" className="text-xs">
                              {a.subempreitada_origem === "conflito"
                                ? "Conflito"
                                : a.subempreitada_origem === "baixa_confianca"
                                  ? "Baixa"
                                  : "Sem regra"}
                            </Badge>
                          ) : baixa ? (
                            <Badge variant="outline" className="border-amber-500/40 text-amber-500 text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Validar</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Auto</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
