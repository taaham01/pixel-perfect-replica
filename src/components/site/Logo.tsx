import { Link } from "@tanstack/react-router";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <Link to="/" className="group flex items-center gap-3" aria-label={site.name}>
      <span className="relative grid h-9 w-9 place-items-center rounded-sm bg-crimson text-primary-foreground">
        <span className="text-sm font-extrabold">AH</span>
        <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-champagne" />
      </span>
      <span className="flex flex-col leading-none">
        <span className={cn("text-[0.95rem] font-extrabold tracking-[0.08em]", tone === "light" ? "text-ink-foreground" : "text-foreground")}>{site.shortName}</span>
        <span className={cn("mt-1 font-mono text-[0.6rem] tracking-[0.32em]", tone === "light" ? "text-ink-muted" : "text-muted-foreground")}>{site.subName}</span>
      </span>
    </Link>
  );
}
