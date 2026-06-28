import { useNavigate } from "@tanstack/react-router";
import { FileText, Copy, ListOrdered, FileSearch, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useArtigoOriginal } from "./useArtigoOriginal";

const fmtNum = (n: number | null | undefined, dec = 2) =>
  n == null ? "—" : n.toLocaleString("pt-PT", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtEur = (n: number | null | undefined) =>
  n == null ? null : n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

function deriveSubcap(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  const parts = codigo.split(".");
  if (parts.length < 3) return null;
  return parts.slice(0, parts.length - 1).join(".");
}

export function ArtigoOriginalSection({ artigoOrigemId }: { artigoOrigemId: string | null }) {
  const navigate = useNavigate();
  const { data, isLoading } = useArtigoOriginal(artigoOrigemId);

  if (isLoading) {
    return <div className="text-xs text-muted-foreground italic">A carregar artigo original…</div>;
  }
  if (!data) {
    return <div className="text-xs text-muted-foreground italic">Artigo original não encontrado.</div>;
  }

  const { artigo, capitulo, orcamento, prev, next } = data;
  const versaoLbl = orcamento.versao_label || (orcamento.versao ? `v${orcamento.versao}` : "");
  const mqLabel = `${orcamento.nome}${versaoLbl ? ` · ${versaoLbl}` : ""}`;
  const artigoRef = artigo.codigo || (artigo.ordem != null ? `#${artigo.ordem}` : "—");
  const subcap = deriveSubcap(artigo.codigo);
  const total = artigo.quantidade != null && artigo.preco_unitario != null
    ? artigo.quantidade * Number(artigo.preco_unitario) : null;

  const refTexto = [
    `MQ ${versaoLbl || orcamento.nome}`,
    capitulo?.codigo ? `Capítulo ${capitulo.codigo}` : null,
    `Artigo ${artigoRef}`,
  ].filter(Boolean).join(" → ");

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(refTexto);
      toast.success("Referência copiada");
    } catch { toast.error("Não foi possível copiar"); }
  };

  const abrirNoMQ = () => {
    if (!orcamento.obra_id) return toast.error("Obra não associada");
    navigate({ to: "/obras/$id/mq", params: { id: orcamento.obra_id }, search: { focus: artigo.id } as any });
  };

  return (
    <section className="space-y-3">
      {/* Breadcrumb */}
      <nav className="flex items-center flex-wrap gap-1 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">MQ {versaoLbl || orcamento.nome}</span>
        {capitulo?.codigo && (
          <>
            <ChevronRight className="h-3 w-3 opacity-60" />
            <span>Capítulo {capitulo.codigo}</span>
          </>
        )}
        {subcap && (
          <>
            <ChevronRight className="h-3 w-3 opacity-60" />
            <span>{subcap}</span>
          </>
        )}
        <ChevronRight className="h-3 w-3 opacity-60" />
        <span className="font-medium text-foreground">Artigo {artigoRef}</span>
      </nav>

      {/* Localização */}
      <dl className="rounded-md border border-border divide-y divide-border">
        <Row label="Mapa de Quantidades" value={mqLabel} />
        {capitulo && (
          <Row
            label="Capítulo"
            value={`${capitulo.codigo ?? ""}${capitulo.codigo && capitulo.descricao ? " — " : ""}${capitulo.descricao ?? ""}`.trim() || "—"}
          />
        )}
        {subcap && <Row label="Subcapítulo" value={subcap} />}
        <Row label="Artigo" value={artigoRef} mono />
      </dl>

      {/* Informação do artigo */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <div className="text-sm leading-snug">{artigo.descricao}</div>
        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
          <Field label="Quantidade" value={fmtNum(artigo.quantidade)} />
          <Field label="Unidade" value={artigo.unidade ?? "—"} />
          {artigo.preco_unitario != null && Number(artigo.preco_unitario) > 0 && (
            <Field label="Preço unitário" value={fmtEur(Number(artigo.preco_unitario)) ?? "—"} />
          )}
          {total != null && total > 0 && (
            <Field label="Preço total" value={fmtEur(total) ?? "—"} />
          )}
        </div>
      </div>

      {/* Acções rápidas */}
      <TooltipProvider delayDuration={300}>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={abrirNoMQ}>
            <FileText className="h-3.5 w-3.5 mr-1.5" /> Abrir no MQ
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <ListOrdered className="h-3.5 w-3.5 mr-1.5" /> Ver contexto
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-2 text-xs bg-card border-border">
              <ContextoRow label="Anterior" item={prev} />
              <div className="my-1 border-t border-border" />
              <div className="p-2 rounded bg-primary/10 border border-primary/30">
                <div className="font-mono text-[10px] text-primary mb-0.5">{artigo.codigo ?? `#${artigo.ordem ?? "—"}`}</div>
                <div className="line-clamp-2">{artigo.descricao}</div>
              </div>
              <div className="my-1 border-t border-border" />
              <ContextoRow label="Seguinte" item={next} />
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="contents">
                <Button size="sm" variant="outline" className="h-8 text-xs w-full" disabled>
                  <FileSearch className="h-3.5 w-3.5 mr-1.5" /> Abrir documento
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Documento de origem ainda não associado</TooltipContent>
          </Tooltip>

          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={copiar}>
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar referência
          </Button>
        </div>
      </TooltipProvider>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-1.5 text-xs">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className={`text-right text-foreground ${mono ? "font-mono tabular-nums" : ""}`}>{value}</dd>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}

function ContextoRow({ label, item }: { label: string; item: { codigo: string | null; descricao: string; ordem: number | null } | null }) {
  if (!item) return <div className="p-2 text-muted-foreground italic">Sem artigo {label.toLowerCase()}</div>;
  return (
    <div className="p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
      <div className="font-mono text-[10px] text-muted-foreground">{item.codigo ?? `#${item.ordem ?? "—"}`}</div>
      <div className="line-clamp-2">{item.descricao}</div>
    </div>
  );
}
