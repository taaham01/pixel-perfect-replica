import { XCircle } from "lucide-react";
import { messageBox } from "@/components/site/ConfirmDialog";

/**
 * Every message the website shows goes through the site's own message box.
 * Same calls as before: toast.success("Saved"), toast.error("Something failed").
 *  - success / info: closes by itself after a few seconds (or on OK)
 *  - error / warning: stays until the person clicks OK
 */
const SUCCESS_MS = 3500;
const INFO_MS = 5000;

type Opts = { description?: string; title?: string };

function show(tone: "success" | "danger" | "warning" | "info", fallbackTitle: string, raw: string, opts?: Opts) {
  const message = String(raw ?? "").trim() || fallbackTitle;
  // A short message becomes the title; a longer one is shown under a short heading.
  const short = message.length <= 60 && !opts?.description;
  void messageBox({
    tone,
    icon: tone === "danger" ? XCircle : undefined,
    title: opts?.title ?? (short ? message : fallbackTitle),
    description: opts?.description ?? (short ? undefined : message),
    autoCloseMs: tone === "success" ? SUCCESS_MS : tone === "info" ? INFO_MS : undefined,
  });
}

export const toast = {
  success: (message: string, opts?: Opts) => show("success", "Done", message, opts),
  error: (message: string, opts?: Opts) => show("danger", "Something went wrong", message, opts),
  warning: (message: string, opts?: Opts) => show("warning", "Please note", message, opts),
  info: (message: string, opts?: Opts) => show("info", "For your information", message, opts),
};
