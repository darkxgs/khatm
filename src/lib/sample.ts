import type { DocData } from "@/components/doc/invoice-document";
import { documentTotals, qrAmount } from "./amounts";
import { BUSINESS, CUSTOMERS, PRODUCTS } from "./demo-data";
import type { Party } from "./types";
import { encodeQr } from "./zatca";

// One invoice from the demo, fixed in time, for the landing page: a packaging
// job for Habba Coffee Roasters, with a discounted consultation, paid a week
// after it was issued.

const product = (key: string) => PRODUCTS.find((p) => p.key === key)!;
const line = (key: string, qty: number, discountPct = 0) => {
  const p = product(key);
  return { nameAr: p.nameAr, nameEn: p.nameEn, unitAr: p.unitAr, unitEn: p.unitEn, qtyMilli: qty * 1000, unitPrice: p.price, discountBps: discountPct * 100, vat: p.vat };
};

const { key: _key, ...habba } = CUSTOMERS.find((c) => c.key === "habba")!;
void _key;

const seller: Party = { ...BUSINESS, country: "SA" };
const buyer: Party = {
  nameAr: habba.nameAr,
  nameEn: habba.nameEn,
  vatNumber: habba.vatNumber ?? null,
  crNumber: habba.crNumber ?? null,
  buildingNo: habba.buildingNo ?? null,
  streetAr: habba.streetAr ?? null,
  streetEn: habba.streetEn ?? null,
  districtAr: habba.districtAr ?? null,
  districtEn: habba.districtEn ?? null,
  cityAr: habba.cityAr ?? null,
  cityEn: habba.cityEn ?? null,
  postalCode: habba.postalCode ?? null,
  additionalNo: habba.additionalNo ?? null,
  country: habba.country,
  email: habba.email ?? null,
};

const lines = [line("packaging", 1), line("photo", 1), line("consult", 3, 10)];
const totals = documentTotals(lines);

export const SAMPLE_QR_FIELDS = {
  sellerName: BUSINESS.nameAr,
  vatNumber: BUSINESS.vatNumber,
  timestamp: "2026-09-14T08:12:40Z",
  total: qrAmount(totals.total),
  vat: qrAmount(totals.vat),
};

export const SAMPLE_QR = encodeQr(SAMPLE_QR_FIELDS);

export const SAMPLE_INVOICE: DocData = {
  kind: "tax",
  status: "issued",
  number: "INV-00007",
  issueDate: "2026-09-14",
  supplyDate: "2026-09-14",
  dueDate: "2026-09-28",
  seller,
  buyer,
  lines,
  qr: SAMPLE_QR,
  reference: null,
  reasonAr: null,
  reasonEn: null,
  notesAr: BUSINESS.notesAr,
  notesEn: BUSINESS.notesEn,
  seal: true,
  stamp: { kind: "paid", date: "2026-09-21", animate: true },
};
