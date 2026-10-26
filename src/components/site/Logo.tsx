import { Link } from "@tanstack/react-router";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * The brand logo: the gold emblem plus the "ALHASANMOTORS JAPAN" wordmark, both cut from the
 * official logo artwork (public/brand) so the lettering is exactly the logo's.
 * tone "light" = for dark backgrounds (white lettering); "dark" = for light backgrounds.
 * layout "row" sits side by side (top bars); "stacked" puts the wordmark under the emblem.
 */
export function Logo({ tone = "dark", layout = "row", size = "md", className }: {
  tone?: "dark" | "light";
  layout?: "row" | "stacked";
  size?: "md" | "lg";
  className?: string;
}) {
  const wordmark = tone === "light" ? "/brand/wordmark-light.png" : "/brand/wordmark-dark.png";
  const stacked = layout === "stacked";
  return (
    <Link to="/" className={cn("group inline-flex shrink-0", stacked ? "flex-col items-center gap-3" : "items-center gap-1.5 sm:gap-2.5", className)} aria-label={`${site.name} — home`}>
      <img
        src="/brand/emblem.png"
        alt=""
        width={366}
        height={240}
        className={cn("w-auto select-none", stacked ? (size === "lg" ? "h-24" : "h-14") : "h-8 sm:h-10")}
        draggable={false}
      />
      <img
        src={wordmark}
        alt={site.name}
        width={900}
        height={50}
        className={cn("w-auto select-none", stacked ? (size === "lg" ? "h-[17px]" : "h-[11px]") : "h-[9px] sm:h-[13px]")}
        draggable={false}
      />
    </Link>
  );
}
