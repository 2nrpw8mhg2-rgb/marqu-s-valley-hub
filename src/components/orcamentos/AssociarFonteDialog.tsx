import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COST_CATEGORIES, type FonteCategoria } from "@/lib/orcamento-utils";
import { toast } from "sonner";

type Props = {
  open: boolean;
  artigoId: string | null;
  defaultCategoria?: FonteCategoria;
  onClose: () => void;
  onCreated: () => void;
};

export function AssociarFonteDialog({ open, artigoId, defaultCategoria, onClose, onCreated }: Props) {
  const [categoria, setCategoria] = useState<FonteCategoria>(defaultCategoria ?? "subempreitadas");
  const [subempreiteiroId, setSubempreiteiroId] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState<number>(0);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: subs } = useQuery({
    queryKey: ["subempreiteiros-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subempreiteiros").select("id, nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const reset = () => {
    setCategoria(defaultCategoria ?? "subempreitadas");
    setSubempreiteiroId("");
    setDescricao("");
    setValor(0);
    setNotas("");
  };

  const handleSave = async () => {
    if (!artigoId) return;
    if (!descricao.trim()) { toast.error("Indica uma descrição"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("orcamento_artigo_fontes").insert({
        artigo_id: artigoId,
        categoria,
        subempreiteiro_id: subempreiteiroId || null,
        descricao: descricao.trim(),
        valor,
        notas: notas || null,
      });
      if (error) throw error;
      toast.success("Fonte associada");
      reset();
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Associar fonte de custo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as FonteCategoria)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COST_CATEGORIES.map(c => (
                  <SelectItem key={c.fonte} value={c.fonte}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Subempreiteiro / Fornecedor (opcional)</Label>
            <Select value={subempreiteiroId || "none"} onValueChange={(v) => setSubempreiteiroId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {(subs ?? []).map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição da proposta</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Proposta nº 12/2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Valor (€)</Label>
            <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "A guardar..." : "Associar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
