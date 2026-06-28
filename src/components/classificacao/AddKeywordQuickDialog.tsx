import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Nivel = "artigo" | "subespecialidade" | "especialidade";

export function AddKeywordQuickDialog({
  open, onClose, descricao,
  artigoMestreId, subespecialidadeId, especialidadeId,
  onSaved,
}: {
  open: boolean; onClose: () => void; descricao: string;
  artigoMestreId: string | null; subespecialidadeId: string | null; especialidadeId: string | null;
  onSaved?: () => void;
}) {
  const defaultNivel: Nivel = artigoMestreId ? "artigo" : subespecialidadeId ? "subespecialidade" : "especialidade";
  const [nivel, setNivel] = useState<Nivel>(defaultNivel);
  const [termo, setTermo] = useState(descricao.split(/\s+/).slice(0, 3).join(" "));
  const [tipo, setTipo] = useState<"positiva" | "negativa">("positiva");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!termo.trim()) return toast.error("Termo obrigatório");
    setSaving(true);
    try {
      if (nivel === "artigo") {
        if (!artigoMestreId) return toast.error("Sem artigo mestre");
        const { error } = await supabase.from("biblioteca_artigo_keywords").insert({ artigo_id: artigoMestreId, termo: termo.trim(), tipo });
        if (error) throw error;
      } else if (nivel === "subespecialidade") {
        if (!subespecialidadeId) return toast.error("Sem subespecialidade");
        const { error } = await supabase.from("biblioteca_subespecialidade_keywords").insert({ subespecialidade_id: subespecialidadeId, termo: termo.trim(), tipo, peso: 1, ativo: true });
        if (error) throw error;
      } else {
        if (!especialidadeId) return toast.error("Sem especialidade");
        const { error } = await supabase.from("biblioteca_especialidade_keywords").insert({ especialidade_id: especialidadeId, termo: termo.trim(), tipo, peso: 1, ativo: true });
        if (error) throw error;
      }
      toast.success("Palavra-chave adicionada");
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader><DialogTitle>Adicionar Palavra-chave</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Artigo original</Label>
            <div className="text-xs text-muted-foreground line-clamp-2">{descricao}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nível</Label>
              <Select value={nivel} onValueChange={(v) => setNivel(v as Nivel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {especialidadeId && <SelectItem value="especialidade">Especialidade</SelectItem>}
                  {subespecialidadeId && <SelectItem value="subespecialidade">Subespecialidade</SelectItem>}
                  {artigoMestreId && <SelectItem value="artigo">Artigo Mestre</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="positiva">Positiva</SelectItem>
                  <SelectItem value="negativa">Negativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Termo</Label>
            <Input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="ex: PVC SN8" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "A guardar…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
