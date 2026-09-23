import { useEffect } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { derivarCapitulos, type ArtigoMapa } from "@/lib/mapas/pastas";
import { formatarQuantidade } from "@/lib/mapas/view";

type Props = { artigo: ArtigoMapa | null; indice: number; total: number; aberto: boolean; onAberto: (aberto: boolean) => void; onAnterior: () => void; onSeguinte: () => void };

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return <div className="space-y-1"><dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm leading-6">{children}</dd></div>;
}

export function ArticleDetailPanel({ artigo, indice, total, aberto, onAberto, onAnterior, onSeguinte }: Props) {
  useEffect(() => {
    if (!aberto) return;
    const teclado = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && indice > 0) onAnterior();
      if (event.key === "ArrowRight" && indice + 1 < total) onSeguinte();
    };
    window.addEventListener("keydown", teclado);
    return () => window.removeEventListener("keydown", teclado);
  }, [aberto, indice, total, onAnterior, onSeguinte]);
  const capitulos = artigo ? derivarCapitulos(artigo) : null;
  return <Sheet open={aberto} onOpenChange={onAberto}><SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
    {artigo && <>
      <SheetHeader className="pr-8"><SheetTitle>{artigo.codigo || "Artigo sem código"}</SheetTitle><SheetDescription>Artigo {indice + 1} de {total} na vista atual</SheetDescription></SheetHeader>
      <div className="my-5 flex gap-2"><Button variant="outline" size="sm" onClick={onAnterior} disabled={indice <= 0}><ArrowLeft className="h-4 w-4" />Anterior</Button><Button variant="outline" size="sm" onClick={onSeguinte} disabled={indice + 1 >= total}>Seguinte<ArrowRight className="h-4 w-4" /></Button></div>
      <dl className="space-y-5 border-t pt-5">
        <Campo label="Descrição original">{artigo.descricao}</Campo>
        <div className="grid grid-cols-2 gap-4"><Campo label="Unidade">{artigo.unidade || "—"}</Campo><Campo label="Quantidade">{formatarQuantidade(artigo.quantidade)}</Campo></div>
        <Campo label="Capítulo">{capitulos?.capitulo || "Sem capítulo"}</Campo><Campo label="Subcapítulo">{capitulos?.subcapitulo || "Sem subcapítulo"}</Campo>
        <Campo label="Observações">{artigo.observacoes}</Campo><Campo label="Referências documentais">{artigo.referencia_documental}</Campo>
        <Campo label="Identificador do artigo">{artigo.artigo_id}</Campo>
      </dl>
    </>}
  </SheetContent></Sheet>;
}