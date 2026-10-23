import { VAT_RATES, type VatCategory } from "./zatca";

// Money is integers in halalas; quantities are integers in thousandths
// (1.5 hours = 1500), so nothing here touches floating-point cents.

export type LineInput = { qtyMilli: number; unitPrice: number; discountBps: number; vat: VatCategory };
export type LineAmounts = { gross: number; discount: number; net: number; vatBps: number; vat: number; total: number };

const pct = (minor: number, bps: number) => Math.round((minor * bps) / 10_000);

export function lineAmounts(l: LineInput): LineAmounts {
  const gross = Math.round((l.qtyMilli * l.unitPrice) / 1000);
  const discount = pct(gross, l.discountBps);
  const net = gross - discount;
  const vatBps = VAT_RATES[l.vat];
  const vat = pct(net, vatBps);
  return { gross, discount, net, vatBps, vat, total: net + vat };
}

export type Breakdown = { category: VatCategory; vatBps: number; taxable: number; vat: number };
export type Totals = { gross: number; discount: number; taxable: number; vat: number; total: number; breakdown: Breakdown[] };

/**
 * Document totals. VAT is worked out per category on the summed taxable
 * amounts, then rounded once, as ZATCA's rules do; a line's own VAT is for
 * display and can differ from the document's by a halala.
 */
export function documentTotals(lines: LineInput[]): Totals {
  const byCat = new Map<VatCategory, number>();
  let gross = 0;
  let discount = 0;
  for (const l of lines) {
    const a = lineAmounts(l);
    gross += a.gross;
    discount += a.discount;
    byCat.set(l.vat, (byCat.get(l.vat) ?? 0) + a.net);
  }
  const order: VatCategory[] = ["S", "Z", "E", "O"];
  const breakdown = order
    .filter((c) => byCat.has(c))
    .map((category) => {
      const taxable = byCat.get(category)!;
      const vatBps = VAT_RATES[category];
      return { category, vatBps, taxable, vat: pct(taxable, vatBps) };
    });
  const taxable = breakdown.reduce((s, b) => s + b.taxable, 0);
  const vat = breakdown.reduce((s, b) => s + b.vat, 0);
  return { gross, discount, taxable, vat, total: taxable + vat, breakdown };
}

/** "1,250.00": invoices always show two decimals. */
export const sar = (minor: number) => (minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The QR code's amount format: no grouping, two decimals ("1250.00"). */
export const qrAmount = (minor: number) => (minor / 100).toFixed(2);

/** Reads a typed amount ("1,250.5", "١٢٥٠٫٥") into halalas; null if it isn't one. */
export function parseSar(text: string): number | null {
  const clean = text
    .replace(/[,\s]/g, "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace("٫", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [w, f = ""] = clean.split(".");
  return Number(w) * 100 + Number(f.padEnd(2, "0"));
}

/** Reads a typed quantity ("1.5", "2") into thousandths. */
export function parseQty(text: string): number | null {
  const clean = text
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace("٫", ".")
    .trim();
  if (!/^\d+(\.\d{1,3})?$/.test(clean)) return null;
  const [w, f = ""] = clean.split(".");
  const v = Number(w) * 1000 + Number(f.padEnd(3, "0"));
  return v > 0 ? v : null;
}

export const qtyText = (milli: number) => (milli / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 });

/** Reads a typed percentage ("10", "12.5") into basis points; null if it isn't 0–100. */
export function parsePercent(text: string): number | null {
  const clean = text
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace("٫", ".")
    .replace(/[%٪\s]/g, "");
  if (clean === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const bps = Math.round(Number(clean) * 100);
  return bps <= 10_000 ? bps : null;
}

/** 1250 basis points as "12.5". */
export const percentText = (bps: number) => (bps ? String(bps / 100) : "");
