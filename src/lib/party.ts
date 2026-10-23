import type { Party } from "./types";

// How a party (the seller or the buyer) is written on a document, once in each
// language. A field missing in one language falls back to the other, so a
// customer saved only in Arabic still has a complete English column.

const COUNTRY_EN: Record<string, string> = {
  SA: "Saudi Arabia",
  AE: "United Arab Emirates",
  BH: "Bahrain",
  KW: "Kuwait",
  OM: "Oman",
  QA: "Qatar",
  EG: "Egypt",
  JO: "Jordan",
  GB: "United Kingdom",
  US: "United States",
};
const COUNTRY_AR: Record<string, string> = {
  SA: "المملكة العربية السعودية",
  AE: "الإمارات العربية المتحدة",
  BH: "البحرين",
  KW: "الكويت",
  OM: "عُمان",
  QA: "قطر",
  EG: "مصر",
  JO: "الأردن",
  GB: "المملكة المتحدة",
  US: "الولايات المتحدة",
};

const pick = (a: string | null | undefined, b: string | null | undefined) => (a && a.trim()) || (b && b.trim()) || "";
const join = (parts: (string | null | undefined)[], sep: string) => parts.filter((p) => p && p.trim()).join(sep);

export function nameIn(p: Pick<Party, "nameAr" | "nameEn">, lang: "ar" | "en") {
  return lang === "ar" ? pick(p.nameAr, p.nameEn) : pick(p.nameEn, p.nameAr);
}

/** Address lines in English: street, district, city and postcode, additional number, country. */
export function addressEn(p: Party): string[] {
  const country = p.country && p.country !== "SA" ? (COUNTRY_EN[p.country] ?? p.country) : null;
  return [
    join([p.buildingNo, pick(p.streetEn, p.streetAr)], " "),
    pick(p.districtEn, p.districtAr),
    join([pick(p.cityEn, p.cityAr), p.postalCode], " "),
    p.additionalNo ? `Additional no. ${p.additionalNo}` : "",
    country ?? "",
  ].filter(Boolean);
}

export function addressAr(p: Party): string[] {
  const country = p.country && p.country !== "SA" ? (COUNTRY_AR[p.country] ?? p.country) : null;
  return [
    join([p.buildingNo, pick(p.streetAr, p.streetEn)], " "),
    pick(p.districtAr, p.districtEn),
    join([pick(p.cityAr, p.cityEn), p.postalCode], " "),
    p.additionalNo ? `الرقم الإضافي ${p.additionalNo}` : "",
    country ?? "",
  ].filter(Boolean);
}

export const countryName = (code: string, lang: "ar" | "en") => (lang === "ar" ? COUNTRY_AR : COUNTRY_EN)[code] ?? code;
