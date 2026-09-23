import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";
import {
  LIMIAR_CONFIANCA,
  aplicarAtribuicaoOtimista,
  listarARever,
  reverterAtribuicao,
  snapshotDe,
  type LinhaRevisao,
} from "@/lib/consultas/revisao";
import {
  aceitarSugestaoSubempreitada,
  atribuirSubempreitadaManual,
  desfazerAtribuicaoManual,
  rejeitarSugestaoIA,
} from "@/lib/consultas/revisao.functions";
import { classificarSugestao, rejeitarSugestaoOtimista, sugestaoNovaComum } from "@/lib/consultas/sugestoes";
import { AtribuirSubempreitadaPopover, type SubOpcao } from "./AtribuirSubempreitadaPopover";

const TODOS = "__todos__";

export function AReverPanel({
  orcamentoId,
  linhas,
  subempreitadas,
  queryKey,
  onAlterado,
}: {
  orcamentoId: string;
  linhas: LinhaRevisao[];
  subempreitadas: SubOpcao[];
  queryKey: unknown[];
  onAlterado: () => void;
}) {
  const qc = useQueryClient();
  const atribuirFn = useServerFn(atribuirSubempreitadaManual);
  const desfazerFn = useServerFn(desfazerAtribuicaoManual);
  const aceitarNovaFn = useServerFn(aceitarSugestaoSubempreitada);
  const rejeitarFn = useServerFn(rejeitarSugestaoIA);

  const [pesquisa, setPesquisa] = useState("");
  const [capitulo, setCapitulo] = useState<string>(TODOS);
  const [sugestao, setSugestao] = useState<"todas" | "com" | "sem">("todas");
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [destinoMassa, setDestinoMassa] = useState<string | null>(null);
  const [seletorAberto, setSeletorAberto] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  const nomePorSub = useMemo(
    () => new Map(subempreitadas.map((s) => [s.id, `${s.codigo} · ${s.nome}`])),
    [subempreitadas],
  );

  const capitulos = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of linhas) if (l.capitulo_codigo) m.set(l.capitulo_codigo, l.capitulo_descricao ?? l.capitulo_codigo);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [linhas]);

  const aRever = useMemo(
    () =>
      listarARever(linhas, {
        pesquisa,
        capitulo: capitulo === TODOS ? null : capitulo,
        sugestao,
      }),
    [linhas, pesquisa, capitulo, sugestao],
  );

  const sugestaoComumSelecao = useMemo(
    () => (selecao.size > 0 ? sugestaoNovaComum(linhas, [...selecao]) : null),
    [linhas, selecao],
  );

  const visiveisIds = aRever.map((l) => l.artigo_id);
  const todosVisiveisSelecionados = visiveisIds.length > 0 && visiveisIds.every((id) => selecao.has(id));

  function alternar(id: string) {
    setSelecao((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function atribuir(artigoIds: string[], subId: string) {
    if (artigoIds.length === 0) return;
    const operacao_id = crypto.randomUUID();
    const anterior = qc.getQueryData<LinhaRevisao[]>(queryKey) ?? linhas;
    const snapshots = snapshotDe(anterior, artigoIds);

    // Atualização imediata do ecrã, sem botão Guardar.
    qc.setQueryData<LinhaRevisao[]>(queryKey, (atual) =>
      aplicarAtribuicaoOtimista(atual ?? anterior, artigoIds, subId),
    );
    setSelecao(new Set());

    try {
      await atribuirFn({ data: { orcamento_id: orcamentoId, artigo_ids: artigoIds, subempreitada_id: subId, operacao_id } });
      const nome = nomePorSub.get(subId) ?? "subempreitada";
      toast.success(
        artigoIds.length === 1 ? `✓ Artigo atribuído a ${nome}` : `✓ ${artigoIds.length} artigos atribuídos a ${nome}`,
        {
          duration: 8000,
          action: {
            label: "Desfazer",
            onClick: async () => {
              qc.setQueryData<LinhaRevisao[]>(queryKey, (atual) =>
                reverterAtribuicao(atual ?? anterior, snapshots),
              );
              try {
                await desfazerFn({ data: { orcamento_id: orcamentoId, operacao_id } });
                toast.info("Atribuição desfeita.");
              } catch (e: any) {
                toast.error(e?.message ?? "Não foi possível desfazer a atribuição.");
              }
              onAlterado();
            },
          },
        },
      );
      onAlterado();
    } catch (e: any) {
      qc.setQueryData<LinhaRevisao[]>(queryKey, (atual) => reverterAtribuicao(atual ?? anterior, snapshots));
      toast.error(e?.message ?? "Não foi possível atribuir a subempreitada. Os artigos continuam em «A Rever».");
    }
  }

  /** Aceita (ou cria) uma subempreitada com o nome sugerido e atribui os artigos. */
  async function aceitarNova(artigoIds: string[], nome: string) {
    if (artigoIds.length === 0 || aGuardar) return;
    const operacao_id = crypto.randomUUID();
    const anterior = qc.getQueryData<LinhaRevisao[]>(queryKey) ?? linhas;
    const snapshots = snapshotDe(anterior, artigoIds);
    setAGuardar(true);
    try {
      const r: any = await aceitarNovaFn({
        data: { orcamento_id: orcamentoId, artigo_ids: artigoIds, nome, operacao_id },
      });
      const subId: string = r.subempreitada.id;
      qc.setQueryData<LinhaRevisao[]>(queryKey, (atual) =>
        aplicarAtribuicaoOtimista(atual ?? anterior, artigoIds, subId),
      );
      setSelecao(new Set());
      await qc.invalidateQueries({ queryKey: ["subempreitadas-ativas"] });
      toast.success(
        artigoIds.length === 1
          ? `✓ Artigo atribuído a ${r.subempreitada.codigo} · ${r.subempreitada.nome}`
          : `✓ ${artigoIds.length} artigos atribuídos a ${r.subempreitada.codigo} · ${r.subempreitada.nome}`,
        {
          duration: 8000,
          action: {
            label: "Desfazer",
            onClick: async () => {
              qc.setQueryData<LinhaRevisao[]>(queryKey, (atual) =>
                reverterAtribuicao(atual ?? anterior, snapshots),
              );
              try {
                await desfazerFn({ data: { orcamento_id: orcamentoId, operacao_id } });
                toast.info("Atribuição desfeita. A subempreitada criada mantém-se disponível.");
              } catch (e: any) {
                toast.error(e?.message ?? "Não foi possível desfazer a atribuição.");
              }
              onAlterado();
            },
          },
        },
      );
      onAlterado();
    } catch (e: any) {
      qc.setQueryData<LinhaRevisao[]>(queryKey, (atual) => reverterAtribuicao(atual ?? anterior, snapshots));
      toast.error(e?.message ?? "Não foi possível criar a subempreitada. Os artigos continuam em «A Rever».");
    } finally {
      setAGuardar(false);
    }
  }

  /** Rejeitar nunca valida o artigo: mantém-no em «A Rever» e abre o seletor. */
  async function rejeitar(l: LinhaRevisao) {
    const anterior = qc.getQueryData<LinhaRevisao[]>(queryKey) ?? linhas;
    qc.setQueryData<LinhaRevisao[]>(queryKey, (atual) =>
      rejeitarSugestaoOtimista(atual ?? anterior, l.artigo_id),
    );
    setSeletorAberto(l.artigo_id);
    try {
      await rejeitarFn({ data: { orcamento_id: orcamentoId, artigo_id: l.artigo_id } });
      toast.info("Sugestão rejeitada. Escolha a subempreitada correta.");
      onAlterado();
    } catch (e: any) {
      qc.setQueryData<LinhaRevisao[]>(queryKey, anterior);
      toast.error(e?.message ?? "Não foi possível registar a rejeição da sugestão.");
    }
  }

  /** Ações visíveis por artigo, conforme o tipo de sugestão da IA. */
  function Acoes({ l, compacto }: { l: LinhaRevisao; compacto?: boolean }) {
    const sug = classificarSugestao(l, subempreitadas);
    const seletor = (
      <AtribuirSubempreitadaPopover
        subempreitadas={subempreitadas}
        sugestoes={sugestoesDe(l)}
        sugestaoNova={l.sugestao_nova_subempreitada}
        aberto={seletorAberto === l.artigo_id}
        onAbertoChange={(v) => setSeletorAberto(v ? l.artigo_id : null)}
        onAtribuir={(id) => atribuir([l.artigo_id], id)}
        onCriar={(nome) => aceitarNova([l.artigo_id], nome)}
      >
        <Button size="sm" variant="outline" className={compacto ? "w-full" : ""}>
          {sug.tipo === "nenhuma" ? "Atribuir Subempreitada" : "Escolher outra"}
        </Button>
      </AtribuirSubempreitadaPopover>
    );

    return (
      <div className={`flex flex-wrap gap-1.5 ${compacto ? "" : "justify-end"}`}>
        {sug.tipo === "nova" && (
          <Button
            size="sm"
            disabled={aGuardar}
            className={compacto ? "w-full" : ""}
            onClick={() => aceitarNova([l.artigo_id], sug.nome)}
          >
            {sug.equivalente_id ? "Aceitar e reutilizar" : "Aceitar e criar"}
          </Button>
        )}
        {sug.tipo === "existente" && (
          <Button
            size="sm"
            className={compacto ? "w-full" : ""}
            onClick={() => atribuir([l.artigo_id], sug.subempreitada_id)}
          >
            Aceitar sugestão
          </Button>
        )}
        {seletor}
        {sug.tipo !== "nenhuma" && (
          <Button size="sm" variant="ghost" className={compacto ? "w-full" : ""} onClick={() => rejeitar(l)}>
            Rejeitar sugestão
          </Button>
        )}
      </div>
    );
  }

  function sugestoesDe(l: LinhaRevisao) {
    return [l.subempreitada_ia_id, l.subempreitada_id].filter(Boolean) as string[];
  }

  if (aRever.length === 0 && !pesquisa && capitulo === TODOS && sugestao === "todas") {
    return (
      <Card className="p-4 text-sm flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        Não há artigos à espera de decisão humana.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b flex flex-wrap items-center gap-2">
        <div className="font-medium text-sm">A Rever</div>
        <Badge variant="secondary">{aRever.length} artigos</Badge>
        <span className="text-xs text-muted-foreground">
          confiança inferior a {Math.round(LIMIAR_CONFIANCA * 100)}%, sem subempreitada ou com sugestão nova
        </span>
        <div className="flex-1" />
        <Input
          aria-label="Pesquisar por código ou descrição"
          placeholder="Pesquisar código ou descrição…"
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
          className="h-8 w-[220px]"
        />
        <Select value={capitulo} onValueChange={setCapitulo}>
          <SelectTrigger className="h-8 w-[200px]" aria-label="Filtrar por capítulo">
            <SelectValue placeholder="Capítulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os capítulos</SelectItem>
            {capitulos.map(([c, d]) => (
              <SelectItem key={c} value={c}>
                {c} · {d.slice(0, 40)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sugestao} onValueChange={(v) => setSugestao(v as typeof sugestao)}>
          <SelectTrigger className="h-8 w-[180px]" aria-label="Filtrar por sugestão da IA">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Com e sem sugestão</SelectItem>
            <SelectItem value="com">Com sugestão da IA</SelectItem>
            <SelectItem value="sem">Sem sugestão</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selecao.size > 0 && (
        <div className="sticky top-0 z-10 px-4 py-2 border-b bg-muted/70 backdrop-blur flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{selecao.size} selecionados</span>
          <div className="flex-1" />
          {sugestaoComumSelecao ? (
            <Button size="sm" disabled={aGuardar} onClick={() => aceitarNova([...selecao], sugestaoComumSelecao)}>
              Aceitar «{sugestaoComumSelecao}» para {selecao.size} artigos
            </Button>
          ) : null}
          <AtribuirSubempreitadaPopover
            subempreitadas={subempreitadas}
            onCriar={(nome) => aceitarNova([...selecao], nome)}
            onAtribuir={(id) => {
              setDestinoMassa(id);
              atribuir([...selecao], id);
            }}
            titulo="Atribuir aos artigos selecionados"
          >
            <Button size="sm">Atribuir selecionados</Button>
          </AtribuirSubempreitadaPopover>
          <Button size="sm" variant="ghost" onClick={() => setSelecao(new Set())}>
            Limpar seleção
          </Button>
          {destinoMassa ? <span className="sr-only">{nomePorSub.get(destinoMassa)}</span> : null}
        </div>
      )}

      {/* Ecrãs largos: tabela */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="w-8 p-2">
                <Checkbox
                  aria-label="Selecionar todos os visíveis"
                  checked={todosVisiveisSelecionados}
                  onCheckedChange={() =>
                    setSelecao(todosVisiveisSelecionados ? new Set() : new Set(visiveisIds))
                  }
                />
              </th>
              <th className="text-left p-2 w-24">Código</th>
              <th className="text-left p-2">Descrição</th>
              <th className="text-left p-2 w-16">Un.</th>
              <th className="text-right p-2 w-24">Qtd.</th>
              <th className="text-left p-2 w-44">Sugestão da IA</th>
              <th className="text-left p-2 w-24">Confiança</th>
              <th className="text-right p-2 w-56">Ações</th>
            </tr>
          </thead>
          <tbody>
            {aRever.map((l) => (
              <tr key={l.artigo_id} className="border-b last:border-0 align-top hover:bg-muted/30">
                <td className="p-2">
                  <Checkbox
                    aria-label={`Selecionar artigo ${l.codigo ?? l.artigo_id}`}
                    checked={selecao.has(l.artigo_id)}
                    onCheckedChange={() => alternar(l.artigo_id)}
                  />
                </td>
                <td className="p-2 font-mono text-xs">{l.codigo ?? "—"}</td>
                <td className="p-2 min-w-[340px] whitespace-pre-wrap">
                  <div className="text-[11px] text-muted-foreground">
                    {l.capitulo_codigo} {l.capitulo_descricao}
                  </div>
                  {l.descricao}
                </td>
                <td className="p-2">{l.unidade ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{l.quantidade}</td>
                <td className="p-2 text-xs">
                  {l.subempreitada_ia_id ? (nomePorSub.get(l.subempreitada_ia_id) ?? "—") : "—"}
                  {l.sugestao_nova_subempreitada ? (
                    <div className="text-amber-600 mt-1">Nova: {l.sugestao_nova_subempreitada}</div>
                  ) : null}
                </td>
                <td className="p-2">
                  <Badge variant={l.confianca_ia < LIMIAR_CONFIANCA ? "destructive" : "secondary"}>
                    {Math.round((l.confianca_ia ?? 0) * 100)}%
                  </Badge>
                </td>
                <td className="p-2">
                  <Acoes l={l} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ecrãs estreitos: cartões */}
      <div className="md:hidden divide-y">
        {aRever.map((l) => (
          <div key={l.artigo_id} className="p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Checkbox
                aria-label={`Selecionar artigo ${l.codigo ?? l.artigo_id}`}
                checked={selecao.has(l.artigo_id)}
                onCheckedChange={() => alternar(l.artigo_id)}
              />
              <div className="flex-1">
                <div className="text-[11px] text-muted-foreground font-mono">
                  {l.codigo ?? "—"} · {l.capitulo_codigo}
                </div>
                <div className="text-sm whitespace-pre-wrap">{l.descricao}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {l.quantidade} {l.unidade ?? ""} ·{" "}
                  {l.subempreitada_ia_id ? (nomePorSub.get(l.subempreitada_ia_id) ?? "sem sugestão") : "sem sugestão"} ·{" "}
                  {Math.round((l.confianca_ia ?? 0) * 100)}%
                </div>
              </div>
            </div>
            {l.sugestao_nova_subempreitada ? (
              <div className="text-xs text-amber-600">Nova: {l.sugestao_nova_subempreitada}</div>
            ) : null}
            <Acoes l={l} compacto />
          </div>
        ))}
      </div>

      {aRever.length === 0 && (
        <p className="p-4 text-sm text-muted-foreground">Nenhum artigo corresponde aos filtros aplicados.</p>
      )}
    </Card>
  );
}
