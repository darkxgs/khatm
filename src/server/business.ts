import "server-only";
import { and, eq, sql } from "drizzle-orm";
import * as s from "@/db/schema";
import { rowsOf, type Q } from "@/db/tx";
import { newId } from "@/lib/id";
import { isCrNumber, isSaudiIban, isVatNumber, VAT_RATES, type VatCategory } from "@/lib/zatca";

// The business's own details, its customers and its catalogue. Validation
// returns a code per field; the forms turn codes into sentences.

export type FieldErrors = Record<string, string>;
export type FormResult = { ok: true; id: string } | { ok: false; errors: FieldErrors };

const t = (v: unknown, max = 200) => {
  const x = typeof v === "string" ? v.trim().slice(0, max) : "";
  return x || null;
};
const digits = (v: string | null) => (v ? v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\s+/g, "") : null);

type AddressIn = {
  buildingNo?: string | null;
  streetAr?: string | null;
  streetEn?: string | null;
  districtAr?: string | null;
  districtEn?: string | null;
  cityAr?: string | null;
  cityEn?: string | null;
  postalCode?: string | null;
  additionalNo?: string | null;
};

/** A Saudi national address: four-digit building and additional numbers, five-digit postal code. */
function address(input: AddressIn, saudi: boolean, errors: FieldErrors) {
  const a = {
    buildingNo: digits(t(input.buildingNo, 10)),
    streetAr: t(input.streetAr, 120),
    streetEn: t(input.streetEn, 120),
    districtAr: t(input.districtAr, 80),
    districtEn: t(input.districtEn, 80),
    cityAr: t(input.cityAr, 60),
    cityEn: t(input.cityEn, 60),
    postalCode: digits(t(input.postalCode, 10)),
    additionalNo: digits(t(input.additionalNo, 10)),
  };
  if (saudi) {
    if (a.buildingNo && !/^\d{4}$/.test(a.buildingNo)) errors.buildingNo = "building";
    if (a.postalCode && !/^\d{5}$/.test(a.postalCode)) errors.postalCode = "postal";
    if (a.additionalNo && !/^\d{4}$/.test(a.additionalNo)) errors.additionalNo = "additional";
  }
  return a;
}

export type BusinessIn = AddressIn & {
  nameAr?: string | null;
  nameEn?: string | null;
  vatNumber?: string | null;
  crNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  iban?: string | null;
  bankAr?: string | null;
  bankEn?: string | null;
  invoicePrefix?: string | null;
  creditPrefix?: string | null;
  quotePrefix?: string | null;
  nextInvoice?: number | null;
  termsDays?: number | null;
  notesAr?: string | null;
  notesEn?: string | null;
  stamp?: boolean;
};

const PREFIX_RE = /^[A-Z0-9][A-Z0-9-]{0,9}$/;

export async function updateBusiness(db: Q, business: s.Business, input: BusinessIn): Promise<FormResult> {
  const errors: FieldErrors = {};
  const nameAr = t(input.nameAr, 120) ?? "";
  const nameEn = t(input.nameEn, 120) ?? "";
  if (!nameAr && !nameEn) errors.nameAr = "name";
  const vatNumber = digits(t(input.vatNumber, 20));
  if (vatNumber && !isVatNumber(vatNumber)) errors.vatNumber = "vat";
  const crNumber = digits(t(input.crNumber, 20));
  if (crNumber && !isCrNumber(crNumber)) errors.crNumber = "cr";
  const iban = t(input.iban, 40)?.replace(/\s+/g, "").toUpperCase() ?? null;
  if (iban && !isSaudiIban(iban)) errors.iban = "iban";
  const email = t(input.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "email";
  const prefixes = {
    invoicePrefix: (t(input.invoicePrefix, 10) ?? "INV").toUpperCase(),
    creditPrefix: (t(input.creditPrefix, 10) ?? "CRN").toUpperCase(),
    quotePrefix: (t(input.quotePrefix, 10) ?? "QUO").toUpperCase(),
  };
  for (const [k, v] of Object.entries(prefixes)) if (!PREFIX_RE.test(v)) errors[k] = "prefix";
  if (new Set(Object.values(prefixes)).size < 3) errors.creditPrefix = "prefix_same";
  const termsDays = input.termsDays ?? business.termsDays;
  if (!Number.isInteger(termsDays) || termsDays < 0 || termsDays > 365) errors.termsDays = "terms";
  // The sequence can move forward (a business coming from another system) but never back.
  const nextInvoice = input.nextInvoice ?? business.nextInvoice;
  if (!Number.isInteger(nextInvoice) || nextInvoice < business.nextInvoice || nextInvoice > 9_999_999) errors.nextInvoice = "next";
  const addr = address(input, true, errors);
  if (Object.keys(errors).length) return { ok: false, errors };

  await db
    .update(s.businesses)
    .set({
      nameAr,
      nameEn,
      vatNumber,
      crNumber,
      ...addr,
      phone: t(input.phone, 40),
      email,
      iban,
      bankAr: t(input.bankAr, 80),
      bankEn: t(input.bankEn, 80),
      ...prefixes,
      termsDays,
      notesAr: t(input.notesAr, 600),
      notesEn: t(input.notesEn, 600),
      stamp: input.stamp ?? business.stamp,
    })
    .where(eq(s.businesses.id, business.id));
  // The sequence moves in its own guarded update, so a stale form can't wind it back.
  await db.execute(sql`UPDATE khatm.businesses SET next_invoice = ${nextInvoice} WHERE id = ${business.id} AND next_invoice < ${nextInvoice}`);
  return { ok: true, id: business.id };
}

export type CustomerIn = AddressIn & {
  kind?: "business" | "person";
  nameAr?: string | null;
  nameEn?: string | null;
  vatNumber?: string | null;
  crNumber?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
};

export async function saveCustomer(db: Q, businessId: string, id: string | null, input: CustomerIn): Promise<FormResult> {
  const errors: FieldErrors = {};
  const kind = input.kind === "person" ? "person" : "business";
  const nameAr = t(input.nameAr, 160) ?? "";
  const nameEn = t(input.nameEn, 160) ?? "";
  if (!nameAr && !nameEn) errors.nameAr = "name";
  const country = (t(input.country, 2) ?? "SA").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) errors.country = "country";
  const vatNumber = digits(t(input.vatNumber, 20));
  if (vatNumber && country === "SA" && !isVatNumber(vatNumber)) errors.vatNumber = "vat";
  const crNumber = digits(t(input.crNumber, 20));
  if (crNumber && country === "SA" && !isCrNumber(crNumber)) errors.crNumber = "cr";
  const email = t(input.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "email";
  const addr = address(input, country === "SA", errors);
  if (Object.keys(errors).length) return { ok: false, errors };
  const row = { kind, nameAr, nameEn, vatNumber, crNumber, ...addr, country, email, phone: t(input.phone, 40) } as const;
  if (id) {
    const res = await db
      .update(s.customers)
      .set(row)
      .where(and(eq(s.customers.id, id), eq(s.customers.businessId, businessId)))
      .returning({ id: s.customers.id });
    return res.length ? { ok: true, id } : { ok: false, errors: { form: "missing" } };
  }
  const newIdValue = newId("cus");
  await db.insert(s.customers).values({ id: newIdValue, businessId, archived: false, ...row });
  return { ok: true, id: newIdValue };
}

export async function archiveCustomer(db: Q, businessId: string, id: string, archived = true) {
  await db
    .update(s.customers)
    .set({ archived })
    .where(and(eq(s.customers.id, id), eq(s.customers.businessId, businessId)));
}

export type ProductIn = { nameAr?: string | null; nameEn?: string | null; unitAr?: string | null; unitEn?: string | null; price: number | null; vat?: string | null };

export async function saveProduct(db: Q, businessId: string, id: string | null, input: ProductIn): Promise<FormResult> {
  const errors: FieldErrors = {};
  const nameAr = t(input.nameAr, 300) ?? "";
  const nameEn = t(input.nameEn, 300) ?? "";
  if (!nameAr && !nameEn) errors.nameAr = "name";
  if (input.price == null || !Number.isInteger(input.price) || input.price < 0 || input.price > 10_000_000_000) errors.price = "price";
  const vat = (input.vat ?? "S") as VatCategory;
  if (!(vat in VAT_RATES)) errors.vat = "vat";
  if (Object.keys(errors).length) return { ok: false, errors };
  const row = { nameAr, nameEn, unitAr: t(input.unitAr, 40), unitEn: t(input.unitEn, 40), price: input.price!, vat };
  if (id) {
    const res = await db
      .update(s.products)
      .set(row)
      .where(and(eq(s.products.id, id), eq(s.products.businessId, businessId)))
      .returning({ id: s.products.id });
    return res.length ? { ok: true, id } : { ok: false, errors: { form: "missing" } };
  }
  const pid = newId("prd");
  await db.insert(s.products).values({ id: pid, businessId, archived: false, ...row });
  return { ok: true, id: pid };
}

export async function archiveProduct(db: Q, businessId: string, id: string) {
  await db
    .update(s.products)
    .set({ archived: true })
    .where(and(eq(s.products.id, id), eq(s.products.businessId, businessId)));
}

/** What a customer has been billed and still owes. */
export async function customerBalance(db: Q, businessId: string, customerId: string) {
  const [row] = rowsOf<{ invoiced: number; paid: number; credited: number }>(
    await db.execute(sql`
      SELECT
        coalesce(sum(d.total) FILTER (WHERE d.kind IN ('tax', 'simplified')), 0)::int AS invoiced,
        coalesce((SELECT sum(p.amount) FROM khatm.payments p JOIN khatm.documents i ON i.id = p.document_id WHERE i.customer_id = ${customerId} AND i.business_id = ${businessId}), 0)::int AS paid,
        coalesce(sum(d.total) FILTER (WHERE d.kind = 'credit'), 0)::int AS credited
      FROM khatm.documents d
      WHERE d.business_id = ${businessId} AND d.customer_id = ${customerId} AND d.status = 'issued'`),
  );
  return { ...row, balance: row.invoiced - row.paid - row.credited };
}
