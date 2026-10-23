import { sar } from "./amounts";
import type { Lang } from "./types";

/** "SAR 1,250.00" / "1,250.00 ر.س" */
export const money = (minor: number, lang: Lang) => (lang === "ar" ? `${sar(minor)} ر.س` : `SAR ${sar(minor)}`);

/** Axis labels: "20k" / "20 ألف". */
export function compactSar(minor: number, lang: Lang) {
  const r = minor / 100;
  if (r === 0) return "0";
  if (r >= 1_000_000) return lang === "ar" ? `${+(r / 1_000_000).toFixed(1)} مليون` : `${+(r / 1_000_000).toFixed(1)}m`;
  if (r >= 1000) return lang === "ar" ? `${+(r / 1000).toFixed(1)} ألف` : `${+(r / 1000).toFixed(1)}k`;
  return String(Math.round(r));
}
