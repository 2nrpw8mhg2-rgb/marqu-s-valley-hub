import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Users, Star, Mail, Phone, Search, Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { ESPECIALIDADES, normKey, splitMulti } from "@/lib/subempreiteiros-specialties";

export const Route = createFileRoute("/_app/subempreiteiros")({
  head: () => ({ meta: [{ title: "Subempreiteiros — MV OS" }] }),
  component: SubsPage,
});

type Sub = {
  id: string;
  nome: string;
  nif: string | null;
  tipo: string | null;
  especialidades: string[];
  zonas: string[];
  distrito: string | null;
  concelho: string | null;
  contacto_nome: string | null;
  telefone: string | null;
  email: string | null;
  emails: string[];
  telefones: string[];
  avaliacao: number | null;
  ativo: boolean;
  alvara_valido_ate: string | null;
  seguro_valido_ate: string | null;
  notas: string | null;
};

function SubsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [search, setSearch] = useState("");
  const [filterEsp, setFilterEsp] = useState<string>("all");
  const [filterDistrito, setFilterDistrito] = useState<string>("all");
  const [filterConcelho, setFilterConcelho] = useState<string>("all");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterAlvara, setFilterAlvara] = useState<string>("all");
  const [filterSeguro, setFilterSeguro] = useState<string>("all");

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["subempreiteiros"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subempreiteiros").select("*").order("nome");
      if (error) throw error;
      return data as Sub[];
    },
  });

  const distritos = useMemo(
    () => Array.from(new Set(subs.map((s) => s.distrito).filter(Boolean))).sort() as string[],
    [subs],
  );
  const concelhos = useMemo(
    () => Array.from(new Set(subs.map((s) => s.concelho).filter(Boolean))).sort() as string[],
    [subs],
  );

  const today = new Date().toISOString().slice(0, 10);

  const filtered = subs.filter((s) => {
    const hay = [
      s.nome,
      s.nif,
      s.contacto_nome,
      s.email,
      s.telefone,
      ...(s.emails ?? []),
      ...(s.telefones ?? []),
      ...(s.especialidades ?? []),
      ...(s.zonas ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (search && !hay.includes(search.toLowerCase())) return false;
    if (filterEsp !== "all" && !(s.especialidades ?? []).includes(filterEsp)) return false;
    if (filterDistrito !== "all" && s.distrito !== filterDistrito) return false;
    if (filterConcelho !== "all" && s.concelho !== filterConcelho) return false;
    if (filterEstado === "ativo" && !s.ativo) return false;
    if (filterEstado === "inativo" && s.ativo) return false;
    if (filterClass !== "all" && (s.avaliacao ?? -1) < Number(filterClass)) return false;
    if (filterAlvara === "valido" && (!s.alvara_valido_ate || s.alvara_valido_ate < today)) return false;
    if (filterAlvara === "expirado" && (!s.alvara_valido_ate || s.alvara_valido_ate >= today)) return false;
    if (filterSeguro === "valido" && (!s.seguro_valido_ate || s.seguro_valido_ate < today)) return false;
    if (filterSeguro === "expirado" && (!s.seguro_valido_ate || s.seguro_valido_ate >= today)) return false;
    return true;
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["subempreiteiros"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  return (
    <>
      <PageHeader
        title="Subempreiteiros"
        subtitle="Base de dados de fornecedores, especialidades e desempenho"
        actions={
          <div className="flex gap-2">
            <Dialog open={openImport} onOpenChange={setOpenImport}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-1.5" /> Importar Subempreiteiros
                </Button>
              </DialogTrigger>
              <ImportDialog onClose={() => { setOpenImport(false); invalidate(); }} />
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-1.5" /> Novo subempreiteiro
                </Button>
              </DialogTrigger>
              <NovoSubDialog onClose={() => { setOpen(false); invalidate(); }} />
            </Dialog>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por empresa, contacto, NIF, email, telefone, especialidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <FilterSelect label="Especialidade" value={filterEsp} onChange={setFilterEsp} options={ESPECIALIDADES} />
          <FilterSelect label="Distrito" value={filterDistrito} onChange={setFilterDistrito} options={distritos} />
          <FilterSelect label="Concelho" value={filterConcelho} onChange={setFilterConcelho} options={concelhos} />
          <FilterSelect
            label="Estado"
            value={filterEstado}
            onChange={setFilterEstado}
            staticOptions={[{ v: "ativo", l: "Ativo" }, { v: "inativo", l: "Inativo" }]}
          />
          <FilterSelect
            label="Classificação mínima"
            value={filterClass}
            onChange={setFilterClass}
            staticOptions={[1, 2, 3, 4, 5].map((n) => ({ v: String(n), l: `${n}★ ou mais` }))}
          />
          <FilterSelect
            label="Alvará"
            value={filterAlvara}
            onChange={setFilterAlvara}
            staticOptions={[{ v: "valido", l: "Válido" }, { v: "expirado", l: "Expirado/sem data" }]}
          />
          <FilterSelect
            label="Seguro"
            value={filterSeguro}
            onChange={setFilterSeguro}
            staticOptions={[{ v: "valido", l: "Válido" }, { v: "expirado", l: "Expirado/sem data" }]}
          />
        </div>

        <p className="text-xs text-muted-foreground">{filtered.length} de {subs.length} registos</p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">A carregar...</p>
        ) : filtered.length === 0 ? (
          <Card className="bg-card border-border p-16 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Sem subempreiteiros para mostrar.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => <SubCard key={s.id} s={s} today={today} />)}
          </div>
        )}
      </div>
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  staticOptions,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: readonly string[];
  staticOptions?: { v: string; l: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {options?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          {staticOptions?.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function SubCard({ s, today }: { s: Sub; today: string }) {
  const alvaraOk = s.alvara_valido_ate && s.alvara_valido_ate >= today;
  const seguroOk = s.seguro_valido_ate && s.seguro_valido_ate >= today;
  const emails = (s.emails?.length ? s.emails : [s.email]).filter(Boolean) as string[];
  const tels = (s.telefones?.length ? s.telefones : [s.telefone]).filter(Boolean) as string[];
  return (
    <Card className="bg-card border-border p-5 space-y-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{s.nome}</h3>
          {s.tipo && <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.tipo}</p>}
          {s.contacto_nome && <p className="text-xs text-muted-foreground">{s.contacto_nome}</p>}
        </div>
        {s.avaliacao != null && (
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`h-3 w-3 ${i < s.avaliacao! ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
            ))}
          </div>
        )}
      </div>
      {s.especialidades?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {s.especialidades.map((e) => (
            <span key={e} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">{e}</span>
          ))}
        </div>
      )}
      {(s.distrito || s.concelho || s.zonas?.length > 0) && (
        <p className="text-xs text-muted-foreground">
          📍 {[s.distrito, s.concelho].filter(Boolean).join(" / ")}
          {s.zonas?.length > 0 ? ` · ${s.zonas.join(", ")}` : ""}
        </p>
      )}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground pt-2 border-t border-border">
        {emails.map((e) => <span key={e} className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{e}</span>)}
        {tels.map((t) => <span key={t} className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{t}</span>)}
        {s.nif && <span className="text-[11px]">NIF: {s.nif}</span>}
      </div>
      {(s.alvara_valido_ate || s.seguro_valido_ate) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {s.alvara_valido_ate && (
            <span className={`text-[10px] px-2 py-0.5 rounded border ${alvaraOk ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
              Alvará: {s.alvara_valido_ate}
            </span>
          )}
          {s.seguro_valido_ate && (
            <span className={`text-[10px] px-2 py-0.5 rounded border ${seguroOk ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
              Seguro: {s.seguro_valido_ate}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------- Importer -------------------------------- */

type ImportRow = {
  nome: string;
  tipo: string | null;
  nif: string | null;
  especialidades: string[];
  zonas: string[];
  distrito: string | null;
  concelho: string | null;
  contacto_nome: string | null;
  email: string | null;
  emails: string[];
  telefone: string | null;
  telefones: string[];
};

type ImportReport = { criados: number; atualizados: number; duplicados: number; erros: { linha: number; motivo: string }[] };
type RawImportRow = { linha: number; values: Record<string, unknown> };

const HEADER_MAP: Record<string, keyof ImportRow | "skip"> = {
  tipo: "tipo",
  tipodeentidade: "tipo",
  categoria: "tipo",
  especialidade: "especialidades",
  especialidades: "especialidades",
  area: "especialidades",
  areas: "especialidades",
  atividade: "especialidades",
  atividades: "especialidades",
  empresa: "nome",
  empresas: "nome",
  nome: "nome",
  nomeempresa: "nome",
  empresanome: "nome",
  nomedaempresa: "nome",
  nomedempresa: "nome",
  fornecedor: "nome",
  fornecedores: "nome",
  subempreiteiro: "nome",
  subempreiteiros: "nome",
  entidade: "nome",
  razaosocial: "nome",
  designacao: "nome",
  designacaosocial: "nome",
  nomecomercial: "nome",
  nif: "nif",
  nifnipc: "nif",
  nipc: "nif",
  contribuinte: "nif",
  numerocontribuinte: "nif",
  contactosemail: "emails",
  contactoemail: "emails",
  emailcontacto: "emails",
  email: "emails",
  emails: "emails",
  mail: "emails",
  correioeletronico: "emails",
  contactospessoais: "contacto_nome",
  contactos: "contacto_nome",
  contacto: "contacto_nome",
  contactonome: "contacto_nome",
  nomecontacto: "contacto_nome",
  pessoacontacto: "contacto_nome",
  responsavel: "contacto_nome",
  ndetelemoveis: "telefones",
  ndetelemovel: "telefones",
  ntelemovel: "telefones",
  ntelemoveis: "telefones",
  numerotelemovel: "telefones",
  numerostelemoveis: "telefones",
  telemovel: "telefones",
  telemoveis: "telefones",
  telefone: "telefones",
  telefones: "telefones",
  tlm: "telefones",
  tel: "telefones",
  contactotelefonico: "telefones",
  distrito: "distrito",
  concelho: "concelho",
  municipio: "concelho",
  zona: "zonas",
  zonas: "zonas",
  zonadeatuacao: "zonas",
  zonasdeatuacao: "zonas",
  zonageografica: "zonas",
};

const DEFAULT_IMPORT_HEADERS = [
  "TIPO",
  "ESPECIALIDADE",
  "EMPRESA",
  "NIF",
  "CONTACTOS EMAIL",
  "CONTACTOS PESSOAIS",
  "Nº DE TELEMÓVEIS",
  "DISTRITO",
  "CONCELHO",
  "ZONA",
];

function detectHeaderRow(matrix: unknown[][]) {
  let best = { index: -1, headers: [] as string[], score: 0, hasName: false };

  matrix.slice(0, 60).forEach((row, index) => {
    const headers = row.map((cell) => String(cell ?? "").trim());
    const mapped = headers.map((h) => HEADER_MAP[normKey(h)]).filter(Boolean);
    const unique = new Set(mapped);
    const hasName = unique.has("nome");
    const score = unique.size + (hasName ? 4 : 0);
    if (score > best.score) best = { index, headers, score, hasName };
  });

  return best.hasName && best.score >= 5 ? best : null;
}

function buildRowsFromSheet(sheet: XLSX.WorkSheet): RawImportRow[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  }) as unknown[][];

  if (matrix.length === 0) return [];

  const detected = detectHeaderRow(matrix);
  const headerIndex = detected?.index ?? -1;
  const headers = detected?.headers.length ? detected.headers : DEFAULT_IMPORT_HEADERS;
  const dataRows = matrix.slice(headerIndex + 1);

  return dataRows
    .map((row, idx) => {
      const values: Record<string, unknown> = {};
      headers.forEach((header, colIndex) => {
        if (!header) return;
        values[header] = row[colIndex] ?? "";
      });
      return { linha: (headerIndex >= 0 ? headerIndex : 0) + idx + 2, values };
    })
    .filter(({ values }) => Object.values(values).some((v) => String(v ?? "").trim() !== ""));
}

function parseRow(raw: Record<string, unknown>, headers: string[]): ImportRow | null {
  const r: ImportRow = {
    nome: "",
    tipo: null,
    nif: null,
    especialidades: [],
    zonas: [],
    distrito: null,
    concelho: null,
    contacto_nome: null,
    email: null,
    emails: [],
    telefone: null,
    telefones: [],
  };
  for (const h of headers) {
    const key = HEADER_MAP[normKey(h)];
    if (!key || key === "skip") continue;
    const v = raw[h];
    if (v == null || String(v).trim() === "") continue;
    if (key === "especialidades" || key === "zonas" || key === "emails" || key === "telefones") {
      r[key] = splitMulti(v);
    } else {
      (r as any)[key] = String(v).trim();
    }
  }
  if (r.emails.length) r.email = r.emails[0];
  if (r.telefones.length) r.telefone = r.telefones[0];
  if (!r.nome) return null;
  return r;
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [filename, setFilename] = useState<string>("");

  const handleFile = async (file: File) => {
    setBusy(true);
    setReport(null);
    setFilename(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = buildRowsFromSheet(sheet);
      if (rows.length === 0) {
        toast.error("Ficheiro vazio");
        setBusy(false);
        return;
      }
      const headers = Object.keys(rows[0].values);

      const { data: existing } = await supabase
        .from("subempreiteiros")
        .select("id, nif, email");
      const byNif = new Map<string, string>();
      const byEmail = new Map<string, string>();
      for (const e of existing ?? []) {
        if (e.nif) byNif.set(String(e.nif).trim(), e.id);
        if (e.email) byEmail.set(String(e.email).trim().toLowerCase(), e.id);
      }
      const seenKeys = new Set<string>();

      const { data: { user } } = await supabase.auth.getUser();
      const rep: ImportReport = { criados: 0, atualizados: 0, duplicados: 0, erros: [] };

      for (let i = 0; i < rows.length; i++) {
        const parsed = parseRow(rows[i].values, headers);
        if (!parsed) {
          rep.erros.push({ linha: rows[i].linha, motivo: "Sem nome/empresa" });
          continue;
        }
        const keyNif = parsed.nif ? `nif:${parsed.nif}` : null;
        const keyEmail = parsed.email ? `email:${parsed.email.toLowerCase()}` : null;
        const dedupKey = keyNif ?? keyEmail ?? `nome:${parsed.nome.toLowerCase()}`;
        if (seenKeys.has(dedupKey)) {
          rep.duplicados++;
          continue;
        }
        seenKeys.add(dedupKey);

        const existingId =
          (parsed.nif && byNif.get(parsed.nif)) ||
          (parsed.email && byEmail.get(parsed.email.toLowerCase())) ||
          null;

        const payload: any = {
          nome: parsed.nome,
          tipo: parsed.tipo,
          nif: parsed.nif,
          especialidades: parsed.especialidades,
          zonas: parsed.zonas,
          distrito: parsed.distrito,
          concelho: parsed.concelho,
          contacto_nome: parsed.contacto_nome,
          email: parsed.email,
          emails: parsed.emails,
          telefone: parsed.telefone,
          telefones: parsed.telefones,
        };

        if (existingId) {
          const { error } = await supabase.from("subempreiteiros").update(payload).eq("id", existingId);
          if (error) rep.erros.push({ linha: rows[i].linha, motivo: error.message });
          else rep.atualizados++;
        } else {
          payload.created_by = user?.id ?? null;
          const { data, error } = await supabase
            .from("subempreiteiros")
            .insert(payload)
            .select("id")
            .single();
          if (error) {
            rep.erros.push({ linha: rows[i].linha, motivo: error.message });
          } else {
            rep.criados++;
            if (parsed.nif && data?.id) byNif.set(parsed.nif, data.id);
            if (parsed.email && data?.id) byEmail.set(parsed.email.toLowerCase(), data.id);
          }
        }
      }

      setReport(rep);
      toast.success(`Importação concluída: ${rep.criados} criados, ${rep.atualizados} atualizados`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao ler ficheiro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent className="bg-card border-border max-w-2xl">
      <DialogHeader>
        <DialogTitle>Importar subempreiteiros (.xlsx)</DialogTitle>
        <DialogDescription>
          Carrega um ficheiro Excel com as colunas: TIPO, ESPECIALIDADE, EMPRESA, NIF, CONTACTOS EMAIL,
          CONTACTOS PESSOAIS, Nº DE TELEMÓVEIS, DISTRITO, CONCELHO, ZONA. Múltiplos valores podem ser
          separados por vírgula, ponto e vírgula ou nova linha. Registos com NIF ou email já existentes
          são atualizados.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/40 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
        >
          <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm">{filename || "Arrasta o ficheiro ou clica para escolher"}</p>
          <p className="text-xs text-muted-foreground mt-1">Apenas .xlsx</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        {busy && <p className="text-sm text-muted-foreground">A processar...</p>}

        {report && (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-4 gap-2 text-center">
              <ReportTile label="Criados" value={report.criados} tone="ok" />
              <ReportTile label="Atualizados" value={report.atualizados} tone="info" />
              <ReportTile label="Duplicados" value={report.duplicados} tone="warn" />
              <ReportTile label="Erros" value={report.erros.length} tone="err" />
            </div>
            {report.erros.length > 0 && (
              <div className="max-h-40 overflow-auto rounded border border-border p-2 text-xs space-y-1">
                {report.erros.map((e, i) => (
                  <div key={i}><span className="text-muted-foreground">Linha {e.linha}:</span> {e.motivo}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Fechar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ReportTile({ label, value, tone }: { label: string; value: number; tone: "ok" | "info" | "warn" | "err" }) {
  const cls = {
    ok: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    info: "bg-primary/10 text-primary border-primary/30",
    warn: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    err: "bg-destructive/10 text-destructive border-destructive/30",
  }[tone];
  return (
    <div className={`rounded border p-3 ${cls}`}>
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider">{label}</div>
    </div>
  );
}

/* ------------------------------ Novo sub ------------------------------- */

function NovoSubDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    nome: "", tipo: "", nif: "", especialidades: "", zonas: "",
    distrito: "", concelho: "",
    contacto_nome: "", telefone: "", email: "",
    avaliacao: "", notas: "",
    alvara_valido_ate: "", seguro_valido_ate: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("subempreiteiros").insert({
      nome: form.nome,
      tipo: form.tipo || null,
      nif: form.nif || null,
      especialidades: splitMulti(form.especialidades),
      zonas: splitMulti(form.zonas),
      distrito: form.distrito || null,
      concelho: form.concelho || null,
      contacto_nome: form.contacto_nome || null,
      telefone: form.telefone || null,
      telefones: form.telefone ? [form.telefone] : [],
      email: form.email || null,
      emails: form.email ? [form.email] : [],
      avaliacao: form.avaliacao ? Number(form.avaliacao) : null,
      notas: form.notas || null,
      alvara_valido_ate: form.alvara_valido_ate || null,
      seguro_valido_ate: form.seguro_valido_ate || null,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Subempreiteiro adicionado");
    onClose();
  };

  return (
    <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Novo subempreiteiro</DialogTitle></DialogHeader>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2"><Label>Nome / Empresa *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
        <div className="space-y-2"><Label>Tipo</Label><Input placeholder="Empresa / Individual / Tarefeiro" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} /></div>
        <div className="space-y-2"><Label>NIF</Label><Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Especialidades (separadas por vírgula)</Label><Input placeholder="Eletricidade, Canalizações" value={form.especialidades} onChange={(e) => setForm({ ...form, especialidades: e.target.value })} /></div>
        <div className="space-y-2"><Label>Distrito</Label><Input value={form.distrito} onChange={(e) => setForm({ ...form, distrito: e.target.value })} /></div>
        <div className="space-y-2"><Label>Concelho</Label><Input value={form.concelho} onChange={(e) => setForm({ ...form, concelho: e.target.value })} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Zonas de atuação</Label><Input placeholder="Lisboa, Setúbal" value={form.zonas} onChange={(e) => setForm({ ...form, zonas: e.target.value })} /></div>
        <div className="space-y-2"><Label>Contacto</Label><Input value={form.contacto_nome} onChange={(e) => setForm({ ...form, contacto_nome: e.target.value })} /></div>
        <div className="space-y-2"><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="space-y-2"><Label>Alvará válido até</Label><Input type="date" value={form.alvara_valido_ate} onChange={(e) => setForm({ ...form, alvara_valido_ate: e.target.value })} /></div>
        <div className="space-y-2"><Label>Seguro válido até</Label><Input type="date" value={form.seguro_valido_ate} onChange={(e) => setForm({ ...form, seguro_valido_ate: e.target.value })} /></div>
        <div className="space-y-2"><Label>Avaliação (0–5)</Label><Input type="number" min={0} max={5} value={form.avaliacao} onChange={(e) => setForm({ ...form, avaliacao: e.target.value })} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Notas</Label><Textarea rows={3} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? "A guardar..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
