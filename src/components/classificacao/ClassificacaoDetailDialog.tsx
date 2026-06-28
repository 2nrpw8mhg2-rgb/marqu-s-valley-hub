import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Candidato, KeywordHit } from "@/lib/classificacao/engine";

type Row = {
  descricao_original: string;
  motivo: string | null;
  confianca: number;
  estado: string;
  candidatos: Candidato[] | null;
};

const NIVEL_LABEL: Record<KeywordHit["nivel"], string> = {
  especialidade: "Especialidade",
  subespecialidade: "Subespecialidade",
  artigo: "Artigo",
};

export function ClassificacaoDetailDialog({
  row,
  onClose,
}: {
  row: Row | null;
  onClose: () => void;
}) {
  const open = !!row;
  const top = row?.candidatos?.[0];
  const hits: KeywordHit[] = top?.keywords_hit ?? [];
  const negs: KeywordHit[] = top?.negativas ?? [];
  const totalPos = hits.reduce((s, h) => s + h.pontos, 0);
  const totalNeg = negs.reduce((s, h) => s + h.pontos, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhe da classificação</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Artigo original</div>
              <div className="font-medium">{row.descricao_original}</div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="outline">Confiança {row.confianca}%</Badge>
              <Badge variant="outline">Estado: {row.estado}</Badge>
              <span className="text-xs text-muted-foreground">{row.motivo ?? "—"}</span>
            </div>

            <section>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Palavras-chave encontradas
              </div>
              {hits.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">Nenhuma palavra-chave positiva.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Termo</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead className="text-right w-16">Peso</TableHead>
                      <TableHead className="text-right w-20">Pontos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hits.map((h, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{h.termo}</TableCell>
                        <TableCell className="text-xs">{NIVEL_LABEL[h.nivel]}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{h.entidade_nome}</TableCell>
                        <TableCell className="text-right tabular-nums">{h.peso}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          +{h.pontos}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>

            {negs.length > 0 && (
              <section>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Palavras negativas aplicadas
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Termo</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead className="text-right w-20">Pontos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {negs.map((h, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{h.termo}</TableCell>
                        <TableCell className="text-xs">{NIVEL_LABEL[h.nivel]}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{h.entidade_nome}</TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">{h.pontos}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            )}

            <div className="flex flex-wrap gap-4 pt-2 border-t border-border text-xs">
              <span>Positivos: <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">+{totalPos}</strong></span>
              {negs.length > 0 && (
                <span>Negativos: <strong className="text-destructive tabular-nums">{totalNeg}</strong></span>
              )}
              <span className="ml-auto">Score final: <strong className="tabular-nums">{top?.score ?? row.confianca}</strong></span>
            </div>

            {row.candidatos && row.candidatos.length > 1 && (
              <section>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Outros candidatos
                </div>
                <div className="space-y-1">
                  {row.candidatos.slice(1).map((c) => (
                    <div key={c.artigo_mestre_id} className="flex items-start justify-between gap-2 p-2 rounded border border-border text-xs">
                      <div>
                        <div className="font-medium">{c.descricao}</div>
                        <div className="text-muted-foreground">{c.motivo}</div>
                      </div>
                      <Badge variant="outline" className="shrink-0">{c.score}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
