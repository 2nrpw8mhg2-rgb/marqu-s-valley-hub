import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  texto: string;
  rotuloGrupo: string;
  expandido: boolean;
  onAlternar: () => void;
  className?: string;
};

/** Título de grupo que só oferece expansão quando o texto excede as linhas disponíveis. */
export function HierarchyTitle({ texto, rotuloGrupo, expandido, onAlternar, className }: Props) {
  const descricaoId = useId();
  const textoRef = useRef<HTMLParagraphElement | null>(null);
  const [truncado, setTruncado] = useState(false);

  const medir = useCallback(() => {
    const elemento = textoRef.current;
    if (!elemento || typeof window === "undefined") return;
    const estilo = window.getComputedStyle(elemento);
    const alturaLinha = Number.parseFloat(estilo.lineHeight) || Number.parseFloat(estilo.fontSize) * 1.2;
    const linhasVisiveis = window.matchMedia("(max-width: 767px)").matches ? 2 : 1;
    setTruncado(elemento.scrollHeight > alturaLinha * linhasVisiveis + 1);
  }, []);

  useLayoutEffect(() => {
    medir();
    const elemento = textoRef.current;
    if (!elemento || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    if (elemento.parentElement) observador.observe(elemento.parentElement);
    window.addEventListener("resize", medir);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [medir, texto, expandido]);

  return <div className={cn("min-w-0 flex-1", className)}>
    <p
      ref={textoRef}
      id={descricaoId}
      className={cn("min-w-0 break-words [overflow-wrap:anywhere]", expandido ? "whitespace-normal" : "line-clamp-1 max-md:line-clamp-2")}
    >
      {texto}
    </p>
    {truncado && <Button
      type="button"
      variant="link"
      size="sm"
      className="mt-0.5 h-auto min-h-7 justify-start p-0 text-xs"
      aria-expanded={expandido}
      aria-controls={descricaoId}
      aria-label={`${expandido ? "Recolher descrição" : "Ver descrição completa"} de ${rotuloGrupo}`}
      onClick={(evento) => {
        evento.stopPropagation();
        onAlternar();
      }}
    >
      {expandido ? "Recolher descrição" : "Ver descrição completa"}
    </Button>}
  </div>;
}