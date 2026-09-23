import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Permissões administrativas do utilizador autenticado.
 * Fonte de verdade: tabela `user_roles` (protegida por RLS) — não há autorização
 * inventada no frontend; o servidor continua a validar cada operação.
 */
export function usePodeAdministrar() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["permissoes-admin", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as string);
    },
  });

  return {
    carregando: !!user?.id && isLoading,
    podeAdministrar: (data ?? []).includes("admin"),
    papeis: data ?? [],
  };
}
