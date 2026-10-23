import "server-only";
import { and, eq } from "drizzle-orm";
import type { CustomerData } from "@/components/forms/customer-form";
import type { ProductOption } from "@/components/editor/editor";
import * as s from "@/db/schema";
import type { Q } from "@/db/tx";
import type { DocKind } from "@/lib/types";
import { partyOf } from "./docs";
import { customersOf, productsOf } from "./queries";

const pad = (n: number) => String(n).padStart(5, "0");

/** What the editor needs besides the draft itself. */
export async function editorData(db: Q, business: s.Business) {
  const [customers, products] = await Promise.all([customersOf(db, business.id), productsOf(db, business.id)]);
  return {
    seller: partyOf(business),
    stamp: business.stamp,
    termsDays: business.termsDays,
    nextNumbers: {
      tax: `${business.invoicePrefix}-${pad(business.nextInvoice)}`,
      simplified: `${business.invoicePrefix}-${pad(business.nextInvoice)}`,
      credit: `${business.creditPrefix}-${pad(business.nextCredit)}`,
      quote: `${business.quotePrefix}-${pad(business.nextQuote)}`,
    } satisfies Record<DocKind, string>,
    customers: customers.map((c): CustomerData => ({
      id: c.id,
      kind: c.kind,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      vatNumber: c.vatNumber,
      crNumber: c.crNumber,
      buildingNo: c.buildingNo,
      streetAr: c.streetAr,
      streetEn: c.streetEn,
      districtAr: c.districtAr,
      districtEn: c.districtEn,
      cityAr: c.cityAr,
      cityEn: c.cityEn,
      postalCode: c.postalCode,
      additionalNo: c.additionalNo,
      country: c.country,
      email: c.email,
      phone: c.phone,
    })),
    products: products.map((p): ProductOption => ({ id: p.id, nameAr: p.nameAr, nameEn: p.nameEn, unitAr: p.unitAr, unitEn: p.unitEn, price: p.price, vat: p.vat })),
  };
}

/** The document a credit note or a converted invoice points back to. */
export async function referenceOf(db: Q, businessId: string, id: string | null) {
  if (!id) return null;
  const [r] = await db
    .select({ id: s.documents.id, kind: s.documents.kind, number: s.documents.number, issueDate: s.documents.issueDate })
    .from(s.documents)
    .where(and(eq(s.documents.id, id), eq(s.documents.businessId, businessId)));
  return r ?? null;
}
