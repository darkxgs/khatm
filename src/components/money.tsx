import { sar } from "@/lib/amounts";
import type { Lang } from "@/lib/types";
import { cn } from "./ui";

/**
 * An amount with its currency: "SAR 1,250.00" / "1,250.00 ر.س". The figure is
 * isolated left-to-right, so a minus sign stays in front of it in Arabic too.
 */
export function Money({ value, lang, sign, className }: { value: number; lang: Lang; sign?: "−" | "+"; className?: string }) {
  const num = `${sign ?? (value < 0 ? "−" : "")}${sar(Math.abs(value))}`;
  return lang === "ar" ? (
    <span className={cn("tnum whitespace-nowrap", className)}>
      <bdi dir="ltr">{num}</bdi> ر.س
    </span>
  ) : (
    <span className={cn("tnum whitespace-nowrap", className)}>SAR {num}</span>
  );
}
