import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Save, Send, Trash2, Search } from "lucide-react";
import { ESPECIALIDADES } from "@/lib/procurement/especialidades";

export const Route = createFileRoute("/_app/procurement/pacotes/$id")({
  head: () => ({ meta: [{ title: "Pacote — Procurement — MV OS" }] }),
  component: PacoteDetailPage,
});

const ESTADO_LABEL: Record<string, string> = {
  por_preparar: "Por preparar", preparado: "Preparado", enviado: "Enviado",
  em_analise: "Em análise", adjudicado: "Adjudicado", cancelado: "Cancelado",
};

function fmtEUR(n: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n || 0);
}

function PacoteDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [adicionarOpen, setAdicionarOpen] = useState(false);

  const { data: pacote, isLoading } = useQuery({
    queryKey: ["procurement-pacote", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procurement_pacotes")
        .select("*, orcamento:orcamentos(id, nome, versao, obra:obras(id, nome, codigo))")
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: artigos = [] } = useQuery({
    queryKey: ["procurement-pacote-artigos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procurement_pacote_artigos")
        .select("*").eq("pacote_id", id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [nome, setNome] = useState("");
  const [especialidade, setEspecialidade] = useState("Outros");
  const [estado, setEstado] = useState("por_preparar");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (pacote) {
      setNome(pacote.nome); setEspecialidade(pacote.especialidade);
      setEstado(pacote.estado); setObservacoes(pacote.observacoes ?? "");
    }
  }, [pacote?.id]);

  const totalValor = useMemo(
    () => artigos.reduce((s: number, a: any) => s + Number(a.quantidade ?? 0) * Number(a.preco_seco_estimado ?? 0), 0),
    [artigos],
  );

  async function salvarHeader() {
    const { error } = await supabase.from("procurement_pacotes")
      .update({ nome, especialidade, estado: estado as any, observacoes })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pacote guardado");
    qc.invalidateQueries({ queryKey: ["procurement-pacote", id] });
    qc.invalidateQueries({ queryKey: ["procurement-pacotes"] });
  }

  async function removerArtigo(artigoId: string) {
    const { error } = await supabase.from("procurement_pacote_artigos").delete().eq("id", artigoId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["procurement-pacote-artigos", id] });
  }

  async function atualizarArtigo(artigoId: string, patch: { quantidade?: number; preco_seco_estimado?: number }) {
    const { error } = await supabase.from("procurement_pacote_artigos").update(patch).eq("id", artigoId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["procurement-pacote-artigos", id] });
  }

  async function prepararEnvio() {
    setEstado("preparado");
    const { error } = await supabase.from("procurement_pacotes").update({ estado: "preparado" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pacote pronto para envio (módulo de envio chega no próximo passo)");
    qc.invalidateQueries({ queryKey: ["procurement-pacote", id] });
  }

  if (isLoading || !pacote) {
    return <div className="p-12 text-center text-muted-foreground">A carregar pacote...</div>;
  }

  return (
    <>
      <PageHeader
        title={nome || "Pacote"}
        subtitle={
          pacote.orcamento
            ? `${pacote.orcamento.obra?.codigo ? pacote.orcamento.obra.codigo + " · " : ""}${pacote.orcamento.nome} (v${pacote.orcamento.versao})`
            : "Pacote de consulta"
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/procurement/pacotes"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Link>
            </Button>
            <Button onClick={salvarHeader}><Save className="h-4 w-4 mr-2" /> Guardar</Button>
            <Button variant="default" onClick={prepararEnvio} disabled={artigos.length === 0}>
              <Send className="h-4 w-4 mr-2" /> Preparar envio
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        <Card className="p-4 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label>Nome do pacote</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Especialidade</Label>
            <Select value={especialidade} onValueChange={setEspecialidade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ESPECIALIDADES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ESTADO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-4">
            <Label>Observações internas</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <h2 className="text-sm font-semibold">Artigos do pacote</h2>
              <p className="text-xs text-muted-foreground">{artigos.length} artigo(s) · Total estimado {fmtEUR(totalValor)}</p>
            </div>
            <Button size="sm" onClick={() => setAdicionarOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar artigos
            </Button>
          </div>
          {artigos.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Pacote vazio. Adiciona artigos do orçamento associado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Capítulo</TableHead>
                  <TableHead>Un.</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preço seco</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artigos.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.codigo ?? "—"}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm">{a.descricao}</p>
                      {a.especialidade && a.especialidade !== especialidade && (
                        <Badge variant="outline" className="mt-1 text-[10px]">Sugerida: {a.especialidade}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.capitulo ?? "—"}</TableCell>
                    <TableCell className="text-sm">{a.unidade ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number" step="0.01" defaultValue={a.quantidade}
                        className="w-24 text-right ml-auto"
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== Number(a.quantidade)) atualizarArtigo(a.id, { quantidade: v });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number" step="0.01" defaultValue={a.preco_seco_estimado}
                        className="w-28 text-right ml-auto"
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== Number(a.preco_seco_estimado)) atualizarArtigo(a.id, { preco_seco_estimado: v });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {fmtEUR(Number(a.quantidade ?? 0) * Number(a.preco_seco_estimado ?? 0))}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removerArtigo(a.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <AdicionarArtigosDialog
        open={adicionarOpen} onOpenChange={setAdicionarOpen}
        pacoteId={id} orcamentoId={pacote.orcamento_id} especialidade={especialidade}
        artigosJaIncluidos={new Set(artigos.map((a: any) => a.artigo_id).filter(Boolean))}
        onAdded={() => qc.invalidateQueries({ queryKey: ["procurement-pacote-artigos", id] })}
      />
    </>
  );
}

function AdicionarArtigosDialog({
  open, onOpenChange, pacoteId, orcamentoId, especialidade, artigosJaIncluidos, onAdded,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  pacoteId: string; orcamentoId: string; especialidade: string;
  artigosJaIncluidos: Set<string>; onAdded: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: artigos = [] } = useQuery({
    queryKey: ["orcamento-artigos-disponiveis", orcamentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamento_artigos")
        .select("id, codigo, descricao, unidade, quantidade, preco_unitario, custo_mao_obra, custo_tarefeiros, custo_subempreitadas, custo_materiais, custo_equipamentos, custo_transportes, custo_encargos_gerais, custo_outros, capitulo:orcamento_capitulos(descricao)")
        .eq("orcamento_id", orcamentoId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const disponiveis = useMemo(() => {
    const q = search.toLowerCase();
    return artigos
      .filter((a: any) => !artigosJaIncluidos.has(a.id))
      .filter((a: any) => !q || a.descricao?.toLowerCase().includes(q) || a.codigo?.toLowerCase().includes(q));
  }, [artigos, artigosJaIncluidos, search]);

  function toggle(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function adicionar() {
    if (selecionados.size === 0) return;
    setSaving(true);
    const rows = artigos.filter((a: any) => selecionados.has(a.id)).map((a: any) => {
      const custoTotal = Number(a.custo_mao_obra ?? 0) + Number(a.custo_tarefeiros ?? 0)
        + Number(a.custo_subempreitadas ?? 0) + Number(a.custo_materiais ?? 0)
        + Number(a.custo_equipamentos ?? 0) + Number(a.custo_transportes ?? 0)
        + Number(a.custo_encargos_gerais ?? 0) + Number(a.custo_outros ?? 0);
      return {
        pacote_id: pacoteId, artigo_id: a.id, codigo: a.codigo, descricao: a.descricao,
        unidade: a.unidade, quantidade: a.quantidade,
        capitulo: a.capitulo?.descricao ?? null, subcapitulo: null,
        preco_seco_estimado: custoTotal > 0 ? custoTotal : Number(a.preco_unitario ?? 0),
        categoria_custo: null, especialidade,
      };
    });
    const { error } = await supabase.from("procurement_pacote_artigos").insert(rows);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} artigo(s) adicionado(s)`);
    setSelecionados(new Set()); setSearch("");
    onAdded(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Adicionar artigos ao pacote</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Pesquisar por código ou descrição..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Capítulo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">PV unit.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disponiveis.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem artigos disponíveis.</TableCell></TableRow>
                ) : disponiveis.map((a: any) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => toggle(a.id)}>
                    <TableCell><Checkbox checked={selecionados.has(a.id)} onCheckedChange={() => toggle(a.id)} /></TableCell>
                    <TableCell className="font-mono text-xs">{a.codigo ?? "—"}</TableCell>
                    <TableCell className="text-sm max-w-md truncate">{a.descricao}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.capitulo?.descricao ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">{Number(a.quantidade).toFixed(2)}</TableCell>
                    <TableCell className="text-right text-sm">{fmtEUR(Number(a.preco_unitario))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter>
          <span className="mr-auto text-sm text-muted-foreground">{selecionados.size} selecionado(s)</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={adicionar} disabled={saving || selecionados.size === 0}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
