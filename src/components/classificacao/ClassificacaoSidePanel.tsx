import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Edit3, Sparkles, ArrowDown } from "lucide-react";
import { normalizar, type Candidato, type KeywordHit, type Metodo } from "@/lib/classificacao/engine";
import { ResultadoIABadge } from "./ResultadoIABadge";
import { ConfiancaBar } from "./ConfiancaBar";
import { AddKeywordQuickDialog } from "./AddKeywordQuickDialog";
import { BibliotecaAnalisadaSection } from "./BibliotecaAnalisadaSection";
import { ComoEnsinarIASection, type EnsinarAcao } from "./ComoEnsinarIASection";
import { useInvalidateBibliotecaStats } from "./useBibliotecaStats";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type EstadoCls = "classificado_auto" | "necessita_revisao" | "sem_classificacao" | "validado";

export type PanelRow = {
  id: string;
  descricao_original: string;
  unidade_original: string | null;
  quantidade_original: number | null;
  especialidade_id: string | null;
  subespecialidade_id: string | null;
  categoria_id: string | null;
  artigo_mestre_id: string | null;
  confianca: number;
  estado: EstadoCls;
  metodo_match: Metodo;
  motivo: string | null;
  candidatos: Candidato[] | null;
};

export function ClassificacaoSidePanel({
  row, orcamentoId, onClose,
  espMap, subMap, catMap, artMap,
  onAceitar, onCorrigir, onRefresh,
}: {
  row: PanelRow | null;
  orcamentoId: string | null;
  onClose: () => void;
  espMap: Map<string, string>;
  subMap: Map<string, any>;
  catMap: Map<string, any>;
  artMap: Map<string, any>;
  onAceitar: (row: PanelRow) => void;
  onCorrigir: (row: PanelRow) => void;
  onRefresh: () => void;
}) {
  const [kwOpen, setKwOpen] = useState(false);
  const navigate = useNavigate();
  const invalidateStats = useInvalidateBibliotecaStats();
  const open = !!row;
  const norm = useMemo(() => row ? normalizar(row.descricao_original) : "", [row]);

  const handleEnsinar = async (a: EnsinarAcao) => {
    if (!row) return;
    if (a === "criar_artigo") {
      navigate({ to: "/biblioteca-mestra/artigos", search: { novo: 1, desc: row.descricao_original } as any });
    } else if (a === "adicionar_keyword") {
      setKwOpen(true);
    } else if (a === "criar_regra") {
      toast.info("Motor de regras formal — em breve");
    } else if (a === "criar_relacao") {
      navigate({ to: "/biblioteca-mestra/sistemas" });
    } else if (a === "ignorar") {
      const motivo = `${row.motivo ?? ""} [ignorado]`.trim();
      const { error } = await supabase.from("classificacao_artigos").update({ motivo }).eq("id", row.id);
      if (error) return toast.error(error.message);
      toast.success("Artigo marcado como ignorado");
      onRefresh();
      onClose();
    }
  };
  const top = row?.candidatos?.[0];
  const hits: KeywordHit[] = top?.keywords_hit ?? [];
  const negs: KeywordHit[] = top?.negativas ?? [];

  const espNome = row?.especialidade_id ? espMap.get(row.especialidade_id) : null;
  const subNome = row?.subespecialidade_id ? (subMap.get(row.subespecialidade_id) as any)?.nome : null;
  const catNome = row?.categoria_id ? (catMap.get(row.categoria_id) as any)?.nome : null;
  const art: any = row?.artigo_mestre_id ? artMap.get(row.artigo_mestre_id) : null;

  const semClass = row?.estado === "sem_classificacao";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[600px] overflow-y-auto bg-card border-border">
        {row && (
          <>
            <SheetHeader className="space-y-3">
              <SheetTitle className="text-base leading-tight pr-6">{row.descricao_original}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                <ResultadoIABadge metodo={row.metodo_match} estado={row.estado} />
                {row.estado === "validado" && (
                  <Badge variant="outline" className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/40">Validado</Badge>
                )}
              </div>
              <ConfiancaBar value={row.confianca} />
            </SheetHeader>

            <div className="space-y-6 mt-6 text-sm">
              {/* Artigo Original */}
              <Section title="Artigo Original">
                <div className="text-sm">{row.descricao_original}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Quantidade: <span className="text-foreground tabular-nums">{row.quantidade_original ?? "—"}</span>
                  {" · "}
                  Unidade: <span className="text-foreground">{row.unidade_original ?? "—"}</span>
                </div>
              </Section>

              {/* Sugestão da IA */}
              <Section title="Sugestão da IA">
                {!espNome && !subNome && !catNome && !art ? (
                  <div className="text-xs text-muted-foreground italic">Nenhuma sugestão disponível.</div>
                ) : (
                  <Breadcrumb items={[espNome, subNome, catNome, art?.descricao].filter(Boolean) as string[]} />
                )}
              </Section>

              {/* IA Explica */}
              <Section title="IA Explica" icon={<Sparkles className="h-3.5 w-3.5" />}>
                <ol className="space-y-3">
                  <Passo n={1} label="Normalização">
                    <div className="text-xs text-muted-foreground break-words">
                      <span className="line-through">{row.descricao_original}</span>
                      <ArrowDown className="inline h-3 w-3 mx-1" />
                      <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{norm || "—"}</code>
                    </div>
                  </Passo>

                  <Passo n={2} label="Palavras-chave encontradas">
                    {hits.length === 0 && negs.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic">Nenhuma palavra-chave conhecida foi encontrada.</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {hits.map((h, i) => (
                          <Badge key={`p${i}`} variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400" title={`${h.nivel} · ${h.entidade_nome}`}>
                            {h.termo} <span className="ml-1 opacity-70">+{h.pontos}</span>
                          </Badge>
                        ))}
                        {negs.map((h, i) => (
                          <Badge key={`n${i}`} variant="outline" className="text-[10px] border-destructive/40 text-destructive" title={`${h.nivel} · ${h.entidade_nome}`}>
                            {h.termo} <span className="ml-1 opacity-70">{h.pontos}</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Passo>

                  <Passo n={3} label="Regras aplicadas" muted>
                    <div className="text-xs text-muted-foreground italic">Motor de regras formal — em breve.</div>
                  </Passo>

                  <Passo n={4} label="Relações construtivas" muted>
                    <div className="text-xs text-muted-foreground italic">Integração com Motor de Relações — em breve.</div>
                  </Passo>

                  <Passo n={5} label="Artigos semelhantes">
                    {!row.candidatos || row.candidatos.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic">Nenhum Artigo Mestre semelhante encontrado.</div>
                    ) : (
                      <div className="space-y-1">
                        {row.candidatos.map((c, i) => (
                          <div key={c.artigo_mestre_id ?? i} className="flex items-start justify-between gap-2 p-2 rounded border border-border text-xs">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{c.descricao}</div>
                              <div className="text-muted-foreground line-clamp-1">{c.motivo}</div>
                            </div>
                            <Badge variant="outline" className="shrink-0 tabular-nums">{c.score}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </Passo>

                  <Passo n={6} label="Classificação final">
                    {semClass ? (
                      <div className="text-xs text-muted-foreground">Sem classificação atribuída.</div>
                    ) : (
                      <div className="text-xs">
                        <div className="font-medium">{art?.descricao ?? "—"}</div>
                        <div className="text-muted-foreground mt-0.5">Confiança final: <span className="tabular-nums">{row.confianca}%</span></div>
                      </div>
                    )}
                  </Passo>
                </ol>

                {semClass && (
                  <div className="mt-4 p-3 rounded-md bg-muted/40 border border-border space-y-1 text-xs">
                    <div className="font-semibold text-foreground">Não foi possível classificar porque:</div>
                    <div>✗ Nenhuma palavra-chave conhecida foi encontrada.</div>
                    <div>✗ Nenhuma regra corresponde.</div>
                    <div>✗ Nenhum Artigo Mestre semelhante.</div>
                    <div>✗ Nenhuma relação construtiva encontrada.</div>
                    <div className="text-muted-foreground pt-1">Adiciona uma palavra-chave ou cria um novo Artigo Mestre para ensinar a IA.</div>
                  </div>
                )}
              </Section>

              <Separator />

              {/* Ações */}
              <Section title="Ações">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm" variant="outline"
                    className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                    disabled={!row.artigo_mestre_id || row.estado === "validado"}
                    onClick={() => onAceitar(row)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Aceitar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onCorrigir(row)}>
                    <Edit3 className="h-4 w-4 mr-1" /> Corrigir
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => navigate({ to: "/biblioteca-mestra/artigos", search: { novo: 1, desc: row.descricao_original } as any })}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Criar Artigo Mestre
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setKwOpen(true)}>
                    <Tag className="h-4 w-4 mr-1" /> Adicionar Palavra-chave
                  </Button>
                  <Button size="sm" variant="outline" disabled onClick={() => toast.info("Motor de regras em breve")}>
                    <Sparkles className="h-4 w-4 mr-1" /> Criar Regra
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    disabled={!row.artigo_mestre_id}
                    onClick={() => navigate({ to: "/biblioteca-mestra/artigos" })}
                  >
                    <GitBranch className="h-4 w-4 mr-1" /> Adicionar Relação
                  </Button>
                </div>
              </Section>
            </div>

            <AddKeywordQuickDialog
              open={kwOpen} onClose={() => setKwOpen(false)} descricao={row.descricao_original}
              artigoMestreId={row.artigo_mestre_id}
              subespecialidadeId={row.subespecialidade_id}
              especialidadeId={row.especialidade_id}
              onSaved={onRefresh}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
        {icon}{title}
      </div>
      {children}
    </section>
  );
}

function Passo({ n, label, muted, children }: { n: number; label: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <div className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-mono tabular-nums ${muted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
        {n}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium mb-1">{label}</div>
        {children}
      </div>
    </li>
  );
}

function Breadcrumb({ items }: { items: string[] }) {
  return (
    <div className="space-y-1">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <span className="text-muted-foreground font-mono text-xs mt-0.5">{i === 0 ? "" : "↓"}</span>
          <span className={i === items.length - 1 ? "font-medium" : "text-muted-foreground"}>{it}</span>
        </div>
      ))}
    </div>
  );
}
