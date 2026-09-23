import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  descricao: string;
  expandida: boolean;
  onAlternar: () => void;
  onDetalhes: () => void;
};

export function DescriptionCell({ descricao, expandida, onAlternar, onDetalhes }: Props) {
  const longa = descricao.length > 180 || descricao.split("\n").length > 3;
  return (
    <div className="min-w-0 space-y-1.5">
      <button
        type="button"
        className={cn(
          "block w-full cursor-pointer whitespace-pre-wrap break-words text-left leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !expandida && "line-clamp-3",
        )}
        onClick={onDetalhes}
        aria-label="Ver detalhes do artigo"
      >
        {descricao}
      </button>
      <div className="flex flex-wrap items-center gap-1">
        {longa && (
          <Button variant="link" size="sm" className="h-6 px-0 text-xs" onClick={onAlternar} aria-expanded={expandida}>
            {expandida ? "Recolher" : "Ver descrição completa"}
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={onDetalhes}>
          Ver detalhes
        </Button>
      </div>
    </div>
  );
}