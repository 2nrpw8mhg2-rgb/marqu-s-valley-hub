import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  aplicarSeparacaoConsultaIA,
  estadoSeparacaoConsultaIA,
  prepararSeparacaoConsultaIA,
  processarLotesConsultaIA,
  validarClassificacoesConsultaIA,
} from "@/lib/consultas/separacao.functions";
import { exportarExcelPorSubempreitada, exportarPDFPorSubempreitada } from "@/lib/subempreitadas/export";

export const Route = createFileRoute("/_app/obras/$id/preparacao-consultas")({
  component: PreparacaoConsultas,
  head: () => ({
    meta: [
      { title: "Preparação de Consultas · MV OC" },
      {
        name: "description",
        content:
          "Separação integral do Mapa de Quantidades por subempreitada com inteligência artificial, com revisão humana e mapas de consulta ao mercado.",
      },
      { property: "og:title", content: "Preparação de Consultas · MV OC" },
      {
        property: "og:description",
        content: "Separação do Mapa de Quantidades por subempreitada com IA e validação humana.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Linha = {
  artigo_id: string;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  preco_unitario: number;
  capitulo_codigo: string | null;
  capitulo_descricao: string | null;
  subempreitada_id: string | null;
  trabalho_principal: string | null;
  confianca: number;
  justificacao: string | null;
  necessita_revisao: boolean;
  validado_manual: boolean;
  sugestao_nova_subempreitada: string | null;
};

const SEM_SUB = "__sem__";

function PreparacaoConsultas() {
  const { id: obraId } = Route.useParams();
  const qc = useQueryClient();
  const iniciar = useServerFn(iniciarSeparacaoConsultaIA);
  const processar = useServerFn(processarLoteConsultaIA);
  const estadoFn = useServerFn(estadoSeparacaoConsultaIA);
  const validar = useServerFn(validarClassificacoesConsultaIA);
  const aplicar = useServerFn(aplicarSeparacaoConsultaIA);

  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const [aCorrer, setACorrer] = useState(false);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const [falhados, setFalhados] = useState<string[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState<"todos" | "revisao" | "sem">("todos");
  const [destino, setDestino] = useState<string>(SEM_SUB);
  const [estado, setEstado] = useState<Awaited<ReturnType<typeof estadoSeparacaoConsultaIA>> | null>(null);

  const { data: obra } = useQuery({
    queryKey: ["obra", obraId],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, nome, cliente").eq("id", obraId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: orcamentos } = useQuery({
    queryKey: ["consultas-orcamentos", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id, nome, created_at")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) setOrcamentoId((atual) => atual ?? data[0].id);
      return data ?? [];
    },
  });

  const { data: subempreitadas } = useQuery({
    queryKey: ["subempreitadas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subempreitadas")
        .select("id, codigo, nome")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: linhas, isFetching } = useQuery({
    queryKey: ["consultas-linhas", orcamentoId],
    enabled: Boolean(orcamentoId),
    queryFn: async (): Promise<Linha[]> => {
      const { data: artigos, error } = await supabase
        .from("orcamento_artigos")
        .select(
          "id, codigo, descricao, unidade, quantidade, preco_unitario, ordem, capitulo:orcamento_capitulos(codigo, descricao)",
        )
        .eq("orcamento_id", orcamentoId!)
        .order("ordem", { ascending: true });
      if (error) throw error;

      const { data: cls, error: e2 } = await supabase
        .from("consulta_ia_classificacoes")
        .select(
          "artigo_id, subempreitada_id, trabalho_principal, confianca, justificacao, necessita_revisao, validado_manual, sugestao_nova_subempreitada",
        )
        .eq("orcamento_id", orcamentoId!);
      if (e2) throw e2;
      const porArtigo = new Map((cls ?? []).map((c: any) => [c.artigo_id, c]));

      return (artigos ?? []).map((a: any) => {
        const cap = Array.isArray(a.capitulo) ? a.capitulo[0] : a.capitulo;
        const c: any = porArtigo.get(a.id);
        return {
          artigo_id: a.id,
          codigo: a.codigo,
          descricao: a.descricao,
          unidade: a.unidade,
          quantidade: Number(a.quantidade ?? 0),
          preco_unitario: Number(a.preco_unitario ?? 0),
          capitulo_codigo: cap?.codigo ?? null,
          capitulo_descricao: cap?.descricao ?? null,
          subempreitada_id: c?.subempreitada_id ?? null,
          trabalho_principal: c?.trabalho_principal ?? null,
          confianca: Number(c?.confianca ?? 0),
          justificacao: c?.justificacao ?? null,
          necessita_revisao: Boolean(c?.necessita_revisao),
          validado_manual: Boolean(c?.validado_manual),
          sugestao_nova_subempreitada: c?.sugestao_nova_subempreitada ?? null,
          classificado: Boolean(c),
        } as Linha;
      });
    },
  });

  const nomePorSub = useMemo(
    () => new Map((subempreitadas ?? []).map((s) => [s.id, `${s.codigo} · ${s.nome}`])),
    [subempreitadas],
  );

  const visiveis = useMemo(() => {
    const todas = linhas ?? [];
    if (filtro === "revisao") return todas.filter((l) => l.necessita_revisao && !l.validado_manual);
    if (filtro === "sem") return todas.filter((l) => !l.subempreitada_id);
    return todas;
  }, [linhas, filtro]);

  const agrupadas = useMemo(() => {
    const grupos = new Map<string, Linha[]>();
    for (const l of visiveis) {
      const chave = l.subempreitada_id ?? SEM_SUB;
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push(l);
    }
    return [...grupos.entries()].sort((a, b) => (a[0] === SEM_SUB ? 1 : b[0] === SEM_SUB ? -1 : 0));
  }, [visiveis]);

  async function correrLotes(lotes: string[][], runId: string, jaFeitos: number, total: number) {
    const porFalhar: string[] = [];
    let feitos = jaFeitos;
    for (const lote of lotes) {
      try {
        const r = await processar({ data: { run_id: runId, orcamento_id: orcamentoId!, artigo_ids: lote } });
        porFalhar.push(...r.falhados);
      } catch (e: any) {
        porFalhar.push(...lote);
        toast.error(e?.message ?? "Um lote falhou. Pode repetir apenas os artigos afetados.");
      }
      feitos += lote.length;
      setProgresso({ feitos, total });
    }
    setFalhados(porFalhar);
    await qc.invalidateQueries({ queryKey: ["consultas-linhas", orcamentoId] });
    const est = await estadoFn({ data: { orcamento_id: orcamentoId! } });
    setEstado(est);
    return porFalhar;
  }

  async function separarComIA() {
    if (!orcamentoId) return;
    setACorrer(true);
    setFalhados([]);
    try {
      const inicio = await iniciar({ data: { orcamento_id: orcamentoId, obra_id: obraId } });
      setProgresso({ feitos: inicio.ja_validados, total: inicio.total_artigos });
      const restantes = await correrLotes(inicio.lotes, inicio.run_id, inicio.ja_validados, inicio.total_artigos);
      if (restantes.length === 0) toast.success("Separação concluída. Reveja as classificações assinaladas.");
      else toast.warning(`${restantes.length} artigos ficaram por classificar. Pode repetir só esses.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível iniciar a separação.");
    } finally {
      setACorrer(false);
    }
  }

  async function repetirFalhados() {
    if (!orcamentoId || falhados.length === 0) return;
    setACorrer(true);
    try {
      const inicio = await iniciar({ data: { orcamento_id: orcamentoId, obra_id: obraId } });
      const lotes: string[][] = [];
      for (let i = 0; i < falhados.length; i += 20) lotes.push(falhados.slice(i, i + 20));
      const restantes = await correrLotes(lotes, inicio.run_id, 0, falhados.length);
      if (restantes.length === 0) toast.success("Todos os artigos em falta foram classificados.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível repetir os artigos em falta.");
    } finally {
      setACorrer(false);
    }
  }

  async function verificar() {
    if (!orcamentoId) return;
    const est = await estadoFn({ data: { orcamento_id: orcamentoId } });
    setEstado(est);
    setFalhados(est.artigos_em_falta);
    toast.info(est.completo ? "Todos os artigos estão processados." : `${est.em_falta} artigos ainda por processar.`);
  }

  async function confirmarSelecionados(subId: string | null) {
    if (!orcamentoId || selecionados.size === 0) return;
    try {
      await validar({
        data: { orcamento_id: orcamentoId, artigo_ids: [...selecionados], subempreitada_id: subId },
      });
      toast.success(`${selecionados.size} artigos confirmados.`);
      setSelecionados(new Set());
      await qc.invalidateQueries({ queryKey: ["consultas-linhas", orcamentoId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível guardar a validação.");
    }
  }

  async function aplicarAoMQ() {
    if (!orcamentoId) return;
    try {
      const r = await aplicar({ data: { orcamento_id: orcamentoId } });
      toast.success(`Mapa de Quantidades organizado: ${r.aplicados} artigos.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível organizar o Mapa de Quantidades.");
    }
  }

  function exportar(tipo: "excel" | "pdf") {
    const usados = [...new Set((linhas ?? []).map((l) => l.subempreitada_id).filter(Boolean) as string[])];
    const input = {
      orcamento_nome: orcamentos?.find((o) => o.id === orcamentoId)?.nome ?? "orcamento",
      obra_nome: obra?.nome ?? "Obra",
      obra_cliente: obra?.cliente ?? null,
      subempreitadas_selecionadas: usados.map((id) => ({ id, nome: nomePorSub.get(id) ?? id })),
      artigos: (linhas ?? []).map((l) => ({
        codigo: l.codigo,
        capitulo_codigo: l.capitulo_codigo,
        capitulo_descricao: l.capitulo_descricao,
        descricao: l.descricao,
        unidade: l.unidade,
        quantidade: l.quantidade,
        preco_unitario: l.preco_unitario,
        subempreitada_id: l.subempreitada_id,
        subempreitada_nome: l.subempreitada_id ? (nomePorSub.get(l.subempreitada_id) ?? null) : null,
      })),
      pedido_proposta: true,
    };
    if (tipo === "excel") exportarExcelPorSubempreitada(input);
    else exportarPDFPorSubempreitada(input);
  }

  function alternar(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const totalArtigos = linhas?.length ?? 0;
  const classificados = (linhas ?? []).filter((l) => l.confianca > 0 || l.subempreitada_id || l.justificacao).length;
  const porRever = (linhas ?? []).filter((l) => l.necessita_revisao && !l.validado_manual).length;
  const validados = (linhas ?? []).filter((l) => l.validado_manual).length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Preparação de Consultas</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            A inteligência artificial lê cada artigo do Mapa de Quantidades na íntegra e identifica a subempreitada
            responsável pela execução. A Biblioteca Mestra apoia a interpretação; a decisão final é sua.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={orcamentoId ?? ""} onValueChange={(v) => setOrcamentoId(v)}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Escolher Mapa de Quantidades" />
            </SelectTrigger>
            <SelectContent>
              {(orcamentos ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={separarComIA} disabled={!orcamentoId || aCorrer}>
            {aCorrer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Separar Artigos por Subempreitada com IA
          </Button>
        </div>
      </div>

      {progresso && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>
              {aCorrer ? "A analisar artigos com IA…" : "Análise terminada"} — {progresso.feitos} de {progresso.total}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={verificar} disabled={aCorrer}>
                Verificar integridade
              </Button>
              {falhados.length > 0 && (
                <Button size="sm" variant="outline" onClick={repetirFalhados} disabled={aCorrer}>
                  Repetir {falhados.length} artigos em falta
                </Button>
              )}
            </div>
          </div>
          <div className="h-2 rounded bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (progresso.feitos / Math.max(1, progresso.total)) * 100)}%` }}
            />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Artigos no MQ", valor: totalArtigos },
          { label: "Analisados pela IA", valor: classificados },
          { label: "A necessitar revisão", valor: porRever },
          { label: "Confirmados por si", valor: validados },
        ].map((k) => (
          <Card key={k.label} className="p-3">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-semibold tabular-nums">{k.valor}</div>
          </Card>
        ))}
      </div>

      {estado && !estado.completo && (
        <Card className="p-3 border-amber-500/40 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Separação incompleta: {estado.em_falta} artigos por processar, {estado.duplicados} duplicações,{" "}
          {estado.sem_subempreitada} sem subempreitada válida.
        </Card>
      )}
      {estado?.sugestoes_novas?.length ? (
        <Card className="p-3 text-sm">
          <span className="font-medium">Subempreitadas sugeridas pela IA (não criadas automaticamente):</span>{" "}
          {estado.sugestoes_novas.join(" · ")}
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(
            [
              ["todos", "Todos"],
              ["revisao", "A rever"],
              ["sem", "Sem subempreitada"],
            ] as const
          ).map(([v, l]) => (
            <Button key={v} size="sm" variant={filtro === v ? "default" : "outline"} onClick={() => setFiltro(v)}>
              {l}
            </Button>
          ))}
        </div>
        <div className="flex-1" />
        <Select value={destino} onValueChange={setDestino}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Mover selecionados para…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_SUB}>Sem subempreitada</SelectItem>
            {(subempreitadas ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.codigo} · {s.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={selecionados.size === 0}
          onClick={() => confirmarSelecionados(destino === SEM_SUB ? null : destino)}
        >
          Aplicar a {selecionados.size} selecionados
        </Button>
        <Button size="sm" variant="outline" disabled={selecionados.size === 0} onClick={() => confirmarSelecionados(null)}>
          <CheckCircle2 className="h-4 w-4" /> Confirmar como está
        </Button>
        <Button size="sm" variant="outline" onClick={aplicarAoMQ} disabled={!orcamentoId}>
          Organizar Mapa de Quantidades
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportar("excel")} disabled={!totalArtigos}>
          <FileSpreadsheet className="h-4 w-4" /> Excel
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportar("pdf")} disabled={!totalArtigos}>
          <Download className="h-4 w-4" /> PDF
        </Button>
      </div>

      {isFetching && <p className="text-sm text-muted-foreground">A carregar artigos…</p>}

      <div className="space-y-5">
        {agrupadas.map(([subId, arts]) => (
          <Card key={subId} className="overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/40 flex items-center justify-between">
              <div className="font-medium text-sm">
                {subId === SEM_SUB ? "Sem subempreitada atribuída" : (nomePorSub.get(subId) ?? subId)}
              </div>
              <Badge variant="secondary">{arts.length} artigos</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="w-8 p-2" />
                    <th className="text-left p-2 w-24">Código</th>
                    <th className="text-left p-2">Descrição original</th>
                    <th className="text-left p-2 w-40">Trabalho principal</th>
                    <th className="text-right p-2 w-24">Qtd.</th>
                    <th className="text-left p-2 w-16">Un.</th>
                    <th className="text-left p-2 w-24">Confiança</th>
                    <th className="text-left p-2 w-72">Justificação da IA</th>
                  </tr>
                </thead>
                <tbody>
                  {arts.map((l) => (
                    <tr key={l.artigo_id} className="border-b last:border-0 align-top">
                      <td className="p-2">
                        <Checkbox
                          checked={selecionados.has(l.artigo_id)}
                          onCheckedChange={() => alternar(l.artigo_id)}
                        />
                      </td>
                      <td className="p-2 font-mono text-xs">{l.codigo ?? "—"}</td>
                      <td className="p-2">
                        <div className="text-[11px] text-muted-foreground">
                          {l.capitulo_codigo} {l.capitulo_descricao?.slice(0, 70)}
                        </div>
                        {l.descricao}
                      </td>
                      <td className="p-2 text-xs">{l.trabalho_principal ?? "—"}</td>
                      <td className="p-2 text-right tabular-nums">{l.quantidade}</td>
                      <td className="p-2">{l.unidade ?? "—"}</td>
                      <td className="p-2">
                        {l.validado_manual ? (
                          <Badge className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> validado
                          </Badge>
                        ) : l.necessita_revisao ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> rever
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{Math.round(l.confianca * 100)}%</Badge>
                        )}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {l.justificacao ?? "—"}
                        {l.sugestao_nova_subempreitada ? (
                          <div className="mt-1 text-amber-600">Sugestão: {l.sugestao_nova_subempreitada}</div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
