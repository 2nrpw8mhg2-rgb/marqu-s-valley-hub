import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users, Star, Mail, Phone, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/subempreiteiros")({
  head: () => ({ meta: [{ title: "Subempreiteiros — MV OS" }] }),
  component: SubsPage,
});

function SubsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["subempreiteiros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subempreiteiros").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const filtered = subs.filter((s) =>
    [s.nome, s.nif, ...(s.especialidades ?? []), ...(s.zonas ?? [])]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <PageHeader
        title="Subempreiteiros"
        subtitle="Base de dados de fornecedores, especialidades e desempenho"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-1.5" /> Novo subempreiteiro
              </Button>
            </DialogTrigger>
            <NovoSubDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["subempreiteiros"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); }} />
          </Dialog>
        }
      />

      <div className="p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome, especialidade, zona..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">A carregar...</p>
        ) : filtered.length === 0 ? (
          <Card className="bg-card border-border p-16 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Sem subempreiteiros registados.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <Card key={s.id} className="bg-card border-border p-5 space-y-3 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{s.nome}</h3>
                    {s.contacto_nome && <p className="text-xs text-muted-foreground">{s.contacto_nome}</p>}
                  </div>
                  {s.avaliacao != null && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < s.avaliacao! ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                  )}
                </div>
                {s.especialidades?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {s.especialidades.map((e) => (
                      <span key={e} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">{e}</span>
                    ))}
                  </div>
                )}
                {s.zonas?.length > 0 && (
                  <p className="text-xs text-muted-foreground">📍 {s.zonas.join(", ")}</p>
                )}
                <div className="flex flex-col gap-1 text-xs text-muted-foreground pt-2 border-t border-border">
                  {s.email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{s.email}</span>}
                  {s.telefone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{s.telefone}</span>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function NovoSubDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    nome: "", nif: "", especialidades: "", zonas: "",
    contacto_nome: "", telefone: "", email: "",
    avaliacao: "", notas: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("subempreiteiros").insert({
      nome: form.nome,
      nif: form.nif || null,
      especialidades: form.especialidades.split(",").map((s) => s.trim()).filter(Boolean),
      zonas: form.zonas.split(",").map((s) => s.trim()).filter(Boolean),
      contacto_nome: form.contacto_nome || null,
      telefone: form.telefone || null,
      email: form.email || null,
      avaliacao: form.avaliacao ? Number(form.avaliacao) : null,
      notas: form.notas || null,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Subempreiteiro adicionado");
    onClose();
  };

  return (
    <DialogContent className="bg-card border-border max-w-2xl">
      <DialogHeader><DialogTitle>Novo subempreiteiro</DialogTitle></DialogHeader>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2"><Label>Nome / Empresa *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
        <div className="space-y-2"><Label>NIF</Label><Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></div>
        <div className="space-y-2"><Label>Avaliação (0–5)</Label><Input type="number" min={0} max={5} value={form.avaliacao} onChange={(e) => setForm({ ...form, avaliacao: e.target.value })} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Especialidades (separadas por vírgula)</Label><Input placeholder="Pichelaria, Eletricidade, Pinturas" value={form.especialidades} onChange={(e) => setForm({ ...form, especialidades: e.target.value })} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Zonas de atuação (separadas por vírgula)</Label><Input placeholder="Lisboa, Setúbal, Cascais" value={form.zonas} onChange={(e) => setForm({ ...form, zonas: e.target.value })} /></div>
        <div className="space-y-2"><Label>Contacto</Label><Input value={form.contacto_nome} onChange={(e) => setForm({ ...form, contacto_nome: e.target.value })} /></div>
        <div className="space-y-2"><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Notas</Label><Textarea rows={3} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? "A guardar..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
