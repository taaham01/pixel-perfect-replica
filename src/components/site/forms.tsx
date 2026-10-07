import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { countries } from "@/config/site";
import { bodyTypes, fuels, makes, transmissions } from "@/data/vehicles";
import { submitForm, type FormKind } from "@/lib/inquiries";
import { cn } from "@/lib/utils";
import { btn } from "./primitives";
import { fieldCls } from "./vehicles";

type Field =
  | { name: string; label: string; type?: "text" | "email" | "tel" | "number"; required?: boolean; placeholder?: string; full?: boolean; defaultValue?: string }
  | { name: string; label: string; type: "select"; options: string[]; required?: boolean; full?: boolean }
  | { name: string; label: string; type: "textarea"; required?: boolean; placeholder?: string; full?: boolean };

function FormBuilder({ kind, fields, submitLabel, cols = 2, tone = "light" }: { kind: FormKind; fields: Field[]; submitLabel: string; cols?: 1 | 2; tone?: "light" | "card" }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setState("loading");
    try {
      await submitForm(kind, data);
      setState("done");
      toast.success("Thank you — our team will contact you shortly.");
      form.reset();
      setTimeout(() => setState("idle"), 4000);
    } catch {
      setState("idle");
      toast.error("Something went wrong. Please try again or contact us on WhatsApp.");
    }
  }
  return (
    <form onSubmit={onSubmit} className={cn("grid gap-4", cols === 2 && "sm:grid-cols-2", tone === "card" && "")}>
      {fields.map((f) => (
        <label key={f.name} className={cn("block", (f.full || f.type === "textarea" || cols === 1) && "sm:col-span-2")}>
          <span className="eyebrow mb-2 block text-muted-foreground">{f.label}{f.required && <span className="text-crimson"> *</span>}</span>
          {f.type === "select" ? (
            <select name={f.name} required={f.required} className={fieldCls} defaultValue="">
              <option value="" disabled={f.required}>Select…</option>
              {f.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : f.type === "textarea" ? (
            <textarea name={f.name} required={f.required} placeholder={f.placeholder} rows={4} maxLength={2000} className={cn(fieldCls, "h-auto py-3")} />
          ) : (
            <input name={f.name} type={f.type ?? "text"} required={f.required} placeholder={f.placeholder} defaultValue={f.defaultValue} maxLength={200} className={fieldCls} />
          )}
        </label>
      ))}
      <div className="sm:col-span-2">
        <button type="submit" disabled={state === "loading"} className={cn(btn({ variant: "primary", size: "lg" }), "w-full sm:w-auto")}>
          {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "done" ? <Check className="h-4 w-4" /> : null}
          {state === "done" ? "Sent" : submitLabel}
        </button>
      </div>
    </form>
  );
}

const yearOpts = Array.from({ length: 20 }, (_, i) => String(new Date().getFullYear() - i));

export function InquiryForm({ stockId, vehicle }: { stockId?: string; vehicle?: string }) {
  return (
    <FormBuilder kind="vehicle-inquiry" cols={1} submitLabel="Request This Vehicle" fields={[
      { name: "name", label: "Name", required: true },
      { name: "country", label: "Country", type: "select", options: countries, required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "whatsapp", label: "WhatsApp", type: "tel", placeholder: "+254 …" },
      { name: "stockId", label: "Vehicle / Stock ID", defaultValue: stockId ? `${vehicle} — ${stockId}` : "" },
      { name: "message", label: "Message", type: "textarea", placeholder: "Destination port, questions…" },
    ]} />
  );
}

export function VehicleRequestForm() {
  return (
    <FormBuilder kind="vehicle-request" submitLabel="Submit Vehicle Request" fields={[
      { name: "name", label: "Name", required: true },
      { name: "country", label: "Country", type: "select", options: countries, required: true },
      { name: "whatsapp", label: "WhatsApp", type: "tel", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "make", label: "Preferred Make", type: "select", options: [...makes, "Nissan", "Mitsubishi", "Subaru", "Suzuki", "Lexus", "Isuzu", "Other"] },
      { name: "model", label: "Preferred Model", placeholder: "e.g. Prado, X-Trail" },
      { name: "minYear", label: "Minimum Year", type: "select", options: yearOpts },
      { name: "budget", label: "Maximum Budget (USD)", type: "number", placeholder: "25000" },
      { name: "maxMileage", label: "Maximum Mileage (km)", type: "number", placeholder: "80000" },
      { name: "transmission", label: "Transmission", type: "select", options: [...transmissions, "Any"] },
      { name: "fuel", label: "Fuel", type: "select", options: [...fuels, "Any"] },
      { name: "color", label: "Color", placeholder: "Any" },
      { name: "quantity", label: "Quantity", type: "number", placeholder: "1" },
      { name: "body", label: "Body Type", type: "select", options: bodyTypes },
      { name: "requirements", label: "Additional Requirements", type: "textarea", placeholder: "Grade, options, destination port, timeline…" },
    ]} />
  );
}

export function DealerForm() {
  return (
    <FormBuilder kind="dealer" submitLabel="Become a Dealer Partner" fields={[
      { name: "company", label: "Company Name", required: true },
      { name: "name", label: "Contact Person", required: true },
      { name: "country", label: "Country", type: "select", options: countries, required: true },
      { name: "whatsapp", label: "WhatsApp", type: "tel", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "volume", label: "Estimated Monthly Volume", type: "select", options: ["1–5 units", "6–20 units", "21–50 units", "50+ units"] },
      { name: "message", label: "Vehicles you typically source", type: "textarea" },
    ]} />
  );
}

export function ContactForm() {
  return (
    <FormBuilder kind="contact" submitLabel="Send Inquiry" fields={[
      { name: "name", label: "Name", required: true },
      { name: "country", label: "Country", type: "select", options: countries, required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "whatsapp", label: "WhatsApp", type: "tel" },
      { name: "subject", label: "Subject", required: true, full: true },
      { name: "message", label: "Message", type: "textarea", required: true },
    ]} />
  );
}
