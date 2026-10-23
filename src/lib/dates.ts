import type { Lang } from "./types";

// Document dates are calendar days ("2026-10-23"), not instants: an invoice
// issued at 1 a.m. in Riyadh is dated that day, whatever UTC says.

export const todayIn = (tz: string, at: Date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(at);

const asUtc = (day: string) => new Date(`${day}T00:00:00Z`);

export function addDays(day: string, n: number): string {
  const d = asUtc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (positive when b is later). */
export const daysBetween = (a: string, b: string) => Math.round((asUtc(b).getTime() - asUtc(a).getTime()) / 86_400_000);

/** "23 Oct 2026" / "23 أكتوبر 2026": Gregorian, Latin digits, in both languages. */
export function formatDay(day: string, lang: Lang, month: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month, year: "numeric", timeZone: "UTC" }).format(asUtc(day));
}

/** The same day in the Umm al-Qura calendar, as Saudi documents often add: "2 جمادى الأولى 1448 هـ". */
export function hijriDay(day: string): string {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(asUtc(day));
}

export const monthKey = (day: string) => day.slice(0, 7);

export function monthLabel(key: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { month: "short", timeZone: "UTC" }).format(asUtc(`${key}-01`));
}

/** The calendar quarter a day falls in, and its first and last days. */
export function quarterOf(day: string) {
  const y = Number(day.slice(0, 4));
  const q = Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1;
  const start = `${y}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
  const end = addDays(q === 4 ? `${y + 1}-01-01` : `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`, -1);
  return { year: y, quarter: q, start, end };
}
