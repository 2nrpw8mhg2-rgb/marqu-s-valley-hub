import { Library } from "lucide-react";
import { useBibliotecaStats, useUltimaRunDuracao } from "./useBibliotecaStats";

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-PT");

export function BibliotecaAnalisadaSection({
  orcamentoId,
  candidatosCount,
  semClassificacao,
}: {
  orcamentoId: string | null;
  candidatosCount: number;
  semClassificacao: boolean;
}) {
  const { data: s } = useBibliotecaStats();
  const { data: dur } = useUltimaRunDuracao(orcamentoId);

  const rows: Array<{ label: string; value: string; muted?: boolean }> = [
    { label: "Especialidades analisadas", value: fmt(s?.especialidades) },
    { label: "Subespecialidades analisadas", value: fmt(s?.subespecialidades) },
    { label: "Categorias analisadas", value: fmt(s?.categorias) },
    { label: "Artigos Mestre analisados", value: fmt(s?.artigos) },
    { label: "Palavras-chave analisadas", value: fmt(s?.keywords) },
    { label: "Regras avaliadas", value: "—", muted: true },
    { label: "Relações construtivas analisadas", value: fmt(s?.relacoes) },
    { label: "Artigos semelhantes comparados", value: fmt(candidatosCount) },
    {
      label: "Tempo total de análise",
      value: dur == null ? "—" : `${dur.toFixed(2).replace(".", ",")} s`,
    },
  ];

  return (
    <section>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
        <Library className="h-3.5 w-3.5" /> Biblioteca Analisada
      </div>
      <div className="rounded-md border border-border divide-y divide-border">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-3 py-1.5 text-xs">
            <span className={r.muted ? "text-muted-foreground italic" : "text-muted-foreground"}>{r.label}</span>
            <span className={`font-mono tabular-nums ${r.muted ? "text-muted-foreground" : "text-foreground font-medium"}`}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
      {semClassificacao && (
        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
          O artigo foi analisado em toda a Biblioteca Mestra. Neste momento ainda não existe
          conhecimento suficiente para atribuir uma classificação automática com confiança elevada.
        </p>
      )}
    </section>
  );
}
