import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ArtigoMapa } from "@/lib/mapas/pastas";
import { ajustarSelecaoVisivel, agruparArtigos, filtrarOrdenarArtigos, opcoesHierarquia, paginarArtigos, type MapaPageSize, type MapaSearch } from "@/lib/mapas/view";
import { ArticleDetailPanel } from "./ArticleDetailPanel";
import { MapaHierarchy } from "./MapaHierarchy";
import { MapaToolbar } from "./MapaToolbar";

type Props = { artigos: ArtigoMapa[]; estado: MapaSearch; onEstado: (patch: Partial<MapaSearch>, reiniciar?: boolean) => void };

export function MapaQuantidadesView({ artigos, estado, onEstado }: Props) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [gruposFechados, setGruposFechados] = useState<Set<string>>(new Set());
  const opcoes = useMemo(() => opcoesHierarquia(artigos, estado.capitulo), [artigos, estado.capitulo]);
  const filtrados = useMemo(() => filtrarOrdenarArtigos(artigos, estado), [artigos, estado]);
  const pagina = useMemo(() => paginarArtigos(filtrados, estado.pagina, estado.tamanho), [filtrados, estado.pagina, estado.tamanho]);
  useEffect(() => { if (pagina.pagina !== estado.pagina) onEstado({ pagina: pagina.pagina }); }, [pagina.pagina, estado.pagina, onEstado]);
  useEffect(() => { setSelecionados((atuais) => ajustarSelecaoVisivel(atuais, pagina.artigos)); }, [pagina.artigos]);
  useEffect(() => { if (estado.q) setGruposFechados(new Set()); }, [estado.q]);

  const abrirDetalhes = useCallback((id: string) => onEstado({ artigo: id }), [onEstado]);
  const indiceDetalhe = estado.artigo ? filtrados.findIndex((a) => a.artigo_id === estado.artigo) : -1;
  const artigoDetalhe = indiceDetalhe >= 0 ? filtrados[indiceDetalhe] : null;
  function irDetalhe(indice: number) { const artigo = filtrados[indice]; if (artigo) abrirDetalhes(artigo.artigo_id); }
  function selecionar(id: string, valor: boolean) { setSelecionados((atuais) => { const prox = new Set(atuais); valor ? prox.add(id) : prox.delete(id); return prox; }); }
  function selecionarTodos(valor: boolean) { setSelecionados(valor ? new Set(pagina.artigos.map((a) => a.artigo_id)) : new Set()); }
  function alternarConjunto(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) { setter((atuais) => { const prox = new Set(atuais); prox.has(id) ? prox.delete(id) : prox.add(id); return prox; }); }
  const doPrimeiro = (estado.pagina - 1) * estado.tamanho + 1;
  const doUltimo = Math.min(estado.pagina * estado.tamanho, filtrados.length);

  if (!filtrados.length) return <div className="overflow-hidden rounded-md border bg-card"><MapaToolbar estado={estado} capitulos={opcoes.capitulos} subcapitulos={opcoes.subcapitulos} visiveis={0} total={artigos.length} selecionados={0} onAlterar={onEstado} onExpandir={() => {}} onRecolher={() => {}} onLimparSelecao={() => setSelecionados(new Set())} /><div className="grid min-h-64 place-items-center p-8 text-center"><div><FileQuestion className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h3 className="font-medium">Sem artigos correspondentes</h3><p className="mt-1 text-sm text-muted-foreground">Altere a pesquisa ou limpe os filtros.</p></div></div></div>;

  return <div className="overflow-visible rounded-md border bg-card">
    <MapaToolbar estado={estado} capitulos={opcoes.capitulos} subcapitulos={opcoes.subcapitulos} visiveis={filtrados.length} total={artigos.length} selecionados={selecionados.size} onAlterar={onEstado} onExpandir={() => { setExpandidos(new Set(pagina.artigos.map((a) => a.artigo_id))); setGruposFechados(new Set()); }} onRecolher={() => { setExpandidos(new Set()); setGruposFechados(new Set(agruparArtigos(pagina.artigos).flatMap((g) => [g.id, ...g.subcapitulos.map((s) => s.id)]))); }} onLimparSelecao={() => setSelecionados(new Set())} />
    <MapaHierarchy artigos={pagina.artigos} selecionados={selecionados} expandidos={expandidos} gruposFechados={gruposFechados} onSelecionar={selecionar} onSelecionarTodos={selecionarTodos} onExpandirDescricao={(id) => alternarConjunto(setExpandidos, id)} onDetalhes={abrirDetalhes} onGrupo={(id) => alternarConjunto(setGruposFechados, id)} />
    <div className="grid gap-3 border-t px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Linhas por página</span><Select value={String(estado.tamanho)} onValueChange={(v) => onEstado({ tamanho: Number(v) as MapaPageSize }, true)}><SelectTrigger className="w-20" aria-label="Linhas por página"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="25">25</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select></div>
      <p className="text-center text-xs text-muted-foreground">{doPrimeiro}–{doUltimo} de {filtrados.length} · Página {pagina.pagina} de {pagina.totalPaginas}</p>
      <nav className="flex justify-center gap-1 sm:justify-end" aria-label="Paginação do mapa"><Button variant="ghost" size="icon" onClick={() => onEstado({ pagina: 1 })} disabled={pagina.pagina === 1} aria-label="Primeira página"><ChevronFirst className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => onEstado({ pagina: pagina.pagina - 1 })} disabled={pagina.pagina === 1} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => onEstado({ pagina: pagina.pagina + 1 })} disabled={pagina.pagina === pagina.totalPaginas} aria-label="Página seguinte"><ChevronRight className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => onEstado({ pagina: pagina.totalPaginas })} disabled={pagina.pagina === pagina.totalPaginas} aria-label="Última página"><ChevronLast className="h-4 w-4" /></Button></nav>
    </div>
    <ArticleDetailPanel artigo={artigoDetalhe} indice={indiceDetalhe} total={filtrados.length} aberto={Boolean(artigoDetalhe)} onAberto={(aberto) => { if (!aberto) onEstado({ artigo: undefined }); }} onAnterior={() => irDetalhe(indiceDetalhe - 1)} onSeguinte={() => irDetalhe(indiceDetalhe + 1)} />
  </div>;
}