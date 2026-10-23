import type { Lang } from "./types";

/** Arabic counting: one and two have their own words, 3 to 10 take the plural, 11 and up the singular. */
export function arCount(n: number, f: { one: string; two: string; few: string; many: string }): string {
  if (n === 1) return f.one;
  if (n === 2) return f.two;
  if (n >= 3 && n <= 10) return `${n} ${f.few}`;
  return `${n} ${f.many}`;
}

/** "9:14 pm" / "9:14 م", in the business's time zone. Latin digits in both languages. */
export function clockTime(iso: string | Date, lang: Lang, timeZone: string): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { hour: "numeric", minute: "2-digit", hour12: lang === "ar", timeZone }).format(
    typeof iso === "string" ? new Date(iso) : iso,
  );
}
