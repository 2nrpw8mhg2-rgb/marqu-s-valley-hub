import { useMemo, useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Plus, Sparkles } from "lucide-react";
import { codigoSugerido, encontrarEquivalente } from "@/lib/consultas/sugestoes";

export type SubOpcao = { id: string; codigo: string; nome: string };

function normalizar(t: string) {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Escolha rápida de subempreitada, sem sair do ecrã e sem confirmação redundante:
 * as sugestões da IA atribuem com um clique; as restantes com selecionar + confirmar.
 */
export function AtribuirSubempreitadaPopover({
  subempreitadas,
  sugestoes,
  sugestaoNova,
  onAtribuir,
  onCriar,
  children,
  titulo,
  aberto: abertoControlado,
  onAbertoChange,
}: {
  subempreitadas: SubOpcao[];
  sugestoes?: string[];
  /** Nome sugerido pela IA que ainda não existe no catálogo. */
  sugestaoNova?: string | null;
  onAtribuir: (subempreitadaId: string) => void;
  onCriar?: (nome: string, codigo: string | null) => void;
  children: ReactNode;
  titulo?: string;
  aberto?: boolean;
  onAbertoChange?: (v: boolean) => void;
}) {
  const [abertoInterno, setAbertoInterno] = useState(false);
  const aberto = abertoControlado ?? abertoInterno;
  const setAberto = (v: boolean) => {
    setAbertoInterno(v);
    onAbertoChange?.(v);
    if (!v) setModoCriar(false);
  };
  const [pesquisa, setPesquisa] = useState("");
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [modoCriar, setModoCriar] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoCodigo, setNovoCodigo] = useState("");

  const porId = useMemo(() => new Map(subempreitadas.map((s) => [s.id, s])), [subempreitadas]);
  const destaques = (sugestoes ?? []).filter((id) => porId.has(id)).slice(0, 3);

  const filtradas = useMemo(() => {
    const t = normalizar(pesquisa.trim());
    if (!t) return subempreitadas;
    return subempreitadas.filter((s) => normalizar(`${s.codigo} ${s.nome}`).includes(t));
  }, [subempreitadas, pesquisa]);

  const equivalente = useMemo(
    () => (novoNome.trim() ? encontrarEquivalente(subempreitadas, novoNome) : null),
    [subempreitadas, novoNome],
  );

  function atribuir(id: string) {
    onAtribuir(id);
    setAberto(false);
    setPesquisa("");
    setSelecionada(null);
  }

  function criar() {
    const nome = novoNome.trim();
    if (!nome || !onCriar) return;
    if (equivalente) {
      atribuir(equivalente.id);
      return;
    }
    onCriar(nome, novoCodigo.trim() || null);
    setAberto(false);
    setPesquisa("");
    setSelecionada(null);
    setNovoNome("");
    setNovoCodigo("");
  }

  function abrirCriacao() {
    setNovoNome(pesquisa.trim() || (sugestaoNova ?? ""));
    setNovoCodigo("");
    setModoCriar(true);
  }


  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0"
        align="end"
        onKeyDown={(e) => {
          if (e.key === "Enter" && selecionada) {
            e.preventDefault();
            atribuir(selecionada);
          }
        }}
      >
        <div className="p-2 border-b">
          <p className="text-xs text-muted-foreground px-1 pb-1">{titulo ?? "Atribuir subempreitada"}</p>
          <Input
            autoFocus
            aria-label="Pesquisar subempreitada por nome ou código"
            placeholder="Pesquisar por nome ou código…"
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            className="h-8"
          />
        </div>

        {destaques.length > 0 && !pesquisa && (
          <div className="p-2 border-b space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">Sugestões da IA</p>
            {destaques.map((id, i) => {
              const s = porId.get(id)!;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => atribuir(id)}
                  className="w-full text-left text-sm rounded px-2 py-1.5 hover:bg-accent flex items-center gap-2"
                >
                  {i === 0 && <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />}
                  <span className="flex-1 truncate">
                    {s.codigo} · {s.nome}
                  </span>
                  {i === 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      principal
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="max-h-[220px] overflow-y-auto p-1">
          {filtradas.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelecionada(s.id)}
              onDoubleClick={() => atribuir(s.id)}
              className={`w-full text-left text-sm rounded px-2 py-1.5 flex items-center gap-2 hover:bg-accent ${
                selecionada === s.id ? "bg-accent" : ""
              }`}
            >
              <Check className={`h-3.5 w-3.5 ${selecionada === s.id ? "opacity-100" : "opacity-0"}`} />
              <span className="flex-1 truncate">
                {s.codigo} · {s.nome}
              </span>
            </button>
          ))}
          {filtradas.length === 0 && (
            <p className="text-sm text-muted-foreground p-3">Nenhuma subempreitada encontrada.</p>
          )}
        </div>

        <div className="p-2 border-t flex justify-end">
          <Button size="sm" disabled={!selecionada} onClick={() => selecionada && atribuir(selecionada)}>
            Confirmar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
