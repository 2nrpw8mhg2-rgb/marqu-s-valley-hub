import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BibliotecaStats = {
  especialidades: number;
  subespecialidades: number;
  categorias: number;
  artigos: number;
  keywords: number;
  regras: number | null;
  relacoes: number | null;
};

async function fetchStats(): Promise<BibliotecaStats> {
  const head = { count: "exact" as const, head: true };
  const [esp, sub, cat, art, kArt, kSub, kEsp, rel] = await Promise.all([
    supabase.from("biblioteca_especialidades").select("*", head),
    supabase.from("biblioteca_subespecialidades").select("*", head),
    supabase.from("biblioteca_categorias").select("*", head),
    supabase.from("biblioteca_artigos").select("*", head).eq("ativo", true),
    supabase.from("biblioteca_artigo_keywords").select("*", head),
    supabase.from("biblioteca_subespecialidade_keywords").select("*", head).eq("ativo", true),
    supabase.from("biblioteca_especialidade_keywords").select("*", head).eq("ativo", true),
    supabase.from("biblioteca_artigo_relacoes" as any).select("*", head),
  ]);
  return {
    especialidades: esp.count ?? 0,
    subespecialidades: sub.count ?? 0,
    categorias: cat.count ?? 0,
    artigos: art.count ?? 0,
    keywords: (kArt.count ?? 0) + (kSub.count ?? 0) + (kEsp.count ?? 0),
    regras: null,
    relacoes: rel.error ? null : (rel.count ?? 0),
  };
}

export function useBibliotecaStats() {
  return useQuery({
    queryKey: ["biblioteca-stats"],
    queryFn: fetchStats,
    staleTime: 60_000,
  });
}

export function useInvalidateBibliotecaStats() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["biblioteca-stats"] });
}

export function useUltimaRunDuracao(orcamentoId: string | null) {
  return useQuery({
    queryKey: ["ultima-run-duracao", orcamentoId],
    enabled: !!orcamentoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("orcamento_classificacao_run")
        .select("iniciado_em, concluido_em")
        .eq("orcamento_id", orcamentoId!)
        .eq("estado", "concluido")
        .order("concluido_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data?.iniciado_em || !data?.concluido_em) return null;
      const ms = new Date(data.concluido_em).getTime() - new Date(data.iniciado_em).getTime();
      return ms / 1000;
    },
    staleTime: 60_000,
  });
}
