import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import {
  CONHECIMENTO_ORIGENS,
  CONHECIMENTO_TIPOS,
  type ArtigoConhecimento,
  type ConhecimentoTipo,
} from "@/lib/biblioteca-mestra/types";

type Props = { artigoId: string | null | undefined };

type EditState = Partial<ArtigoConhecimento> & { tipo: ConhecimentoTipo; termo: string; peso: number; confianca: number };

const tipoMeta = (t: ConhecimentoTipo) => CONHECIMENTO_TIPOS.find((x) => x.value === t)!;
const origemMeta = (o: string) => CONHECIMENTO_ORIGENS.find((x) => x.value === o);

export function ArtigoConhecimentoTab({ artigoId }: Props) {
  const qc = useQueryClient();
  const [filtroTipo, setFiltroTipo] = useState<ConhecimentoTipo | "todos">("todos");
  const [mostrarInativos, setMostrarInativos] = useState(true);
  const [busca, setBusca] = useState("");
  const [editor, setEditor] = useState<EditState | null>(null);
  const [removerId, setRemoverId] = useState<string | null>(null);

  const { data: registos = [], isLoading } = useQuery({
    queryKey: ["bm-conhecimento", artigoId],
    queryFn: async () => {
      if (!artigoId) return [] as ArtigoConhecimento[];
      const { data, error } = await supabase
        .from("biblioteca_artigo_conhecimento")
        .select("*")
        .eq("artigo_mestre_id", artigoId)
        .order("tipo")
        .order("termo");
      if (error) throw error;
      return (data ?? []) as ArtigoConhecimento[];
    },
    enabled: !!artigoId,
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return registos.filter((r) => {
      if (filtroTipo !== "todos" && r.tipo !== filtroTipo) return false;
      if (!mostrarInativos && !r.ativo) return false;
      if (q && !r.termo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [registos, filtroTipo, mostrarInativos, busca]);

  const totalAtivos = registos.filter((r) => r.ativo).length;

  const upsert = useMutation({
    mutationFn: async (e: EditState) => {
      if (!artigoId) throw new Error("Artigo não guardado");
      const termo = e.termo.trim();
      if (!termo) throw new Error("Termo obrigatório");
      const payload = {
        artigo_mestre_id: artigoId,
        tipo: e.tipo,
        termo,
        peso: Number.isFinite(e.peso) ? e.peso : tipoMeta(e.tipo).pesoDefault,
        confianca: Math.max(0, Math.min(100, Number(e.confianca) || 0)),
        ativo: e.ativo ?? true,
        origem: e.origem ?? "utilizador",
      };
      if (e.id) {
        const { error } = await supabase.from("biblioteca_artigo_conhecimento").update(payload).eq("id", e.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("biblioteca_artigo_conhecimento").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-conhecimento", artigoId] });
      setEditor(null);
      toast.success("Guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async (r: ArtigoConhecimento) => {
      const { error } = await supabase
        .from("biblioteca_artigo_conhecimento")
        .update({ ativo: !r.ativo })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bm-conhecimento", artigoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("biblioteca_artigo_conhecimento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bm-conhecimento", artigoId] });
      setRemoverId(null);
      toast.success("Removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!artigoId) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Guarda o artigo primeiro para começar a adicionar conhecimento.
      </div>
    );
  }

  const novo = () =>
    setEditor({
      tipo: "palavra_chave",
      termo: "",
      peso: CONHECIMENTO_TIPOS[0].pesoDefault,
      confianca: 100,
      ativo: true,
      origem: "utilizador",
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <Label className="text-xs">Pesquisar termo</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-7 h-9" placeholder="Filtrar..." />
          </div>
        </div>
        <div className="w-44">
          <Label className="text-xs">Tipo</Label>
          <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as typeof filtroTipo)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {CONHECIMENTO_TIPOS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 h-9">
          <Switch checked={mostrarInativos} onCheckedChange={setMostrarInativos} />
          <Label className="text-xs">Inativos</Label>
        </div>
        <Button onClick={novo} size="sm" className="ml-auto"><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
      </div>

      <div className="text-xs text-muted-foreground">
        {registos.length} registos · {totalAtivos} ativos
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Tipo</th>
              <th className="text-left px-3 py-2 font-medium">Termo</th>
              <th className="text-left px-3 py-2 font-medium w-20">Peso</th>
              <th className="text-left px-3 py-2 font-medium w-24">Origem</th>
              <th className="text-left px-3 py-2 font-medium w-20">Confiança</th>
              <th className="text-left px-3 py-2 font-medium w-16">Ativo</th>
              <th className="text-right px-3 py-2 font-medium w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">A carregar...</td></tr>
            )}
            {!isLoading && filtrados.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">
                {registos.length === 0 ? "Sem conhecimento. Adiciona o primeiro termo." : "Nenhum registo corresponde aos filtros."}
              </td></tr>
            )}
            {filtrados.map((r) => {
              const tm = tipoMeta(r.tipo);
              const om = origemMeta(r.origem);
              return (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="px-3 py-1.5"><Badge variant="outline" className={tm.className}>{tm.label}</Badge></td>
                  <td className="px-3 py-1.5">{r.termo}</td>
                  <td className="px-3 py-1.5 tabular-nums">{r.peso}</td>
                  <td className="px-3 py-1.5">{om && <Badge variant="outline" className={om.className}>{om.label}</Badge>}</td>
                  <td className="px-3 py-1.5 tabular-nums">{Number(r.confianca).toFixed(0)}%</td>
                  <td className="px-3 py-1.5">
                    <Switch checked={r.ativo} onCheckedChange={() => toggleAtivo.mutate(r)} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => setEditor({ ...r })}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => setRemoverId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editor?.id ? "Editar" : "Adicionar"} conhecimento</DialogTitle></DialogHeader>
          {editor && (
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={editor.tipo}
                  onValueChange={(v) => {
                    const tipo = v as ConhecimentoTipo;
                    setEditor({ ...editor, tipo, peso: editor.id ? editor.peso : tipoMeta(tipo).pesoDefault });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONHECIMENTO_TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Termo *</Label>
                <Input value={editor.termo} onChange={(e) => setEditor({ ...editor, termo: e.target.value })} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Peso</Label>
                  <Input type="number" value={editor.peso}
                    onChange={(e) => setEditor({ ...editor, peso: parseInt(e.target.value || "0", 10) })} />
                </div>
                <div>
                  <Label>Confiança (%)</Label>
                  <Input type="number" min={0} max={100} value={editor.confianca}
                    onChange={(e) => setEditor({ ...editor, confianca: parseFloat(e.target.value || "0") })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editor.ativo ?? true} onCheckedChange={(v) => setEditor({ ...editor, ativo: v })} />
                <Label>Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>Cancelar</Button>
            <Button onClick={() => editor && upsert.mutate(editor)} disabled={upsert.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removerId} onOpenChange={(o) => !o && setRemoverId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conhecimento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser revertida.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => removerId && remove.mutate(removerId)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
