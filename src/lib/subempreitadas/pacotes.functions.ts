import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ResultadoGeracao = {
  pacotes_criados: number;
  pacotes_atualizados: number;
  artigos_incluidos: number;
};

export const gerarPacotesSubempreitadas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ orcamento_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: resultado, error } = await (context.supabase as any).rpc(
      "gerar_pacotes_por_subempreitada",
      { p_orcamento_id: data.orcamento_id },
    );
    if (error) throw new Error(error.message);
    const row = (resultado?.[0] ?? {
      pacotes_criados: 0,
      pacotes_atualizados: 0,
      artigos_incluidos: 0,
    }) as ResultadoGeracao;
    return row;
  });
