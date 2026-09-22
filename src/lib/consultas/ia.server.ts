/**
 * Serviço de classificação semântica por IA do módulo «Preparação de Consultas».
 *
 * Toda a decisão de separação é tomada pela IA a partir da leitura integral do
 * artigo e do seu contexto. Não são usadas as regras de palavras-chave do motor
 * antigo como mecanismo de decisão.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
export const MODELO_IA = "openai/gpt-6-astra";

export type SubempreitadaRef = { id: string; codigo: string; nome: string; descricao: string | null };

export type ArtigoParaIA = {
  id: string;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  capitulo_codigo: string | null;
  capitulo_descricao: string | null;
  capitulo_raiz: string | null;
  vizinhos: string[];
};

export type ClassificacaoIA = {
  artigo_id: string;
  subempreitada_codigo: string | null;
  trabalho_principal: string;
  confianca: number;
  justificacao: string;
  necessita_revisao: boolean;
  sugestao_nova_subempreitada: string | null;
};

const SISTEMA = `És um diretor de produção de uma empresa de construção civil em Portugal.
A tua tarefa é ler cada artigo de um Mapa de Quantidades e decidir qual é o subempreiteiro (subempreitada) que seria consultado para apresentar preço para a execução desse trabalho.

Regras obrigatórias:
- Lê o artigo na sua totalidade e compreende o trabalho principal descrito. Não decidas pela simples presença de palavras.
- Cada artigo pertence a UMA única subempreitada principal. Materiais, acessórios e trabalhos acessórios mencionados na descrição (argamassas, lintéis, cortes, remates, fixações, selagens, ensaios) fazem parte da execução do trabalho principal e nunca originam classificações adicionais.
- Sistemas construtivos completos (ETICS, coberturas, caixilharias, instalações técnicas) são atribuídos ao instalador do sistema.
- Usa o contexto do capítulo e dos artigos vizinhos quando a descrição for curta ou for uma medição parcial.
- Se o artigo juntar trabalhos efetivamente distintos e não for possível identificar com segurança uma única subempreitada responsável, escolhe a mais provável, marca necessita_revisao=true e explica a dúvida. Nunca dividas nem dupliques o artigo.
- Se nenhuma subempreitada existente servir, devolve subempreitada_codigo=null, necessita_revisao=true e propõe um nome em sugestao_nova_subempreitada (sem criar duplicados das existentes).
- A confiança é um número entre 0 e 1. Abaixo de 0.7 marca sempre necessita_revisao=true.
- Devolve obrigatoriamente uma entrada por cada artigo_id recebido, com o id exatamente igual. Não inventes ids nem omitas artigos.
- Escreve sempre em português de Portugal (betão, cofragem, betonagem, tubagem, caixilharia).`;

function contextoSubempreitadas(subs: SubempreitadaRef[]) {
  return subs.map((s) => `- ${s.codigo}: ${s.nome}${s.descricao ? ` — ${s.descricao}` : ""}`).join("\n");
}

function contextoExemplos(exemplos: Array<{ descricao: string; codigo: string }>) {
  if (exemplos.length === 0) return "(ainda não há exemplos validados)";
  return exemplos.map((e) => `- [${e.codigo}] ${e.descricao.slice(0, 180)}`).join("\n");
}

function contextoBiblioteca(biblioteca: Array<{ descricao: string; codigo: string }>) {
  if (biblioteca.length === 0) return "(sem conhecimento disponível)";
  return biblioteca.map((b) => `- [${b.codigo}] ${b.descricao.slice(0, 160)}`).join("\n");
}

function artigoBloco(a: ArtigoParaIA) {
  const linhas = [
    `artigo_id: ${a.id}`,
    `código: ${a.codigo ?? "—"}`,
    `capítulo: ${a.capitulo_codigo ?? "—"} ${a.capitulo_descricao ?? ""}`.trim(),
  ];
  if (a.capitulo_raiz && a.capitulo_raiz !== a.capitulo_descricao) linhas.push(`capítulo principal: ${a.capitulo_raiz}`);
  linhas.push(`unidade: ${a.unidade ?? "—"} | quantidade: ${a.quantidade}`);
  linhas.push(`descrição: ${a.descricao}`);
  if (a.vizinhos.length > 0) {
    linhas.push(`contexto próximo: ${a.vizinhos.map((v) => v.slice(0, 120)).join(" || ")}`);
  }
  return linhas.join("\n");
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["classificacoes"],
  properties: {
    classificacoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "artigo_id",
          "subempreitada_codigo",
          "trabalho_principal",
          "confianca",
          "justificacao",
          "necessita_revisao",
          "sugestao_nova_subempreitada",
        ],
        properties: {
          artigo_id: { type: "string" },
          subempreitada_codigo: { type: ["string", "null"] },
          trabalho_principal: { type: "string" },
          confianca: { type: "number" },
          justificacao: { type: "string" },
          necessita_revisao: { type: "boolean" },
          sugestao_nova_subempreitada: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

async function lerStream(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("A IA não devolveu conteúdo.");
  const decoder = new TextDecoder();
  let buffer = "";
  let texto = "";
  let completo = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const partes = buffer.split("\n\n");
    buffer = partes.pop() ?? "";
    for (const parte of partes) {
      const linha = parte.split("\n").find((l) => l.startsWith("data:"));
      if (!linha) continue;
      const payload = linha.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") texto += evt.delta;
        if (evt.type === "response.completed" && typeof evt.response?.output_text === "string") {
          completo = evt.response.output_text;
        }
        if (evt.type === "response.failed" || evt.type === "error") {
          throw new Error(evt.response?.error?.message ?? evt.message ?? "Falha da IA.");
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
          if (!(e instanceof SyntaxError)) throw e;
        }
      }
    }
  }
  return completo || texto;
}

export async function classificarLoteComIA(input: {
  artigos: ArtigoParaIA[];
  subempreitadas: SubempreitadaRef[];
  exemplosValidados: Array<{ descricao: string; codigo: string }>;
  biblioteca: Array<{ descricao: string; codigo: string }>;
}): Promise<ClassificacaoIA[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

  const prompt = `Subempreitadas disponíveis na aplicação (usa exclusivamente estes códigos):
${contextoSubempreitadas(input.subempreitadas)}

Conhecimento técnico da Biblioteca Mestra (apoio à interpretação, não é obrigatório existir correspondência):
${contextoBiblioteca(input.biblioteca)}

Classificações anteriormente validadas por humanos (exemplos de referência):
${contextoExemplos(input.exemplosValidados)}

Artigos do Mapa de Quantidades a classificar (${input.artigos.length}):

${input.artigos.map(artigoBloco).join("\n\n---\n\n")}

Devolve uma classificação por cada artigo_id acima.`;

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODELO_IA,
      stream: true,
      instructions: SISTEMA,
      input: prompt,
      reasoning: { effort: "low" },
      text: {
        format: { type: "json_schema", name: "separacao_subempreitadas", strict: true, schema: SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    const corpo = (await res.text()).slice(0, 400);
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adiciona créditos para continuar a separação.");
    if (res.status === 429) throw new Error("A IA está a receber demasiados pedidos. Tenta novamente dentro de momentos.");
    throw new Error(`Erro da IA (${res.status}): ${corpo}`);
  }

  const texto = await lerStream(res);
  if (!texto.trim()) throw new Error("A IA não devolveu qualquer classificação.");

  let parsed: { classificacoes?: unknown };
  try {
    parsed = JSON.parse(texto);
  } catch {
    throw new Error("A IA devolveu uma resposta inválida.");
  }
  const lista = Array.isArray(parsed.classificacoes) ? parsed.classificacoes : [];
  return lista.map((r: any) => ({
    artigo_id: String(r?.artigo_id ?? ""),
    subempreitada_codigo: r?.subempreitada_codigo ? String(r.subempreitada_codigo) : null,
    trabalho_principal: String(r?.trabalho_principal ?? ""),
    confianca: Math.max(0, Math.min(1, Number(r?.confianca ?? 0))),
    justificacao: String(r?.justificacao ?? ""),
    necessita_revisao: Boolean(r?.necessita_revisao),
    sugestao_nova_subempreitada: r?.sugestao_nova_subempreitada ? String(r.sugestao_nova_subempreitada) : null,
  }));
}
