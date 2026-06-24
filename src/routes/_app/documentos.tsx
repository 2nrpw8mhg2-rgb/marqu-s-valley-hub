import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/documentos")({
  head: () => ({ meta: [{ title: "Documentos — MV OS" }] }),
  component: DocumentosPage,
});

const TIPOS = [
  { v: "projeto", l: "Projeto" },
  { v: "mq", l: "Mapa de Quantidades" },
  { v: "caderno_encargos", l: "Caderno de Encargos" },
  { v: "proposta", l: "Proposta" },
  { v: "outro", l: "Outro" },
] as const;

function DocumentosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("*, obras(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const download = async (path: string, nome: string) => {
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 60);
    if (error || !data) { toast.error("Não foi possível obter o ficheiro"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = nome;
    a.click();
  };

  const remove = async (id: string, path: string) => {
    if (!confirm("Eliminar este documento?")) return;
    await supabase.storage.from("documentos").remove([path]);
    const { error } = await supabase.from("documentos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Documento eliminado");
    qc.invalidateQueries({ queryKey: ["documentos"] });
  };

  return (
    <>
      <PageHeader
        title="Gestão Documental"
        subtitle="Projetos, mapas de quantidades, cadernos de encargos e propostas"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Upload className="h-4 w-4 mr-1.5" /> Carregar documento
              </Button>
            </DialogTrigger>
            <UploadDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["documentos"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); }} />
          </Dialog>
        }
      />

      <div className="p-6">
        <Card className="bg-card border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">A carregar...</TableCell></TableRow>
              ) : docs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">Sem documentos carregados.</p>
                  </TableCell>
                </TableRow>
              ) : (
                docs.map((d) => (
                  <TableRow key={d.id} className="border-border">
                    <TableCell className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" /> {d.nome}
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-border bg-muted text-muted-foreground">
                        {TIPOS.find((t) => t.v === d.tipo)?.l ?? d.tipo}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.obras?.nome ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums text-xs">{formatBytes(d.tamanho)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(d.created_at).toLocaleDateString("pt-PT")}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => download(d.storage_path, d.nome)}><Download className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(d.id, d.storage_path)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}

function UploadDialog({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState("outro");
  const [obraId, setObraId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const { data: obras = [] } = useQuery({
    queryKey: ["obras-min"],
    queryFn: async () => {
      const { data } = await supabase.from("obras").select("id, nome").order("nome");
      return data ?? [];
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const path = `${user?.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("documentos").upload(path, file);
    if (upErr) { toast.error(upErr.message); setBusy(false); return; }
    const { error } = await supabase.from("documentos").insert({
      nome: file.name,
      tipo: tipo as any,
      obra_id: obraId || null,
      storage_path: path,
      tamanho: file.size,
      mime_type: file.type,
      uploaded_by: user?.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Documento carregado");
    onClose();
  };

  return (
    <DialogContent className="bg-card border-border">
      <DialogHeader><DialogTitle>Carregar documento</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Ficheiro *</Label>
          <Input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Associar a obra (opcional)</Label>
          <Select value={obraId} onValueChange={setObraId}>
            <SelectTrigger><SelectValue placeholder="Sem obra associada" /></SelectTrigger>
            <SelectContent>
              {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy || !file} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {busy ? "A carregar..." : "Carregar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function formatBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
