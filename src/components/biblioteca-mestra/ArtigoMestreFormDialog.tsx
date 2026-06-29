import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArtigoConhecimentoTab } from "./ArtigoConhecimentoTab";
import { toast } from "sonner";
import { X } from "lucide-react";
import type {
  ArtigoMestre,
  ArtigoKeyword,
  ArtigoTipo,
  ArtigoEstadoIA,
  Especialidade,
  Subespecialidade,
  Categoria,
  Unidade,
} from "@/lib/biblioteca-mestra/types";
import { ARTIGO_TIPOS, ARTIGO_ESTADOS_IA } from "@/lib/biblioteca-mestra/types";

export type ArtigoFormState = Partial<ArtigoMestre> & {
  positivas?: string[];
  negativas?: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ArtigoFormState | null;
};

export function ArtigoMestreFormDialog({ open, onOpenChange, initial }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ArtigoFormState | null>(initial);
  const [kwPos, setKwPos] = useState("");
  const [kwNeg, setKwNeg] = useState("");
  const [tab, setTab] = useState<"geral" | "conhecimento">("geral");

  const { data: countConhecimento = 0 } = useQuery({
    queryKey: ["bm-conhecimento-count", editing?.id],
    queryFn: async () => {
      if (!editing?.id) return 0;
      const { count } = await supabase
        .from("biblioteca_artigo_conhecimento")
        .select("id", { count: "exact", head: true })
        .eq("artigo_mestre_id", editing.id)
        .eq("ativo", true);
      return count ?? 0;
    },
    enabled: !!editing?.id && open,
  });

  useEffect(() => {
    setEditing(initial);
    setKwPos("");
    setKwNeg("");
  }, [initial, open]);

  useEffect(() => {
    if (!open) return;
    setTab(countConhecimento > 0 ? "conhecimento" : "geral");
  }, [countConhecimento, editing?.id, open]);


  const { data: esps = [] } = useQuery({
    queryKey: ["bm-esp"],
    queryFn: async () => (await supabase.from("biblioteca_especialidades").select("*").order("ordem")).data as Especialidade[],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["bm-sub"],
    queryFn: async () => (await supabase.from("biblioteca_subespecialidades").select("*").order("nome")).data as Subespecialidade[],
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["bm-cat"],
    queryFn: async () => (await supabase.from("biblioteca_categorias").select("*").order("ordem").order("nome")).data as Categoria[],
  });
  const { data: unidades = [] } = useQuery({
    queryKey: ["bm-unidades"],
    queryFn: async () => (await supabase.from("biblioteca_unidades").select("*").eq("ativa", true).order("ordem")).data as Unidade[],
  });

  const espMap = new Map(esps.map((e) => [e.id, e]));
  const catMap = new Map(cats.map((c) => [c.id, c]));

  const save = useMutation({
    mutationFn: async (e: ArtigoFormState) => {
      if (!e.descricao?.trim()) throw new Error("Descrição obrigatória");
      if (!e.categoria_id) throw new Error("Categoria obrigatória");
      if (!e.tipo) throw new Error("Tipo obrigatório");
      if (!e.unidade_id) throw new Error("Unidade obrigatória");
      const cat = catMap.get(e.categoria_id);
      if (!cat) throw new Error("Categoria inválida");
      const payload = {
        subespecialidade_id: cat.subespecialidade_id,
        categoria_id: e.categoria_id,
        codigo: e.codigo ?? null,
        descricao: e.descricao.trim(),
        unidade_id: e.unidade_id,
        tipo: e.tipo,
        estado_ia: e.estado_ia ?? "validado",
        observacoes: e.observacoes ?? null,
        ativo: e.ativo ?? true,
      };
      let artigoId = e.id;
      if (artigoId) {
        const { error } = await supabase.from("biblioteca_artigos").update(payload).eq("id", artigoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("biblioteca_artigos").insert(payload).select("id").single();
        if (error) throw error;
        artigoId = data.id;
      }
      await supabase.from("biblioteca_artigo_keywords").delete().eq("artigo_id", artigoId!);
      const all = [
        ...(e.positivas ?? []).map((t) => ({ artigo_id: artigoId!, termo: t, tipo: "positiva" as const })),
        ...(e.negativas ?? []).map((t) => ({ artigo_id: artigoId!, termo: t, tipo: "negativa" as const })),
      ];
      if (all.length) {
        const { error } = await supabase.from("biblioteca_artigo_keywords").insert(all);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-art"] });
      qc.invalidateQueries({ queryKey: ["bm-kw"] });
      qc.invalidateQueries({ queryKey: ["bm-art-cat-counts"] });
      onOpenChange(false);
      toast.success("Guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addKw = (kind: "positivas" | "negativas", val: string) => {
    const t = val.trim();
    if (!t || !editing) return;
    const cur = editing[kind] ?? [];
    if (cur.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    setEditing({ ...editing, [kind]: [...cur, t] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} Artigo Mestre</DialogTitle></DialogHeader>
        <Tabs defaultValue="geral" className="w-full">
          <TabsList>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="conhecimento">Conhecimento IA</TabsTrigger>
          </TabsList>
          <TabsContent value="geral" className="space-y-3 max-h-[70vh] overflow-y-auto mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Subespecialidade *</Label>
              <Select
                value={editing?.subespecialidade_id}
                onValueChange={(v) => {
                  const firstCat = cats.find((c) => c.subespecialidade_id === v && c.ordem === 0);
                  setEditing({ ...editing, subespecialidade_id: v, categoria_id: firstCat?.id });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {subs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {espMap.get(s.especialidade_id)?.nome} / {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria *</Label>
              <Select
                value={editing?.categoria_id}
                onValueChange={(v) => setEditing({ ...editing, categoria_id: v })}
                disabled={!editing?.subespecialidade_id}
              >
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {cats.filter((c) => c.subespecialidade_id === editing?.subespecialidade_id).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Código</Label><Input value={editing?.codigo ?? ""} onChange={(e) => setEditing({ ...editing, codigo: e.target.value })} /></div>
            <div>
              <Label>Unidade *</Label>
              <Select value={editing?.unidade_id} onValueChange={(v) => setEditing({ ...editing, unidade_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.simbolo} — {u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={editing?.tipo} onValueChange={(v) => setEditing({ ...editing, tipo: v as ArtigoTipo })}>
                <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {ARTIGO_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Estado IA *</Label>
            <Select value={editing?.estado_ia} onValueChange={(v) => setEditing({ ...editing, estado_ia: v as ArtigoEstadoIA })}>
              <SelectTrigger><SelectValue placeholder="Seleciona..." /></SelectTrigger>
              <SelectContent>
                {ARTIGO_ESTADOS_IA.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="inline-flex items-center gap-2"><span className={`inline-block h-2 w-2 rounded-full ${s.dot}`} />{s.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Descrição *</Label><Textarea value={editing?.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} /></div>
          <div><Label>Observações</Label><Textarea value={editing?.observacoes ?? ""} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} /></div>
          <div className="flex items-center gap-2"><Switch checked={editing?.ativo ?? true} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} /><Label>Ativo</Label></div>

          <div>
            <Label>Palavras-chave positivas</Label>
            <div className="flex gap-2 mt-1">
              <Input value={kwPos} onChange={(e) => setKwPos(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw("positivas", kwPos); setKwPos(""); } }} placeholder="Premir Enter para adicionar" />
              <Button type="button" variant="outline" onClick={() => { addKw("positivas", kwPos); setKwPos(""); }}>Adicionar</Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(editing?.positivas ?? []).map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  {t}
                  <button onClick={() => setEditing({ ...editing!, positivas: (editing!.positivas ?? []).filter((x) => x !== t) })}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label>Palavras-chave negativas</Label>
            <div className="flex gap-2 mt-1">
              <Input value={kwNeg} onChange={(e) => setKwNeg(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw("negativas", kwNeg); setKwNeg(""); } }} placeholder="Premir Enter para adicionar" />
              <Button type="button" variant="outline" onClick={() => { addKw("negativas", kwNeg); setKwNeg(""); }}>Adicionar</Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(editing?.negativas ?? []).map((t) => (
                <Badge key={t} variant="outline" className="gap-1 border-destructive/40 text-destructive">
                  {t}
                  <button onClick={() => setEditing({ ...editing!, negativas: (editing!.negativas ?? []).filter((x) => x !== t) })}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
          </div>
          </TabsContent>
          <TabsContent value="conhecimento" className="max-h-[70vh] overflow-y-auto mt-3">
            <ArtigoConhecimentoTab artigoId={editing?.id ?? null} />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
