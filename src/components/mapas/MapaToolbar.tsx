import { useEffect, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MapaDirecao, MapaOrdenacao, MapaSearch } from "@/lib/mapas/view";

type Opcao = { id: string; nome: string };
type Props = {
  estado: MapaSearch;
  capitulos: Opcao[];
  subcapitulos: Opcao[];
  visiveis: number;
  total: number;
  selecionados: number;
  onAlterar: (patch: Partial<MapaSearch>, reiniciar?: boolean) => void;
  onExpandir: () => void;
  onRecolher: () => void;
  onLimparSelecao: () => void;
};

export function MapaToolbar(props: Props) {
  const [pesquisa, setPesquisa] = useState(props.estado.q);
  useEffect(() => setPesquisa(props.estado.q), [props.estado.q]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (pesquisa !== props.estado.q) props.onAlterar({ q: pesquisa }, true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [pesquisa, props]);

  const temFiltros = Boolean(props.estado.q || props.estado.capitulo || props.estado.subcapitulo || props.estado.ordenar !== "original");
  const ordem = `${props.estado.ordenar}:${props.estado.direcao}`;

  return (
    <div className="sticky top-0 z-20 space-y-3 border-y bg-background/95 px-3 py-3 backdrop-blur sm:px-4">
      <div className="grid gap-2 lg:grid-cols-[minmax(240px,1fr)_180px_180px_190px_auto]">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} className="pl-9" placeholder="Pesquisar código ou descrição" aria-label="Pesquisar por código ou descrição" />
        </div>
        <Select value={props.estado.capitulo || "todos"} onValueChange={(v) => props.onAlterar({ capitulo: v === "todos" ? "" : v, subcapitulo: "" }, true)}>
          <SelectTrigger aria-label="Filtrar por capítulo"><SelectValue placeholder="Todos os capítulos" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os capítulos</SelectItem>{props.capitulos.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={props.estado.subcapitulo || "todos"} onValueChange={(v) => props.onAlterar({ subcapitulo: v === "todos" ? "" : v }, true)}>
          <SelectTrigger aria-label="Filtrar por subcapítulo"><SelectValue placeholder="Todos os subcapítulos" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os subcapítulos</SelectItem>{props.subcapitulos.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={ordem} onValueChange={(v) => { const [ordenar, direcao] = v.split(":") as [MapaOrdenacao, MapaDirecao]; props.onAlterar({ ordenar, direcao }, true); }}>
          <SelectTrigger aria-label="Ordenar artigos"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="original:asc">Ordem original</SelectItem><SelectItem value="codigo:asc">Código crescente</SelectItem><SelectItem value="codigo:desc">Código decrescente</SelectItem><SelectItem value="unidade:asc">Unidade crescente</SelectItem><SelectItem value="unidade:desc">Unidade decrescente</SelectItem><SelectItem value="quantidade:asc">Quantidade crescente</SelectItem><SelectItem value="quantidade:desc">Quantidade decrescente</SelectItem>
          </SelectContent>
        </Select>
        {temFiltros && <Button variant="ghost" size="icon" onClick={() => { setPesquisa(""); props.onAlterar({ q: "", capitulo: "", subcapitulo: "", ordenar: "original", direcao: "asc" }, true); }} aria-label="Limpar filtros"><X className="h-4 w-4" /></Button>}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap">
        <span className="min-w-0 truncate text-xs text-muted-foreground"><strong className="text-foreground">{props.visiveis}</strong> de {props.total} artigos visíveis</span>
        <TooltipProvider>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={props.onExpandir}><ChevronsUpDown className="h-4 w-4" /> <span className="hidden sm:inline">Expandir todos</span></Button></TooltipTrigger><TooltipContent>Expandir descrições desta página</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={props.onRecolher}><ChevronsDownUp className="h-4 w-4" /> <span className="hidden sm:inline">Recolher todos</span></Button></TooltipTrigger><TooltipContent>Recolher grupos e descrições</TooltipContent></Tooltip>
          </div>
        </TooltipProvider>
      </div>
      {props.selecionados > 0 && <div className="flex items-center justify-between rounded-md border bg-muted px-3 py-2 text-sm"><span>{props.selecionados} selecionados</span><Button variant="ghost" size="sm" onClick={props.onLimparSelecao}>Limpar seleção</Button></div>}
    </div>
  );
}