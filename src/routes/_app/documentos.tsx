import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  FolderPlus,
  Folder as FolderIcon,
  FileText,
  Download,
  Trash2,
  MoreVertical,
  ChevronRight,
  Pencil,
  FolderInput,
  Copy,
  Home,
  Building2,
  FileImage,
  FileArchive,
  FileSpreadsheet,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

const MAX_BYTES = 200 * 1024 * 1024;

type Obra = { id: string; nome: string };
type Pasta = {
  id: string;
  obra_id: string;
  parent_id: string | null;
  nome: string;
  is_root: boolean;
  is_default: boolean;
};
type Documento = {
  id: string;
  obra_id: string | null;
  pasta_id: string | null;
  nome: string;
  tipo: string;
  storage_path: string;
  tamanho: number | null;
  mime_type: string | null;
  created_at: string;
};

type Search = { obraId?: string; pastaId?: string };

export const Route = createFileRoute("/_app/documentos")({
  head: () => ({ meta: [{ title: "Gestão Documental — MV OS" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    obraId: typeof s.obraId === "string" ? s.obraId : undefined,
    pastaId: typeof s.pastaId === "string" ? s.pastaId : undefined,
  }),
  component: DocumentosPage,
});

function DocumentosPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();

  const { data: obras = [] } = useQuery({
    queryKey: ["obras-doc"],
    queryFn: async (): Promise<Obra[]> => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Obra[];
    },
  });

  // Default obra selection
  useEffect(() => {
    if (!search.obraId && obras.length > 0) {
      navigate({ search: { obraId: obras[0].id }, replace: true });
    }
  }, [obras, search.obraId, navigate]);

  const obraId = search.obraId;

  const { data: pastas = [] } = useQuery({
    queryKey: ["pastas-obra", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<Pasta[]> => {
      const { data, error } = await supabase
        .from("documento_pastas")
        .select("*")
        .eq("obra_id", obraId!)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Pasta[];
    },
  });

  const rootPasta = useMemo(() => pastas.find((p) => p.parent_id === null) ?? null, [pastas]);
  const pastaActualId = search.pastaId ?? rootPasta?.id ?? null;
  const pastaActual = useMemo(
    () => pastas.find((p) => p.id === pastaActualId) ?? null,
    [pastas, pastaActualId],
  );

  // Auto-set root pasta if none chosen
  useEffect(() => {
    if (obraId && !search.pastaId && rootPasta) {
      navigate({ search: { obraId, pastaId: rootPasta.id }, replace: true });
    }
  }, [obraId, search.pastaId, rootPasta, navigate]);

  const subpastas = useMemo(
    () => pastas.filter((p) => p.parent_id === pastaActualId).sort((a, b) => a.nome.localeCompare(b.nome)),
    [pastas, pastaActualId],
  );

  const { data: docs = [] } = useQuery({
    queryKey: ["docs-pasta", pastaActualId],
    enabled: !!pastaActualId,
    queryFn: async (): Promise<Documento[]> => {
      const { data, error } = await supabase
        .from("documentos")
        .select("*")
        .eq("pasta_id", pastaActualId!)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Documento[];
    },
  });

  const breadcrumbs = useMemo(() => {
    const chain: Pasta[] = [];
    let cur = pastaActual;
    while (cur) {
      chain.unshift(cur);
      cur = pastas.find((p) => p.id === cur!.parent_id) ?? null;
    }
    return chain;
  }, [pastaActual, pastas]);

  const [novaPastaOpen, setNovaPastaOpen] = useState(false);
  const [novaObraOpen, setNovaObraOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ kind: "pasta" | "doc"; id: string; nome: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ kind: "pasta" | "doc"; id: string; nome: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["pastas-obra", obraId] });
    qc.invalidateQueries({ queryKey: ["docs-pasta", pastaActualId] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const subirFicheiros = async (files: File[]) => {
    if (!files.length || !obraId || !pastaActualId) return;
    const grandes = files.filter((f) => f.size > MAX_BYTES);
    if (grandes.length) {
      toast.error(`${grandes.length} ficheiro(s) excedem 200 MB e foram ignorados`);
    }
    const validos = files.filter((f) => f.size <= MAX_BYTES);
    if (!validos.length) return;

    setUploading(true);
    setUploadProgress({ done: 0, total: validos.length });
    const { data: { user } } = await supabase.auth.getUser();

    let sucesso = 0;
    for (const file of validos) {
      const path = `${user?.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizarNome(file.name)}`;
      const { error: upErr } = await supabase.storage.from("documentos").upload(path, file);
      if (upErr) {
        toast.error(`${file.name}: ${upErr.message}`);
        setUploadProgress((p) => ({ ...p, done: p.done + 1 }));
        continue;
      }
      const { error } = await supabase.from("documentos").insert({
        nome: file.name,
        tipo: "outro" as const,
        obra_id: obraId,
        pasta_id: pastaActualId,
        storage_path: path,
        tamanho: file.size,
        mime_type: file.type || null,
        uploaded_by: user?.id,
      });
      if (error) {
        await supabase.storage.from("documentos").remove([path]);
        toast.error(`${file.name}: ${error.message}`);
      } else {
        sucesso++;
      }
      setUploadProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setUploading(false);
    if (sucesso > 0) toast.success(`${sucesso} ficheiro(s) carregados`);
    invalidar();
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!pastaActualId) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) await subirFicheiros(files);
  };

  const download = async (d: Documento) => {
    const { data, error } = await supabase.storage
      .from("documentos")
      .createSignedUrl(d.storage_path, 60);
    if (error || !data) {
      toast.error("Não foi possível obter o ficheiro");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = d.nome;
    a.click();
  };

  const eliminarPasta = async (p: Pasta) => {
    if (p.is_root) {
      toast.error("Não é possível eliminar a pasta raiz da obra");
      return;
    }
    if (!confirm(`Eliminar a pasta "${p.nome}" e todo o seu conteúdo?`)) return;
    // Collect all descendant pastas + docs to remove from storage
    const descendentes = recolherDescendentes(p.id, pastas);
    const idsPastas = [p.id, ...descendentes.map((d) => d.id)];
    const { data: docsAfetados } = await supabase
      .from("documentos")
      .select("id, storage_path")
      .in("pasta_id", idsPastas);
    const paths = (docsAfetados ?? []).map((d: any) => d.storage_path).filter(Boolean);
    if (paths.length) await supabase.storage.from("documentos").remove(paths);
    const { error } = await supabase.from("documento_pastas").delete().eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pasta eliminada");
    invalidar();
  };

  const eliminarDoc = async (d: Documento) => {
    if (!confirm(`Eliminar "${d.nome}"?`)) return;
    await supabase.storage.from("documentos").remove([d.storage_path]);
    const { error } = await supabase.from("documentos").delete().eq("id", d.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Documento eliminado");
    invalidar();
  };

  const duplicarPasta = async (p: Pasta) => {
    if (p.is_root) {
      toast.error("Não é possível duplicar a pasta raiz");
      return;
    }
    setUploading(true);
    try {
      await duplicarPastaRecursivo(p, p.parent_id, `${p.nome} (cópia)`);
      toast.success("Pasta duplicada");
      invalidar();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao duplicar pasta");
    } finally {
      setUploading(false);
    }
  };

  const duplicarDoc = async (d: Documento) => {
    if (!d.storage_path) return;
    setUploading(true);
    try {
      const novoPath = `${d.storage_path.split("/")[0]}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizarNome(d.nome)}`;
      const { error: copyErr } = await supabase.storage
        .from("documentos")
        .copy(d.storage_path, novoPath);
      if (copyErr) throw copyErr;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("documentos").insert({
        nome: nomeCopia(d.nome),
        tipo: d.tipo as any,
        obra_id: d.obra_id,
        pasta_id: d.pasta_id,
        storage_path: novoPath,
        tamanho: d.tamanho,
        mime_type: d.mime_type,
        uploaded_by: user?.id,
      });
      if (error) throw error;
      toast.success("Documento duplicado");
      invalidar();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao duplicar");
    } finally {
      setUploading(false);
    }
  };

  const irParaPasta = (id: string) => {
    navigate({ search: { obraId, pastaId: id } });
  };

  const obraSel = obras.find((o) => o.id === obraId);

  return (
    <>
      <PageHeader
        title="Gestão Documental"
        subtitle="Repositório central de toda a documentação da obra"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setNovaPastaOpen(true)}
              disabled={!pastaActualId}
            >
              <FolderPlus className="h-4 w-4 mr-1.5" /> Nova pasta
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => fileInputRef.current?.click()}
              disabled={!pastaActualId || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  {uploadProgress.total > 0
                    ? `${uploadProgress.done}/${uploadProgress.total}`
                    : "A carregar..."}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1.5" /> Carregar ficheiros
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                subirFicheiros(files);
              }}
            />
          </>
        }
      />

      <div className="grid grid-cols-[260px_1fr] gap-0 h-[calc(100vh-5rem)]">
        {/* Sidebar de obras */}
        <aside className="border-r border-border bg-card/30 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Obras
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => setNovaObraOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Nova
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {obras.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                  Sem obras
                </p>
              )}
              {obras.map((o) => (
                <button
                  key={o.id}
                  onClick={() =>
                    navigate({ search: { obraId: o.id, pastaId: undefined } })
                  }
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                    o.id === obraId
                      ? "bg-primary/15 text-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{o.nome}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Conteúdo principal */}
        <section
          className={`flex flex-col overflow-hidden relative ${
            isDragOver ? "bg-primary/5" : ""
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            if (pastaActualId) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
        >
          {isDragOver && (
            <div className="absolute inset-0 z-20 pointer-events-none border-2 border-dashed border-primary rounded-lg m-4 flex items-center justify-center bg-primary/5">
              <div className="text-center">
                <Upload className="h-10 w-10 mx-auto text-primary mb-2" />
                <p className="text-sm font-medium">Largue os ficheiros aqui</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Serão adicionados a "{pastaActual?.nome}"
                </p>
              </div>
            </div>
          )}

          {!obraSel ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecione uma obra para começar.
            </div>
          ) : (
            <>
              {/* Breadcrumbs */}
              <div className="px-6 py-3 border-b border-border flex items-center gap-1 text-sm overflow-x-auto">
                <button
                  onClick={() => rootPasta && irParaPasta(rootPasta.id)}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                >
                  <Home className="h-3.5 w-3.5" />
                </button>
                {breadcrumbs.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-1">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <button
                      onClick={() => irParaPasta(p.id)}
                      className={`px-1.5 py-0.5 rounded hover:bg-muted ${
                        i === breadcrumbs.length - 1
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {p.nome}
                    </button>
                  </div>
                ))}
              </div>

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                  {/* Pastas */}
                  {subpastas.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
                        Pastas
                      </p>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                        {subpastas.map((p) => (
                          <Card
                            key={p.id}
                            className="bg-card border-border hover:border-primary/40 transition-colors group cursor-pointer p-3 flex items-center gap-3"
                            onDoubleClick={() => irParaPasta(p.id)}
                          >
                            <button
                              onClick={() => irParaPasta(p.id)}
                              className="flex items-center gap-3 flex-1 min-w-0 text-left"
                            >
                              <FolderIcon className="h-8 w-8 text-primary shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{p.nome}</p>
                                {p.is_default && (
                                  <p className="text-[10px] text-muted-foreground">
                                    Pasta padrão
                                  </p>
                                )}
                              </div>
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    setRenameTarget({ kind: "pasta", id: p.id, nome: p.nome })
                                  }
                                >
                                  <Pencil className="h-4 w-4 mr-2" /> Renomear
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setMoveTarget({ kind: "pasta", id: p.id, nome: p.nome })
                                  }
                                >
                                  <FolderInput className="h-4 w-4 mr-2" /> Mover
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => duplicarPasta(p)}>
                                  <Copy className="h-4 w-4 mr-2" /> Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => eliminarPasta(p)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ficheiros */}
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
                      Ficheiros
                    </p>
                    {docs.length === 0 ? (
                      <div className="border border-dashed border-border rounded-lg py-12 text-center">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Arraste ficheiros para esta pasta ou use "Carregar ficheiros".
                        </p>
                      </div>
                    ) : (
                      <Card className="bg-card border-border overflow-hidden divide-y divide-border">
                        {docs.map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 group"
                          >
                            <FileIcon mime={d.mime_type} nome={d.nome} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{d.nome}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatBytes(d.tamanho)} ·{" "}
                                {new Date(d.created_at).toLocaleDateString("pt-PT")}
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => download(d)}
                              title="Transferir"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => download(d)}>
                                  <Download className="h-4 w-4 mr-2" /> Transferir
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setRenameTarget({ kind: "doc", id: d.id, nome: d.nome })
                                  }
                                >
                                  <Pencil className="h-4 w-4 mr-2" /> Renomear
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setMoveTarget({ kind: "doc", id: d.id, nome: d.nome })
                                  }
                                >
                                  <FolderInput className="h-4 w-4 mr-2" /> Mover
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => duplicarDoc(d)}>
                                  <Copy className="h-4 w-4 mr-2" /> Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => eliminarDoc(d)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </Card>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </section>
      </div>

      {/* Dialogs */}
      {novaPastaOpen && pastaActualId && obraId && (
        <NovaPastaDialog
          obraId={obraId}
          parentId={pastaActualId}
          onClose={(ok) => {
            setNovaPastaOpen(false);
            if (ok) invalidar();
          }}
        />
      )}
      {renameTarget && (
        <RenameDialog
          target={renameTarget}
          onClose={(ok) => {
            setRenameTarget(null);
            if (ok) invalidar();
          }}
        />
      )}
      {moveTarget && obraId && (
        <MoveDialog
          target={moveTarget}
          pastas={pastas}
          onClose={(ok) => {
            setMoveTarget(null);
            if (ok) invalidar();
          }}
        />
      )}
      {novaObraOpen && (
        <NovaObraDialog
          onClose={(novoId) => {
            setNovaObraOpen(false);
            if (novoId) {
              qc.invalidateQueries({ queryKey: ["obras-doc"] });
              qc.invalidateQueries({ queryKey: ["obras-min"] });
              qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
              navigate({ search: { obraId: novoId, pastaId: undefined } });
            }
          }}
        />
      )}
    </>
  );
}

/* -------- Sub-componentes -------- */

function NovaObraDialog({ onClose }: { onClose: (novoId: string | null) => void }) {
  const [nome, setNome] = useState("");
  const [cliente, setCliente] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("obras")
      .insert({
        nome: nome.trim(),
        cliente: cliente.trim() || null,
        localizacao: localizacao.trim() || null,
        created_by: user?.id,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Falha ao criar obra");
      return;
    }
    toast.success("Obra criada — pastas padrão geradas");
    onClose(data.id);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose(null)}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Nova obra</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Rua São Francisco de Sales"
            />
          </div>
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Input value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Localização</Label>
            <Input value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(null)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={busy || !nome.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy ? "A criar..." : "Criar obra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


function NovaPastaDialog({
  obraId,
  parentId,
  onClose,
}: {
  obraId: string;
  parentId: string;
  onClose: (ok: boolean) => void;
}) {
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("documento_pastas").insert({
      obra_id: obraId,
      parent_id: parentId,
      nome: nome.trim(),
      created_by: user?.id,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pasta criada");
    onClose(true);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Nova pasta</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Plantas, Cortes, Detalhes..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={busy || !nome.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy ? "A criar..." : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({
  target,
  onClose,
}: {
  target: { kind: "pasta" | "doc"; id: string; nome: string };
  onClose: (ok: boolean) => void;
}) {
  const [nome, setNome] = useState(target.nome);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setBusy(true);
    const tabela = target.kind === "pasta" ? "documento_pastas" : "documentos";
    const { error } = await supabase.from(tabela).update({ nome: nome.trim() }).eq("id", target.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Renomeado");
    onClose(true);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Renomear</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Novo nome</Label>
            <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={busy || !nome.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy ? "A guardar..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({
  target,
  pastas,
  onClose,
}: {
  target: { kind: "pasta" | "doc"; id: string; nome: string };
  pastas: Pasta[];
  onClose: (ok: boolean) => void;
}) {
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Avoid moving folder into itself or its descendants
  const proibidas = useMemo(() => {
    if (target.kind !== "pasta") return new Set<string>();
    const set = new Set<string>([target.id]);
    const filhos = recolherDescendentes(target.id, pastas);
    filhos.forEach((p) => set.add(p.id));
    return set;
  }, [target, pastas]);

  const arvore = useMemo(() => construirArvore(pastas), [pastas]);

  const submit = async () => {
    if (!destinoId) {
      toast.error("Selecione uma pasta de destino");
      return;
    }
    setBusy(true);
    if (target.kind === "pasta") {
      const { error } = await supabase
        .from("documento_pastas")
        .update({ parent_id: destinoId })
        .eq("id", target.id);
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("documentos")
        .update({ pasta_id: destinoId })
        .eq("id", target.id);
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    toast.success("Movido");
    onClose(true);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Mover "{target.nome}"</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-80 border border-border rounded-md">
          <div className="p-2">
            {arvore.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                nivel={0}
                proibidas={proibidas}
                selecionada={destinoId}
                onSelect={setDestinoId}
              />
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={busy || !destinoId}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {busy ? "A mover..." : "Mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ArvoreNo = Pasta & { filhos: ArvoreNo[] };

function TreeNode({
  node,
  nivel,
  proibidas,
  selecionada,
  onSelect,
}: {
  node: ArvoreNo;
  nivel: number;
  proibidas: Set<string>;
  selecionada: string | null;
  onSelect: (id: string) => void;
}) {
  const desativado = proibidas.has(node.id);
  return (
    <div>
      <button
        type="button"
        disabled={desativado}
        onClick={() => onSelect(node.id)}
        style={{ paddingLeft: 8 + nivel * 16 }}
        className={`w-full text-left py-1.5 text-sm rounded flex items-center gap-2 ${
          desativado
            ? "opacity-40 cursor-not-allowed"
            : selecionada === node.id
            ? "bg-primary/15 text-foreground"
            : "hover:bg-muted"
        }`}
      >
        <FolderIcon className="h-4 w-4 text-primary" />
        <span className="truncate">{node.nome}</span>
      </button>
      {node.filhos.map((f) => (
        <TreeNode
          key={f.id}
          node={f}
          nivel={nivel + 1}
          proibidas={proibidas}
          selecionada={selecionada}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

/* -------- Helpers -------- */

function construirArvore(pastas: Pasta[]): ArvoreNo[] {
  const map = new Map<string, ArvoreNo>();
  pastas.forEach((p) => map.set(p.id, { ...p, filhos: [] }));
  const roots: ArvoreNo[] = [];
  map.forEach((no) => {
    if (no.parent_id && map.has(no.parent_id)) {
      map.get(no.parent_id)!.filhos.push(no);
    } else {
      roots.push(no);
    }
  });
  const sortRec = (nos: ArvoreNo[]) => {
    nos.sort((a, b) => a.nome.localeCompare(b.nome));
    nos.forEach((n) => sortRec(n.filhos));
  };
  sortRec(roots);
  return roots;
}

function recolherDescendentes(id: string, pastas: Pasta[]): Pasta[] {
  const filhos = pastas.filter((p) => p.parent_id === id);
  return filhos.flatMap((f) => [f, ...recolherDescendentes(f.id, pastas)]);
}

async function duplicarPastaRecursivo(
  pasta: Pasta,
  novoParentId: string | null,
  novoNome: string,
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: novaPasta, error } = await supabase
    .from("documento_pastas")
    .insert({
      obra_id: pasta.obra_id,
      parent_id: novoParentId,
      nome: novoNome,
      created_by: user?.id,
    })
    .select()
    .single();
  if (error) throw error;

  // Copia ficheiros desta pasta
  const { data: docs } = await supabase
    .from("documentos")
    .select("*")
    .eq("pasta_id", pasta.id);
  for (const d of (docs ?? []) as Documento[]) {
    if (!d.storage_path) continue;
    const novoPath = `${d.storage_path.split("/")[0]}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizarNome(d.nome)}`;
    const { error: copyErr } = await supabase.storage
      .from("documentos")
      .copy(d.storage_path, novoPath);
    if (copyErr) continue;
    await supabase.from("documentos").insert({
      nome: d.nome,
      tipo: d.tipo as any,
      obra_id: d.obra_id,
      pasta_id: novaPasta!.id,
      storage_path: novoPath,
      tamanho: d.tamanho,
      mime_type: d.mime_type,
      uploaded_by: user?.id,
    });
  }

  // Recurse
  const { data: subs } = await supabase
    .from("documento_pastas")
    .select("*")
    .eq("parent_id", pasta.id);
  for (const sub of (subs ?? []) as Pasta[]) {
    await duplicarPastaRecursivo(sub, novaPasta!.id, sub.nome);
  }
}

function nomeCopia(nome: string) {
  const idx = nome.lastIndexOf(".");
  if (idx <= 0) return `${nome} (cópia)`;
  return `${nome.slice(0, idx)} (cópia)${nome.slice(idx)}`;
}

function sanitizarNome(nome: string) {
  // Storage Supabase só aceita ASCII + alguns símbolos. Remove acentos e
  // substitui caracteres não permitidos por "_".
  const semAcentos = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return semAcentos.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
}

function formatBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function FileIcon({ mime, nome }: { mime: string | null; nome: string }) {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  if (mime?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext))
    return <FileImage className="h-5 w-5 text-emerald-500 shrink-0" />;
  if (["zip", "rar", "7z"].includes(ext))
    return <FileArchive className="h-5 w-5 text-amber-500 shrink-0" />;
  if (["xls", "xlsx", "csv"].includes(ext))
    return <FileSpreadsheet className="h-5 w-5 text-green-600 shrink-0" />;
  return <FileText className="h-5 w-5 text-primary shrink-0" />;
}
