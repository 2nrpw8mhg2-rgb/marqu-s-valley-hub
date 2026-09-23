import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { agruparArtigos, formatarQuantidade } from "@/lib/mapas/view";
import type { ArtigoMapa } from "@/lib/mapas/pastas";
import { DescriptionCell } from "./DescriptionCell";
import { HierarchyTitle } from "./HierarchyTitle";

type Props = { artigos: ArtigoMapa[]; selecionados: Set<string>; expandidos: Set<string>; descricoesGruposExpandidas: Set<string>; gruposFechados: Set<string>; onSelecionar: (id: string, valor: boolean) => void; onSelecionarTodos: (valor: boolean) => void; onExpandirDescricao: (id: string) => void; onExpandirDescricaoGrupo: (id: string) => void; onDetalhes: (id: string) => void; onGrupo: (id: string) => void };

const TH = "sticky top-[var(--mapa-toolbar-h,0px)] z-10 h-10 border-b bg-background px-2 text-left align-middle text-xs font-medium text-muted-foreground";
const TD = "border-b px-2 py-2 align-top";

function GrupoTitulo({ nivel, nome, total, resumo, aberto, descricaoExpandida, onGrupo, onDescricao }: { nivel: 1 | 2; nome: string; total: number; resumo: string | null; aberto: boolean; descricaoExpandida: boolean; onGrupo: () => void; onDescricao: () => void }) {
  const tipo = nivel === 1 ? "capítulo" : "subcapítulo";
  return <div className={cn("flex w-full items-start gap-2 py-2", nivel === 1 ? "bg-muted/80 px-3 font-semibold" : "bg-muted/35 px-3 text-sm md:px-6")}>
    <Button type="button" variant="ghost" size="icon" className="h-7 min-h-7 w-7 min-w-7 shrink-0" onClick={onGrupo} aria-expanded={aberto} aria-label={`${aberto ? "Recolher" : "Expandir"} artigos do ${tipo} ${nome}`}>
      {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </Button>
    <HierarchyTitle texto={nome} rotuloGrupo={`${tipo} ${nome}`} expandido={descricaoExpandida} onAlternar={onDescricao} />
    <span className="shrink-0 pt-1 text-right text-xs font-normal text-muted-foreground">{total} {total === 1 ? "artigo" : "artigos"}{resumo ? <><span className="hidden sm:inline"> · </span><span className="block sm:inline">{resumo}</span></> : ""}</span>
  </div>;
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
    <div className="hidden md:block">
      <table className="w-full table-fixed caption-bottom text-sm" data-testid="mapa-tabela">
        <colgroup><col className="w-10" /><col className="w-[110px]" /><col /><col className="w-[70px]" /><col className="w-[100px]" /><col className="w-[132px]" /></colgroup>
        <thead data-testid="mapa-thead">
          <tr>
            <th scope="col" className={TH}><Checkbox checked={checkboxEstado} onCheckedChange={(v) => props.onSelecionarTodos(v === true)} aria-label="Selecionar todos os artigos visíveis nesta página" /></th>
            <th scope="col" className={TH}>Código</th>
            <th scope="col" className={TH}>Descrição original</th>
            <th scope="col" className={TH}>Un.</th>
            <th scope="col" className={cn(TH, "text-right")}>Quantidade</th>
            <th scope="col" className={TH}><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody data-testid="mapa-tbody">{grupos.map((cap) => { const capAberto = !props.gruposFechados.has(cap.id); return <FragmentoGrupo key={cap.id} cap={cap} capAberto={capAberto} {...props} />; })}</tbody>
      </table>
    </div>
    <div className="md:hidden"><div className="flex items-center gap-2 border-b px-4 py-3 text-sm"><Checkbox checked={checkboxEstado} onCheckedChange={(v) => props.onSelecionarTodos(v === true)} aria-label="Selecionar todos os artigos visíveis nesta página" /><span>Selecionar todos os visíveis</span></div>{grupos.map((cap) => { const capAberto = !props.gruposFechados.has(cap.id); return <div key={cap.id}><GrupoTitulo nivel={1} nome={cap.nome} total={cap.artigos} resumo={cap.resumoQuantidade} aberto={capAberto} descricaoExpandida={props.descricoesGruposExpandidas.has(cap.id)} onGrupo={() => props.onGrupo(cap.id)} onDescricao={() => props.onExpandirDescricaoGrupo(cap.id)} />{capAberto && cap.subcapitulos.map((sub) => { const aberto = !props.gruposFechados.has(sub.id); return <div key={sub.id}><GrupoTitulo nivel={2} nome={sub.nome} total={sub.artigos.length} resumo={sub.resumoQuantidade} aberto={aberto} descricaoExpandida={props.descricoesGruposExpandidas.has(sub.id)} onGrupo={() => props.onGrupo(sub.id)} onDescricao={() => props.onExpandirDescricaoGrupo(sub.id)} />{aberto && sub.artigos.map((a) => <ArtigoCard key={a.artigo_id} artigo={a} selecionado={props.selecionados.has(a.artigo_id)} expandido={props.expandidos.has(a.artigo_id)} onSelecionar={(v) => props.onSelecionar(a.artigo_id, v)} onExpandir={() => props.onExpandirDescricao(a.artigo_id)} onDetalhes={() => props.onDetalhes(a.artigo_id)} />)}</div>; })}</div>; })}</div>
  </div>;
}

function FragmentoGrupo({ cap, capAberto, ...props }: Props & { cap: ReturnType<typeof agruparArtigos>[number]; capAberto: boolean }) {
  return <><tr><td colSpan={6} className="border-b p-0"><GrupoTitulo nivel={1} nome={cap.nome} total={cap.artigos} resumo={cap.resumoQuantidade} aberto={capAberto} descricaoExpandida={props.descricoesGruposExpandidas.has(cap.id)} onGrupo={() => props.onGrupo(cap.id)} onDescricao={() => props.onExpandirDescricaoGrupo(cap.id)} /></td></tr>{capAberto && cap.subcapitulos.map((sub) => { const aberto = !props.gruposFechados.has(sub.id); return <FragmentoSubgrupo key={sub.id} sub={sub} aberto={aberto} {...props} />; })}</>;
}

function FragmentoSubgrupo({ sub, aberto, ...props }: Props & { sub: ReturnType<typeof agruparArtigos>[number]["subcapitulos"][number]; aberto: boolean }) {
  return <><tr><td colSpan={6} className="border-b p-0"><GrupoTitulo nivel={2} nome={sub.nome} total={sub.artigos.length} resumo={sub.resumoQuantidade} aberto={aberto} descricaoExpandida={props.descricoesGruposExpandidas.has(sub.id)} onGrupo={() => props.onGrupo(sub.id)} onDescricao={() => props.onExpandirDescricaoGrupo(sub.id)} /></td></tr>{aberto && sub.artigos.map((a) => <tr key={a.artigo_id} data-state={props.selecionados.has(a.artigo_id) ? "selected" : undefined} className="align-top transition-colors hover:bg-muted/40 data-[state=selected]:bg-accent"><td className={TD}><Checkbox checked={props.selecionados.has(a.artigo_id)} onCheckedChange={(v) => props.onSelecionar(a.artigo_id, v === true)} aria-label={`Selecionar artigo ${a.codigo ?? "sem código"}`} /></td><td className={cn(TD, "font-mono text-xs")}>{a.codigo ?? "—"}</td><td className={TD}><DescriptionCell descricao={a.descricao} expandida={props.expandidos.has(a.artigo_id)} onAlternar={() => props.onExpandirDescricao(a.artigo_id)} onDetalhes={() => props.onDetalhes(a.artigo_id)} /></td><td className={TD}>{a.unidade ?? "—"}</td><td className={cn(TD, "text-right tabular-nums")}>{formatarQuantidade(a.quantidade)}</td><td className={TD}><Button variant="ghost" size="sm" onClick={() => props.onDetalhes(a.artigo_id)}>Ver detalhes</Button></td></tr>)}</>;
}
