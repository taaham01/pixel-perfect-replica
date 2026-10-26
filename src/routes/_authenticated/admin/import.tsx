import { useMemo, useState, type ChangeEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, FileUp, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { dbErrorMessage, guessField, validateVehicle, vehicleFields } from "@/components/admin/fields";
import { btn } from "@/components/site/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/import")({
  head: () => ({ meta: [{ title: "CSV import — Admin" }, { name: "robots", content: "noindex" }] }),
  component: CsvImport,
});

const MAX_ROWS = 500;

/** Small CSV parser: commas or semicolons, quoted values, line breaks inside quotes. */
function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const TEMPLATE_HEADERS = ["Stock ID", "Make", "Model", "Variant / Grade", "Model year", "Mileage", "Price", "Currency", "Engine capacity (cc)", "Transmission", "Fuel type", "Body type", "Drivetrain", "Exterior colour", "Interior colour", "Chassis number", "Auction grade", "Country / location", "Description"];
const TEMPLATE_ROW = ["AH1001", "Toyota", "Prius", "S Touring", "2019", "54000", "11800", "USD", "1797", "CVT", "Hybrid", "Hatchback", "2WD", "White Pearl", "Black", "ZVW51-1234567", "4.5", "Yokohama, Japan", "One owner, full service history"];

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS, TEMPLATE_ROW].map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  Object.assign(document.createElement("a"), { href: url, download: "vehicle-import-template.csv" }).click();
  URL.revokeObjectURL(url);
}

type Result = { row: number; stock: string; ok: boolean; message: string };

function CsvImport() {
  const admin = useAdmin();
  const qc = useQueryClient();
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<string[]>([]); // field key per column, "" = ignore
  const [publish, setPublish] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[] | null>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("That file is larger than 5 MB."); return; }
    const rows = parseCsv(await file.text());
    if (rows.length < 2) { toast.error("The file needs a header row and at least one vehicle."); return; }
    const [head, ...body] = rows;
    if (body.length > MAX_ROWS) toast.warning(`Only the first ${MAX_ROWS} rows will be imported.`);
    setFileName(file.name);
    setHeaders(head!.map((h) => h.trim()));
    setData(body.slice(0, MAX_ROWS));
    const used = new Set<string>();
    setMapping(head!.map((h) => { const k = guessField(h); if (!k || used.has(k)) return ""; used.add(k); return k; }));
    setResults(null);
  }

  // Validate every row with the same rules as the vehicle editor.
  const checked = useMemo(() => data.map((cells) => {
    const raw: Record<string, string> = {};
    mapping.forEach((key, i) => { if (key) raw[key] = cells[i] ?? ""; });
    if (!raw.currency?.trim()) raw.currency = "USD"; // most stock is priced in US dollars
    return validateVehicle(raw);
  }), [data, mapping]);
  const validCount = checked.filter((c) => Object.keys(c.errors).length === 0).length;
  const missingRequired = vehicleFields.filter((f) => f.required && f.key !== "currency" && !mapping.includes(f.key)).map((f) => f.label);

  async function runImport() {
    setImporting(true); setProgress(0);
    const out: Result[] = [];
    for (let i = 0; i < checked.length; i++) {
      const { value, errors } = checked[i]!;
      const stock = String(value.stock_id ?? data[i]?.[mapping.indexOf("stock_id")] ?? `row ${i + 2}`);
      const errs = Object.values(errors);
      if (errs.length) { out.push({ row: i + 2, stock, ok: false, message: errs.join("; ") }); }
      else {
        const { error } = await supabase.from("vehicles").insert({ ...value, currency: value.currency ?? "USD", publish_state: publish ? "published" : "draft" });
        out.push({ row: i + 2, stock, ok: !error, message: error ? dbErrorMessage(error) : publish ? "Added and published" : "Added as draft" });
      }
      setProgress(Math.round(((i + 1) / checked.length) * 100));
    }
    setResults(out);
    setImporting(false);
    void qc.invalidateQueries();
    const added = out.filter((r) => r.ok).length;
    toast[added ? "success" : "error"](`${added} of ${out.length} vehicles imported.`);
  }

  function reset() { setFileName(""); setHeaders([]); setData([]); setMapping([]); setResults(null); }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-crimson">Inventory</p>
          <h1 className="mt-1 text-3xl font-bold">CSV import</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Add many vehicles at once from a spreadsheet (Excel: <em>File → Save as → CSV</em>). Photos are added afterwards on each vehicle's page.</p>
        </div>
        <button onClick={downloadTemplate} className={btn({ variant: "outline", size: "sm" })}><Download className="h-4 w-4" /> Download template</button>
      </div>

      {!headers.length && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed border-border bg-card p-12 text-center hover:border-crimson/50">
          <FileUp className="h-8 w-8 text-crimson" />
          <span className="font-semibold">Choose a CSV file</span>
          <span className="text-sm text-muted-foreground">Required columns: Stock ID, Make, Model, Year, Mileage, Price. Up to {MAX_ROWS} vehicles per file.</span>
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
        </label>
      )}

      {headers.length > 0 && !results && (
        <>
          <section className="rounded-sm border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold">1. Match your columns <span className="font-normal text-muted-foreground">— {fileName}, {data.length} vehicles</span></h2>
              <button onClick={reset} className={btn({ variant: "link", size: "sm" })}>Choose another file</button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {headers.map((h, i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-36 shrink-0 truncate font-medium" title={h}>{h || `Column ${i + 1}`}</span>
                  <span className="text-muted-foreground">→</span>
                  <select value={mapping[i] ?? ""} onChange={(e) => setMapping((m) => m.map((v, j) => (j === i ? e.target.value : v === e.target.value && e.target.value ? "" : v)))}
                    className={cn("min-w-0 flex-1 rounded-sm border bg-background px-2 py-1", mapping[i] ? "border-border" : "border-dashed border-border text-muted-foreground")}>
                    <option value="">Don't import</option>
                    {vehicleFields.map((f) => <option key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {missingRequired.length > 0 && <p className="mt-4 rounded-sm bg-crimson/10 p-3 text-sm text-crimson">Still need a column for: {missingRequired.join(", ")}.</p>}
          </section>

          <section className="rounded-sm border border-border bg-card p-5">
            <h2 className="font-bold">2. Check the vehicles <span className="font-normal text-muted-foreground">— {validCount} ready, {checked.length - validCount} with problems</span></h2>
            <div className="mt-4 max-h-96 overflow-auto rounded-sm border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-secondary text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="p-2">Row</th><th className="p-2">Stock ID</th><th className="p-2">Vehicle</th><th className="p-2">Price</th><th className="p-2">Check</th></tr>
                </thead>
                <tbody>
                  {checked.map(({ value, errors }, i) => {
                    const errs = Object.values(errors);
                    return (
                      <tr key={i} className="border-t border-border align-top">
                        <td className="p-2 text-muted-foreground">{i + 2}</td>
                        <td className="p-2 font-mono text-xs">{String(value.stock_id ?? "—")}</td>
                        <td className="p-2">{[value.year, value.make, value.model, value.variant].filter(Boolean).join(" ") || "—"}</td>
                        <td className="p-2">{value.price != null ? `${value.price} ${value.currency ?? "USD"}` : "—"}</td>
                        <td className="p-2">{errs.length ? <span className="text-crimson">{errs.join("; ")}</span> : <span className="text-emerald-700">Ready</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-border bg-card p-5">
            <label className={cn("flex items-center gap-2 text-sm", !admin.perms.publish && "opacity-50")}>
              <input type="checkbox" checked={publish} disabled={!admin.perms.publish} onChange={(e) => setPublish(e.target.checked)} />
              Publish straight away {admin.perms.publish ? "(otherwise they're saved as drafts for you to add photos first)" : "(you don't have permission to publish — they'll be saved as drafts)"}
            </label>
            <button onClick={runImport} disabled={importing || validCount === 0 || missingRequired.length > 0} className={btn({ variant: "primary" })}>
              {importing ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing… {progress}%</> : <>Import {validCount} vehicle{validCount === 1 ? "" : "s"}</>}
            </button>
          </section>
        </>
      )}

      {results && (
        <section className="rounded-sm border border-border bg-card p-5">
          <h2 className="font-bold">Import finished — {results.filter((r) => r.ok).length} added, {results.filter((r) => !r.ok).length} skipped</h2>
          <ul className="mt-4 max-h-96 divide-y divide-border overflow-auto rounded-sm border border-border text-sm">
            {results.map((r) => (
              <li key={r.row} className="flex items-start gap-2 p-2">
                {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />}
                <span className="w-16 shrink-0 text-muted-foreground">Row {r.row}</span>
                <span className="w-28 shrink-0 font-mono text-xs">{r.stock}</span>
                <span className={r.ok ? "" : "text-crimson"}>{r.message}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/admin/vehicles" className={btn({ variant: "primary", size: "sm" })}>Go to inventory</Link>
            <button onClick={reset} className={btn({ variant: "outline", size: "sm" })}>Import another file</button>
          </div>
        </section>
      )}
    </div>
  );
}
