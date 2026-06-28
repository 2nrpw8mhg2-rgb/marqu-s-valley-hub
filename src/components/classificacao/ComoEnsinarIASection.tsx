import { GraduationCap, Plus, Tag, Sparkles, GitBranch, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

export type EnsinarAcao = "criar_artigo" | "adicionar_keyword" | "criar_regra" | "criar_relacao" | "ignorar";

export function ComoEnsinarIASection({ onAction }: { onAction: (a: EnsinarAcao) => void }) {
  const items: Array<{ id: EnsinarAcao; icon: any; label: string; hint: string; cls: string }> = [
    { id: "criar_artigo", icon: Plus, label: "Criar Artigo Mestre", hint: "Usa este artigo como ponto de partida.", cls: "border-blue-500/40 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10" },
    { id: "adicionar_keyword", icon: Tag, label: "Adicionar Palavra-chave", hint: "Ensina o termo ao artigo mais adequado.", cls: "border-yellow-500/40 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/10" },
    { id: "criar_regra", icon: Sparkles, label: "Criar Regra", hint: "Define uma regra de classificação. (em breve)", cls: "border-border text-muted-foreground" },
    { id: "criar_relacao", icon: GitBranch, label: "Criar Relação Construtiva", hint: "Liga este artigo a outros relacionados.", cls: "border-purple-500/40 text-purple-700 dark:text-purple-400 hover:bg-purple-500/10" },
    { id: "ignorar", icon: SkipForward, label: "Ignorar", hint: "Mantém pendente para futuras classificações.", cls: "border-border text-foreground hover:bg-muted" },
  ];
  return (
    <section className="rounded-md border border-primary/30 bg-primary/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-1 flex items-center gap-1.5">
        <GraduationCap className="h-3.5 w-3.5" /> Como Ensinar a IA
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
        Este artigo ainda não conseguiu ser classificado automaticamente porque a Biblioteca Mestra
        não possui conhecimento suficiente para o identificar com confiança. Pode ensinar a IA
        através de uma das seguintes ações.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Button
              key={it.id}
              size="sm"
              variant="outline"
              className={`justify-start h-auto py-2 ${it.cls}`}
              onClick={() => onAction(it.id)}
            >
              <Icon className="h-4 w-4 mr-2 shrink-0" />
              <div className="text-left min-w-0">
                <div className="text-xs font-medium">{it.label}</div>
                <div className="text-[10px] opacity-80 font-normal">{it.hint}</div>
              </div>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
