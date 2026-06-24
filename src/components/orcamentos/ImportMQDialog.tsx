import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readXlsx, detectColumns, parseRows, type ColumnMap, type ParsedRow } from "@/lib/mq-parser";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  onImport: (rows: ParsedRow[]) => Promise<void>;
};

export function ImportMQDialog({ open, onClose, onImport }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheetData, setSheetData] = useState<Record<string, any[][]>>({});
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [headerRow, setHeaderRow] = useState(0);
  const [map, setMap] = useState<ColumnMap>({ codigo: null, descricao: 0, unidade: null, quantidade: null, preco: null });
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setStep(1); setFile(null); setSheets([]); setSheetData({}); setActiveSheet("");
    setHeaderRow(0); setParsed([]);
  };

  const handleFile = async (f: File) => {
    setFile(f);
    try {
      const { sheets, data } = await readXlsx(f);
      setSheets(sheets);
      setSheetData(data);
      const first = sheets[0];
      setActiveSheet(first);
      const det = detectColumns(data[first]);
      if (det) { setHeaderRow(det.headerRowIdx); setMap(det.map); }
      setStep(2);
    } catch (e: any) {
      toast.error("Erro a ler o ficheiro: " + e.message);
    }
  };

  const onSheetChange = (s: string) => {
    setActiveSheet(s);
    const det = detectColumns(sheetData[s]);
    if (det) { setHeaderRow(det.headerRowIdx); setMap(det.map); }
  };

  const preview = () => {
    const rows = parseRows(sheetData[activeSheet] ?? [], headerRow, map);
    setParsed(rows);
    setStep(3);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      await onImport(parsed);
      toast.success(`${parsed.filter(r => !r.isCapitulo).length} artigos importados`);
      reset(); onClose();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally { setImporting(false); }
  };

  const previewRows = (sheetData[activeSheet] ?? []).slice(headerRow, headerRow + 8);
  const numCols = Math.max(0, ...previewRows.map(r => r?.length ?? 0));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="bg-card border-border max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Mapa de Quantidades (.xlsx)
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <label className="block border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-colors">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Escolhe um ficheiro Excel</p>
            <p className="text-xs text-muted-foreground mt-1">Suportado: .xlsx, .xls</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ficheiro: <span className="text-foreground font-medium">{file?.name}</span>
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Folha</Label>
                <Select value={activeSheet} onValueChange={onSheetChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Linha do cabeçalho</Label>
                <Select value={String(headerRow)} onValueChange={(v) => setHeaderRow(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: Math.min(30, (sheetData[activeSheet]?.length ?? 0)) }).map((_, i) =>
                      <SelectItem key={i} value={String(i)}>Linha {i + 1}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Mapeamento de colunas</Label>
              <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {(["codigo", "descricao", "unidade", "quantidade", "preco"] as const).map((k) => (
                  <div key={k} className="space-y-1">
                    <span className="text-xs text-muted-foreground capitalize">{k === "preco" ? "Preço unit." : k}</span>
                    <Select
                      value={map[k] == null ? "none" : String(map[k])}
                      onValueChange={(v) => setMap({ ...map, [k]: v === "none" ? null : Number(v) })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {k !== "descricao" && <SelectItem value="none">— (sem coluna)</SelectItem>}
                        {Array.from({ length: numCols }).map((_, i) => (
                          <SelectItem key={i} value={String(i)}>Col {String.fromCharCode(65 + i)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-border rounded-md overflow-auto max-h-64">
              <table className="text-xs w-full">
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className={ri === 0 ? "bg-muted font-medium" : "border-t border-border"}>
                      {Array.from({ length: numCols }).map((_, ci) => (
                        <td key={ci} className="px-2 py-1 max-w-[200px] truncate">{row?.[ci] != null ? String(row[ci]) : ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={preview} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Pré-visualizar
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
              Detectados <strong>{parsed.filter(r => !r.isCapitulo).length}</strong> artigos
              e <strong>{parsed.filter(r => r.isCapitulo).length}</strong> capítulos.
            </div>
            <div className="border border-border rounded-md overflow-auto max-h-80">
              <table className="text-xs w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5">Código</th>
                    <th className="text-left px-2 py-1.5">Descrição</th>
                    <th className="text-left px-2 py-1.5">Un.</th>
                    <th className="text-right px-2 py-1.5">Qtd.</th>
                    <th className="text-right px-2 py-1.5">P. Unit.</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 200).map((r, i) => (
                    <tr key={i} className={`border-t border-border ${r.isCapitulo ? "bg-primary/5 font-semibold" : ""}`}>
                      <td className="px-2 py-1 font-mono">{r.codigo}</td>
                      <td className="px-2 py-1">{r.descricao}</td>
                      <td className="px-2 py-1">{r.unidade}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.quantidade || ""}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.preco_unitario || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 200 && <p className="px-2 py-1 text-[10px] text-muted-foreground">... e mais {parsed.length - 200} linhas</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={handleImport} disabled={importing} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {importing ? "A importar..." : "Importar para orçamento"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
