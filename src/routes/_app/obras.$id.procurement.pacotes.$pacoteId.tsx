import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapaQuantidadesView } from "@/components/mapas/MapaQuantidadesView";
import { EstadoBadge, EstadoVazio } from "@/components/procurement/ui";
import { validarMapaSearch } from "@/lib/mapas/view";
import { dataPT, nomeFicheiroMapa, type PastaMapa } from "@/lib/mapas/pastas";
import { MIME_PDF, MIME_XLSX, descarregar } from "@/lib/mapas/dados";
import { excelMapaBytes, type MetaMapa } from "@/lib/mapas/excel";
import { pdfMapaBytes } from "@/lib/mapas/pdf";
import { useAuth } from "@/hooks/useAuth";
import {
  AMBITO_VAZIO,
  alternarDocumento,
  alternarEmpresa,
  guardarAmbito,
  marcarDocumentoObrigatorio,
  useInvalidarProcurement,
  usePacoteApoio,
  useProcurementObra,
} from "@/lib/procurement/dados";
import { ambitoPreenchido, etiquetaVersao, type Ambito } from "@/lib/procurement/fase1";
import { Download, FileSignature, FileSpreadsheet, FolderOpen, Send, Users } from "lucide-react";

const SEPARADORES = [
  { chave: "mapa", rotulo: "Mapa de Quantidades" },
  { chave: "documentacao", rotulo: "Documentação" },
  { chave: "empresas", rotulo: "Empresas a Consultar" },
  { chave: "cotacao", rotulo: "Pedidos de Cotação" },
  { chave: "propostas", rotulo: "Propostas e Comparação" },
] as const;
type Separador = (typeof SEPARADORES)[number]["chave"];

export const Route = createFileRoute("/_app/obras/$id/procurement/pacotes/$pacoteId")({
  validateSearch: (search: Record<string, unknown>) => {
    const tab = String(search.tab ?? "mapa");
    return {
      ...validarMapaSearch(search),
      tab: (SEPARADORES.some((s) => s.chave === tab) ? tab : "mapa") as Separador,
    };
  },
  head: () => ({
    meta: [
      { title: "Pacote de Consulta · Procurement · MV OC" },
      { name: "description", content: "Preparação de um pacote de consulta: mapa de quantidades, âmbito, documentação e empresas." },
      { property: "og:title", content: "Pacote de Consulta · Procurement · MV OC" },
      { property: "og:description", content: "Mapa, âmbito, documentos e empresas de um pacote de consulta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PacoteDetalhe,
});

function PacoteDetalhe() {
  const { id, pacoteId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/obras/$id/procurement/pacotes/$pacoteId" });
  const dados = useProcurementObra(id);
  const pacote = dados.linhas.find((l) => l.id === pacoteId) ?? null;
  const [aExportar, setAExportar] = useState<"xlsx" | "pdf" | null>(null);

  function irPara(patch: Record<string, unknown>, reiniciar = false) {
    navigate({
      search: (a) => ({ ...a, ...patch, ...(reiniciar ? { pagina: 1 } : {}) }),
      replace: true,
    });
  }

  const pasta: PastaMapa | null = pacote
    ? {
        subempreitada_id: pacote.subempreitada_id ?? pacote.id,
        codigo: pacote.nome.slice(0, 6).toUpperCase(),
        nome: pacote.nome,
        etiqueta: pacote.nome,
        artigos: pacote.artigos_elegiveis,
        total: pacote.artigos,
        validada: pacote.artigos_elegiveis.every((a) => a.validado_manual && !a.necessita_revisao),
        atualizado_em: pacote.atualizado_em,
      }
    : null;

  const meta: MetaMapa = {
    obra_nome: dados.obra?.nome ?? "Obra",
    obra_cliente: dados.obra?.cliente ?? null,
    orcamento_nome: dados.orcamento?.nome ?? "Mapa de Quantidades",
    data: dataPT(),
    provisorio: !(pasta?.validada ?? false),
    versao: etiquetaVersao(1, 1),
  };

  function exportar(formato: "xlsx" | "pdf") {
    if (!pasta || aExportar) return;
    setAExportar(formato);
    try {
      const bytes = formato === "xlsx" ? excelMapaBytes(pasta, meta) : pdfMapaBytes(pasta, meta);
      descarregar(bytes, nomeFicheiroMapa(meta.obra_nome, pasta.etiqueta, formato), formato === "xlsx" ? MIME_XLSX : MIME_PDF);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar o ficheiro.");
    } finally {
      setAExportar(null);
    }
  }

  if (dados.isLoading) {
    return <div className="space-y-3 p-4 sm:p-6" aria-label="A carregar pacote"><Skeleton className="h-24 w-full" /><Skeleton className="h-80 w-full" /></div>;
  }

  if (!pacote) {
    return (
      <div className="p-4 sm:p-6">
        <EstadoVazio
          titulo="Pacote não encontrado nesta obra"
          descricao="O pacote pode ter sido removido ou pertence a outra obra."
          accao={
            <Link to="/obras/$id/procurement/pacotes" params={{ id }}>
              <Button variant="outline" size="sm" className="mt-2">Voltar aos pacotes</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <nav className="text-xs text-muted-foreground" aria-label="Percurso">
        <Link to="/obras/$id/procurement" params={{ id }} className="hover:text-foreground">Procurement</Link>
        <span className="mx-1">→</span>
        <Link to="/obras/$id/procurement/pacotes" params={{ id }} className="hover:text-foreground">Pacotes de Consulta</Link>
        <span className="mx-1">→</span>
        <span className="text-foreground">{pacote.nome}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{dados.obra?.nome}</div>
          <h1 className="truncate text-xl font-semibold sm:text-2xl">{pacote.nome}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <EstadoBadge estado={pacote.estado} />
            <span>{meta.versao}</span>
            <span>{pacote.artigos} artigos</span>
            <span>{pacote.empresas} empresas</span>
            <span>{pacote.consultas_enviadas} consultas</span>
            <span>{pacote.respostas} respostas</span>
          </div>
        </div>
        {pacote.alertas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pacote.alertas.map((a) => (
              <Badge key={a} variant="outline" className="text-[10px] font-normal">{a}</Badge>
            ))}
          </div>
        )}
      </header>

      <div role="tablist" aria-label="Separadores do pacote" className="flex flex-wrap gap-1 border-b">
        {SEPARADORES.map((s) => (
          <button
            key={s.chave}
            role="tab"
            aria-selected={search.tab === s.chave}
            onClick={() => irPara({ tab: s.chave })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              search.tab === s.chave
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.rotulo}
          </button>
        ))}
      </div>

      {search.tab === "mapa" && pasta && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => exportar("xlsx")} disabled={aExportar !== null}>
              <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportar("pdf")} disabled={aExportar !== null}>
              <Download className="h-4 w-4" /> Exportar PDF
            </Button>
          </div>
          <MapaQuantidadesView artigos={pasta.artigos} estado={search} onEstado={irPara} />
          <AmbitoConsulta pacoteId={pacote.id} obraId={id} inicial={pacote.ambito} />
        </div>
      )}

      {search.tab === "documentacao" && <Documentacao obraId={id} pacoteId={pacote.id} />}
      {search.tab === "empresas" && <Empresas obraId={id} pacoteId={pacote.id} subempreitada={pacote.nome} />}

      {search.tab === "cotacao" && (
        <EstadoVazio
          titulo="Ainda não há pedidos de cotação"
          descricao="O pedido de cotação é criado depois de o pacote estar preparado — mapa, âmbito, documentação e empresas. O envio nunca é automático e chega numa fase seguinte."
          icone={<Send className="h-8 w-8" />}
        />
      )}

      {search.tab === "propostas" && (
        <EstadoVazio
          titulo="Sem propostas para este pacote"
          descricao="As propostas e a comparação surgem depois de existirem consultas enviadas e respostas recebidas."
          icone={<FileSignature className="h-8 w-8" />}
        />
      )}
    </div>
  );
}

function AmbitoConsulta({ pacoteId, obraId, inicial }: { pacoteId: string; obraId: string; inicial: Ambito | null }) {
  const { user } = useAuth();
  const invalidar = useInvalidarProcurement(obraId);
  const [valores, setValores] = useState<Ambito>(inicial ?? AMBITO_VAZIO);
  const [estado, setEstado] = useState<"guardado" | "a-guardar" | "por-guardar">("guardado");
  const primeiro = useRef(true);

  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    setEstado("por-guardar");
    const t = setTimeout(async () => {
      setEstado("a-guardar");
      try {
        await guardarAmbito(pacoteId, valores, user?.id ?? null);
        await invalidar(pacoteId);
        setEstado("guardado");
      } catch (e: any) {
        setEstado("por-guardar");
        toast.error(e?.message ?? "Não foi possível guardar o âmbito.");
      }
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores]);

  const campos: Array<{ chave: keyof Ambito; rotulo: string }> = [
    { chave: "ambito_geral", rotulo: "Âmbito geral" },
    { chave: "responsabilidades_mv", rotulo: "Responsabilidades da Marquês Valley" },
    { chave: "responsabilidades_subempreiteiro", rotulo: "Responsabilidades do subempreiteiro" },
    { chave: "inclusoes", rotulo: "Inclusões" },
    { chave: "exclusoes", rotulo: "Exclusões" },
    { chave: "alternativas", rotulo: "Alternativas permitidas" },
    { chave: "observacoes", rotulo: "Observações" },
  ];

  return (
    <section className="rounded-md border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-medium">Âmbito da Consulta</h3>
          <p className="text-xs text-muted-foreground">
            Camada do pacote. Não altera o Mapa de Quantidades nem as classificações.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {estado === "guardado" ? (ambitoPreenchido(valores) ? "Guardado" : "Por preencher") : estado === "a-guardar" ? "A guardar…" : "Alterações por guardar"}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {campos.map((c) => (
          <div key={c.chave} className="space-y-1">
            <Label htmlFor={`ambito-${c.chave}`}>{c.rotulo}</Label>
            <Textarea
              id={`ambito-${c.chave}`}
              rows={3}
              value={valores[c.chave]}
              onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function Documentacao({ obraId, pacoteId }: { obraId: string; pacoteId: string }) {
  const { user } = useAuth();
  const invalidar = useInvalidarProcurement(obraId);
  const apoio = usePacoteApoio(pacoteId);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["documentos-obra", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("id, nome, tipo, tamanho, created_at, pasta:documento_pastas(nome)")
        .eq("obra_id", obraId)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const associados = useMemo(
    () => new Map((apoio.data?.documentos ?? []).map((d: any) => [d.documento_id, d])),
    [apoio.data],
  );

  const termo = q.trim().toLowerCase();
  const lista = (data ?? []).filter((d: any) => (termo ? d.nome.toLowerCase().includes(termo) : true));

  async function alternar(documentoId: string, ativo: boolean) {
    try {
      await alternarDocumento(pacoteId, documentoId, ativo, user?.id ?? null);
      await apoio.refetch();
      await invalidar(pacoteId);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível atualizar a associação.");
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (!lista.length) {
    return (
      <EstadoVazio
        titulo="Sem documentos nesta obra"
        descricao="Os documentos são os da Gestão Documental da obra. Nenhum ficheiro é criado ou duplicado aqui."
        icone={<FolderOpen className="h-8 w-8" />}
        accao={
          <Link to="/documentos" search={{ obraId } as never}>
            <Button variant="outline" size="sm" className="mt-2">Abrir Gestão Documental</Button>
          </Link>
        }
      />
    );
  }

  return (
    <section className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Selecione os documentos da obra a incluir na consulta. Retirar a seleção nunca apaga o ficheiro.
      </p>
      <Input placeholder="Pesquisar documento…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar documento" />
      <ul className="divide-y rounded-md border bg-card">
        {lista.map((d: any) => {
          const assoc = associados.get(d.id);
          const pastaNome = Array.isArray(d.pasta) ? d.pasta[0]?.nome : d.pasta?.nome;
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-3 p-3">
              <Checkbox
                checked={Boolean(assoc)}
                onCheckedChange={(v) => alternar(d.id, Boolean(v))}
                aria-label={`Incluir ${d.nome} na consulta`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {pastaNome ?? "Sem pasta"} · {d.tipo} · {d.tamanho ? `${Math.round(d.tamanho / 1024)} KB` : "—"} ·{" "}
                  {d.created_at ? new Date(d.created_at).toLocaleDateString("pt-PT") : "—"}
                </p>
              </div>
              {assoc && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={Boolean(assoc.obrigatorio)}
                    onCheckedChange={async (v) => {
                      await marcarDocumentoObrigatorio(pacoteId, d.id, Boolean(v));
                      await apoio.refetch();
                    }}
                    aria-label={`Marcar ${d.nome} como obrigatório`}
                  />
                  Obrigatório
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function normalizar(t: string) {
  return (t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function Empresas({ obraId, pacoteId, subempreitada }: { obraId: string; pacoteId: string; subempreitada: string }) {
  const { user } = useAuth();
  const invalidar = useInvalidarProcurement(obraId);
  const apoio = usePacoteApoio(pacoteId);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["subempreiteiros-procurement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subempreiteiros")
        .select("id, nome, email, emails, telefone, telefones, contacto_nome, especialidades, subespecialidades, ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selecionadas = new Set((apoio.data?.empresas ?? []).map((e: any) => e.subempreiteiro_id));
  const alvo = normalizar(subempreitada);
  const termo = normalizar(q);

  const empresas = (data ?? [])
    .filter((e: any) => (termo ? normalizar(`${e.nome} ${(e.especialidades ?? []).join(" ")}`).includes(termo) : true))
    .map((e: any) => ({
      ...e,
      sugerida: (e.especialidades ?? []).concat(e.subespecialidades ?? []).some((s: string) => {
        const n = normalizar(s);
        return n && (alvo.includes(n) || n.includes(alvo.split(" ")[0] ?? ""));
      }),
    }))
    .sort((a: any, b: any) => Number(b.sugerida) - Number(a.sugerida) || a.nome.localeCompare(b.nome, "pt"));

  async function alternar(empresaId: string, ativo: boolean) {
    try {
      await alternarEmpresa(pacoteId, empresaId, ativo, user?.id ?? null);
      await apoio.refetch();
      await invalidar(pacoteId);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível atualizar a empresa.");
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (!empresas.length) {
    return (
      <EstadoVazio
        titulo="Sem empresas registadas"
        descricao="As empresas vêm da base global de subempreiteiros, partilhada por todas as obras. Nenhuma empresa é criada automaticamente."
        icone={<Users className="h-8 w-8" />}
        accao={
          <Link to="/subempreiteiros">
            <Button variant="outline" size="sm" className="mt-2">Registar empresas</Button>
          </Link>
        }
      />
    );
  }

  return (
    <section className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Base global de subempreiteiros. As correspondências com «{subempreitada}» aparecem primeiro. Nenhum convite ou
        email é enviado.
      </p>
      <Input placeholder="Pesquisar empresa…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar empresa" />
      <ul className="divide-y rounded-md border bg-card">
        {empresas.map((e: any) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 p-3">
            <Checkbox
              checked={selecionadas.has(e.id)}
              onCheckedChange={(v) => alternar(e.id, Boolean(v))}
              aria-label={`Consultar ${e.nome}`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {e.nome} {e.sugerida && <Badge variant="outline" className="ml-1 text-[10px]">Sugerida</Badge>}
                {!e.ativo && <Badge variant="outline" className="ml-1 text-[10px]">Inativa</Badge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[e.contacto_nome, e.email ?? (e.emails ?? [])[0], e.telefone ?? (e.telefones ?? [])[0]]
                  .filter(Boolean)
                  .join(" · ") || "Sem contacto registado"}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
