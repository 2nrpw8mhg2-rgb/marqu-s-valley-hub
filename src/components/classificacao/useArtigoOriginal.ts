import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ArtigoOriginalData = {
  artigo: {
    id: string;
    codigo: string | null;
    descricao: string;
    unidade: string | null;
    quantidade: number | null;
    preco_unitario: number | null;
    ordem: number | null;
    notas: string | null;
  };
  capitulo: { id: string; codigo: string | null; descricao: string | null } | null;
  orcamento: { id: string; nome: string; versao: number | null; versao_label: string | null; obra_id: string | null };
  prev: { id: string; codigo: string | null; descricao: string; ordem: number | null } | null;
  next: { id: string; codigo: string | null; descricao: string; ordem: number | null } | null;
};

export function useArtigoOriginal(artigoOrigemId: string | null) {
  return useQuery<ArtigoOriginalData | null>({
    queryKey: ["artigo-original", artigoOrigemId],
    enabled: !!artigoOrigemId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: a, error } = await supabase
        .from("orcamento_artigos")
        .select(`
          id, codigo, descricao, unidade, quantidade, preco_unitario, ordem, notas,
          capitulo:orcamento_capitulos(id, codigo, descricao),
          orcamento:orcamentos(id, nome, versao, versao_label, obra_id)
        `)
        .eq("id", artigoOrigemId!)
        .maybeSingle();
      if (error) throw error;
      if (!a) return null;

      const orcId = (a as any).orcamento?.id;
      const ordem = (a as any).ordem;
      let prev = null;
      let next = null;
      if (orcId && typeof ordem === "number") {
        const [{ data: p }, { data: n }] = await Promise.all([
          supabase.from("orcamento_artigos")
            .select("id, codigo, descricao, ordem")
            .eq("orcamento_id", orcId).lt("ordem", ordem)
            .order("ordem", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("orcamento_artigos")
            .select("id, codigo, descricao, ordem")
            .eq("orcamento_id", orcId).gt("ordem", ordem)
            .order("ordem", { ascending: true }).limit(1).maybeSingle(),
        ]);
        prev = p as any;
        next = n as any;
      }

      return {
        artigo: {
          id: a.id, codigo: (a as any).codigo, descricao: (a as any).descricao,
          unidade: (a as any).unidade, quantidade: (a as any).quantidade,
          preco_unitario: (a as any).preco_unitario, ordem: (a as any).ordem,
          notas: (a as any).notas,
        },
        capitulo: (a as any).capitulo ?? null,
        orcamento: (a as any).orcamento,
        prev, next,
      };
    },
  });
}
