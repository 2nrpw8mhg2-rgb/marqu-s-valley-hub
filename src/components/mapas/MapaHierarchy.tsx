import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { agruparArtigos, formatarQuantidade } from "@/lib/mapas/view";
import type { ArtigoMapa } from "@/lib/mapas/pastas";
import { DescriptionCell } from "./DescriptionCell";

type Props = { artigos: ArtigoMapa[]; selecionados: Set<string>; expandidos: Set<string>; gruposFechados: Set<string>; onSelecionar: (id: string, valor: boolean) => void; onSelecionarTodos: (valor: boolean) => void; onExpandirDescricao: (id: string) => void; onDetalhes: (id: string) => void; onGrupo: (id: string) => void };

function GrupoTitulo({ nivel, nome, total, resumo, aberto, onClick }: { nivel: 1 | 2; nome: string; total: number; resumo: string | null; aberto: boolean; onClick: () => void }) {
  return <Button variant="ghost" className={cn("h-auto w-full justify-start rounded-none py-2 text-left", nivel === 1 ? "bg-muted/80 px-3 font-semibold" : "bg-muted/35 px-6 text-sm")} onClick={onClick} aria-expanded={aberto}>
    {aberto ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}<span className="min-w-0 flex-1 truncate">{nome}</span><span className="shrink-0 text-xs font-normal text-muted-foreground">{total} {total === 1 ? "artigo" : "artigos"}{resumo ? ` · ${resumo}` : ""}</span>
  </Button>;
}

function ArtigoCard({ artigo, selecionado, expandido, onSelecionar, onExpandir, onDetalhes }: { artigo: ArtigoMapa; selecionado: boolean; expandido: boolean; onSelecionar: (v: boolean) => void; onExpandir: () => void; onDetalhes: () => void }) {
  return <article className={cn("space-y-3 border-b p-4", selecionado && "bg-accent")}>
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3"><Checkbox checked={selecionado} onCheckedChange={(v) => onSelecionar(v === true)} aria-label={`Selecionar artigo ${artigo.codigo ?? "sem código"}`} /><div className="min-w-0"><div className="truncate font-mono text-xs font-medium">{artigo.codigo ?? "Sem código"}</div><div className="mt-1 flex gap-3 text-xs text-muted-foreground"><span>{artigo.unidade ?? "—"}</span><span className="tabular-nums">{formatarQuantidade(artigo.quantidade)}</span></div></div><Button variant="ghost" size="sm" onClick={onDetalhes}>Detalhes</Button></div>
    <DescriptionCell descricao={artigo.descricao} expandida={expandido} onAlternar={onExpandir} onDetalhes={onDetalhes} />
    {(artigo.observacoes || artigo.referencia_documental) && <p className="line-clamp-2 text-xs text-muted-foreground">{artigo.observacoes ?? artigo.referencia_documental}</p>}
  </article>;
}

export function MapaHierarchy(props: Props) {
  const grupos = agruparArtigos(props.artigos);
  const todos = props.artigos.length > 0 && props.artigos.every((a) => props.selecionados.has(a.artigo_id));
  const alguns = props.artigos.some((a) => props.selecionados.has(a.artigo_id));
  const checkboxEstado = todos ? true : alguns ? "indeterminate" : false;
  return <div>
    <div className="hidden md:block"><Table className="table-fixed"><colgroup><col className="w-10" /><col className="w-[110px]" /><col /><col className="w-[70px]" /><col className="w-[100px]" /><col className="w-[132px]" /></colgroup><TableHeader className="sticky top-[142px] z-10 bg-background"><TableRow><TableHead><Checkbox checked={checkboxEstado} onCheckedChange={(v) => props.onSelecionarTodos(v === true)} aria-label="Selecionar todos os artigos visíveis nesta página" /></TableHead><TableHead>Código</TableHead><TableHead>Descrição original</TableHead><TableHead>Un.</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader>
      <TableBody>{grupos.map((cap) => { const capAberto = !props.gruposFechados.has(cap.id); return <FragmentoGrupo key={cap.id} cap={cap} capAberto={capAberto} {...props} />; })}</TableBody></Table></div>
    <div className="md:hidden"><div className="flex items-center gap-2 border-b px-4 py-3 text-sm"><Checkbox checked={checkboxEstado} onCheckedChange={(v) => props.onSelecionarTodos(v === true)} aria-label="Selecionar todos os artigos visíveis nesta página" /><span>Selecionar todos os visíveis</span></div>{grupos.map((cap) => { const capAberto = !props.gruposFechados.has(cap.id); return <div key={cap.id}><GrupoTitulo nivel={1} nome={cap.nome} total={cap.artigos} resumo={cap.resumoQuantidade} aberto={capAberto} onClick={() => props.onGrupo(cap.id)} />{capAberto && cap.subcapitulos.map((sub) => { const aberto = !props.gruposFechados.has(sub.id); return <div key={sub.id}><GrupoTitulo nivel={2} nome={sub.nome} total={sub.artigos.length} resumo={sub.resumoQuantidade} aberto={aberto} onClick={() => props.onGrupo(sub.id)} />{aberto && sub.artigos.map((a) => <ArtigoCard key={a.artigo_id} artigo={a} selecionado={props.selecionados.has(a.artigo_id)} expandido={props.expandidos.has(a.artigo_id)} onSelecionar={(v) => props.onSelecionar(a.artigo_id, v)} onExpandir={() => props.onExpandirDescricao(a.artigo_id)} onDetalhes={() => props.onDetalhes(a.artigo_id)} />)}</div>; })}</div>; })}</div>
  </div>;
}

function FragmentoGrupo({ cap, capAberto, ...props }: Props & { cap: ReturnType<typeof agruparArtigos>[number]; capAberto: boolean }) {
  return <><TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="p-0"><GrupoTitulo nivel={1} nome={cap.nome} total={cap.artigos} resumo={cap.resumoQuantidade} aberto={capAberto} onClick={() => props.onGrupo(cap.id)} /></TableCell></TableRow>{capAberto && cap.subcapitulos.map((sub) => { const aberto = !props.gruposFechados.has(sub.id); return <FragmentoSubgrupo key={sub.id} sub={sub} aberto={aberto} {...props} />; })}</>;
}

function FragmentoSubgrupo({ sub, aberto, ...props }: Props & { sub: ReturnType<typeof agruparArtigos>[number]["subcapitulos"][number]; aberto: boolean }) {
  return <><TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="p-0"><GrupoTitulo nivel={2} nome={sub.nome} total={sub.artigos.length} resumo={sub.resumoQuantidade} aberto={aberto} onClick={() => props.onGrupo(sub.id)} /></TableCell></TableRow>{aberto && sub.artigos.map((a) => <TableRow key={a.artigo_id} data-state={props.selecionados.has(a.artigo_id) ? "selected" : undefined} className="align-top"><TableCell><Checkbox checked={props.selecionados.has(a.artigo_id)} onCheckedChange={(v) => props.onSelecionar(a.artigo_id, v === true)} aria-label={`Selecionar artigo ${a.codigo ?? "sem código"}`} /></TableCell><TableCell className="font-mono text-xs">{a.codigo ?? "—"}</TableCell><TableCell><DescriptionCell descricao={a.descricao} expandida={props.expandidos.has(a.artigo_id)} onAlternar={() => props.onExpandirDescricao(a.artigo_id)} onDetalhes={() => props.onDetalhes(a.artigo_id)} /></TableCell><TableCell>{a.unidade ?? "—"}</TableCell><TableCell className="text-right tabular-nums">{formatarQuantidade(a.quantidade)}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => props.onDetalhes(a.artigo_id)}>Ver detalhes</Button></TableCell></TableRow>)}</>;
}