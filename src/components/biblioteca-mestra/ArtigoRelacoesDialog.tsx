import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Lock, Sparkles } from "lucide-react";
import {
  TIPOS_CANONICOS,
  TIPO_RELACAO_META,
  OBRIGATORIEDADES,
  OBRIGATORIEDADE_META,
} from "@/lib/relacoes/config";
import type { ArtigoRelacao, Obrigatoriedade, TipoRelacao, SistemaConstrutivo, SistemaArtigo } from "@/lib/relacoes/types";
import type { ArtigoMestre } from "@/lib/biblioteca-mestra/types";

type Props = {
  artigoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ArtigoRelacoesDialog({ artigoId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TipoRelacao>("complementa");
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: artigo } = useQuery({
    queryKey: ["bm-art-one", artigoId],
    enabled: !!artigoId && open,
    queryFn: async () => (await supabase.from("biblioteca_artigos").select("*").eq("id", artigoId!).single()).data as ArtigoMestre,
  });

  const { data: relacoes = [], refetch } = useQuery({
    queryKey: ["bm-relacoes", artigoId],
    enabled: !!artigoId && open,
    queryFn: async () =>
      (await supabase.from("biblioteca_artigo_relacoes").select("*").eq("artigo_origem_id", artigoId!).order("created_at", { ascending: false })).data as ArtigoRelacao[],
  });

  const { data: todosArtigos = [] } = useQuery({
    queryKey: ["bm-art-min"],
    enabled: open,
    queryFn: async () => (await supabase.from("biblioteca_artigos").select("id, descricao, codigo").order("descricao")).data as Pick<ArtigoMestre, "id" | "descricao" | "codigo">[],
  });

  const { data: sistemas = [] } = useQuery({
    queryKey: ["bm-sistemas-de-art", artigoId],
    enabled: !!artigoId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("biblioteca_sistema_artigos")
        .select("papel, ordem_execucao, obrigatoriedade, sistema:biblioteca_sistemas_construtivos(id, nome, categoria_sistema)")
        .eq("artigo_id", artigoId!);
      return (data ?? []) as Array<SistemaArtigo & { sistema: SistemaConstrutivo }>;
    },
  });

  const artigoMap = useMemo(() => new Map(todosArtigos.map((a) => [a.id, a])), [todosArtigos]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("biblioteca_artigo_relacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Relação removida");
      refetch();
      qc.invalidateQueries({ queryKey: ["bm-relacoes-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const relacoesPorTipo = useMemo(() => {
    const m = new Map<TipoRelacao, ArtigoRelacao[]>();
    for (const r of relacoes) {
      if (!m.has(r.tipo_relacao)) m.set(r.tipo_relacao, []);
      m.get(r.tipo_relacao)!.push(r);
    }
    return m;
  }, [relacoes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Relações Construtivas
            {artigo && <div className="text-sm font-normal text-muted-foreground mt-1">{artigo.descricao}</div>}
          </DialogTitle>
        </DialogHeader>

        {sistemas.length > 0 && (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Pertence a sistemas</div>
            <div className="flex flex-wrap gap-2">
              {sistemas.map((s) => (
                <Badge key={s.sistema.id} variant="outline" className="gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  {s.sistema.nome}
                  <span className="text-muted-foreground">({s.papel})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as TipoRelacao)}>
          <TabsList className="grid grid-cols-6">
            {TIPOS_CANONICOS.map((t) => (
              <TabsTrigger key={t} value={t} className="text-xs">
                {TIPO_RELACAO_META[t].label}
                <span className="ml-1.5 text-[10px] text-muted-foreground">
                  {relacoesPorTipo.get(t)?.length ?? 0}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {TIPOS_CANONICOS.map((t) => (
            <TabsContent key={t} value={t} className="space-y-2 max-h-[50vh] overflow-y-auto">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setNovoOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar relação
                </Button>
              </div>
              {(relacoesPorTipo.get(t) ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">Sem relações deste tipo.</div>
              )}
              <ul className="divide-y divide-border/60">
                {(relacoesPorTipo.get(t) ?? []).map((r) => {
                  const destino = artigoMap.get(r.artigo_destino_id);
                  const obrigMeta = OBRIGATORIEDADE_META[r.obrigatoriedade];
                  const isAuto = r.origem === "sistema" || r.origem === "auto_inverso";
                  return (
                    <li key={r.id} className="py-2 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{destino?.descricao ?? "—"}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={`text-[10px] ${obrigMeta.cls}`}>{obrigMeta.label}</Badge>
                          <span className="text-[10px] text-muted-foreground uppercase">{r.origem}</span>
                          {r.observacoes && <span className="text-xs text-muted-foreground truncate">— {r.observacoes}</span>}
                        </div>
                      </div>
                      {isAuto ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </TabsContent>
          ))}
        </Tabs>

        {artigoId && (
          <RelacaoForm
            open={novoOpen}
            onOpenChange={setNovoOpen}
            artigoOrigemId={artigoId}
            tipoInicial={tab}
            artigos={todosArtigos}
            onSaved={() => { refetch(); setNovoOpen(false); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RelacaoForm({
  open, onOpenChange, artigoOrigemId, tipoInicial, artigos, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  artigoOrigemId: string;
  tipoInicial: TipoRelacao;
  artigos: Pick<ArtigoMestre, "id" | "descricao" | "codigo">[];
  onSaved: () => void;
}) {
  const [destinoId, setDestinoId] = useState<string>("");
  const [tipo, setTipo] = useState<TipoRelacao>(tipoInicial);
  const [obrig, setObrig] = useState<Obrigatoriedade>("frequente");
  const [obs, setObs] = useState("");
  const [search, setSearch] = useState("");

  const filtered = artigos.filter((a) =>
    a.id !== artigoOrigemId && a.descricao.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 200);

  const save = useMutation({
    mutationFn: async () => {
      if (!destinoId) throw new Error("Escolhe o artigo destino");
      const { error } = await supabase.from("biblioteca_artigo_relacoes").insert({
        artigo_origem_id: artigoOrigemId,
        artigo_destino_id: destinoId,
        tipo_relacao: tipo,
        obrigatoriedade: obrig,
        origem: "manual",
        observacoes: obs || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Relação criada"); onSaved(); setDestinoId(""); setObs(""); setSearch(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova relação</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoRelacao)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_CANONICOS.map((t) => <SelectItem key={t} value={t}>{TIPO_RELACAO_META[t].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Obrigatoriedade</Label>
            <Select value={obrig} onValueChange={(v) => setObrig(v as Obrigatoriedade)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OBRIGATORIEDADES.map((o) => <SelectItem key={o} value={o}>{OBRIGATORIEDADE_META[o].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Artigo destino</Label>
            <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
            <div className="border border-border rounded-md max-h-48 overflow-y-auto">
              {filtered.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setDestinoId(a.id)}
                  className={`block w-full text-left px-2 py-1.5 text-sm hover:bg-muted/50 ${destinoId === a.id ? "bg-muted" : ""}`}
                >
                  <span className="font-mono text-xs text-muted-foreground mr-2">{a.codigo ?? "—"}</span>
                  {a.descricao}
                </button>
              ))}
              {filtered.length === 0 && <div className="text-xs text-muted-foreground p-3 text-center">Sem resultados</div>}
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !destinoId}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
