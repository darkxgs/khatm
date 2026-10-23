import "server-only";
import type { DocData } from "@/components/doc/invoice-document";
import type { StampKind } from "@/components/stamp";
import type * as s from "@/db/schema";
import type { DocState } from "@/lib/types";
import { partyOf } from "./docs";

/**
 * What the A4 document shows. An issued document uses the parties frozen when
 * it was issued; a draft shows the business and customer as they are now.
 */
export function docData(opts: {
  doc: s.Doc;
  lines: s.Line[];
  business: s.Business;
  customer: s.Customer | null;
  reference: { number: string | null; issueDate: string | null } | null;
  stamp: { kind: StampKind; date?: string | null; animate?: boolean } | null;
}): DocData {
  const { doc } = opts;
  const issued = doc.status !== "draft";
  return {
    kind: doc.kind,
    status: doc.status,
    number: doc.number,
    issueDate: doc.issueDate,
    supplyDate: doc.supplyDate,
    dueDate: doc.dueDate,
    seller: issued && doc.seller ? doc.seller : partyOf(opts.business),
    buyer: issued ? (doc.buyer ?? null) : opts.customer ? partyOf(opts.customer) : null,
    lines: opts.lines.map((l) => ({ nameAr: l.nameAr, nameEn: l.nameEn, unitAr: l.unitAr, unitEn: l.unitEn, qtyMilli: l.qtyMilli, unitPrice: l.unitPrice, discountBps: l.discountBps, vat: l.vat })),
    qr: doc.qr,
    reference: opts.reference,
    reasonAr: doc.reasonAr,
    reasonEn: doc.reasonEn,
    notesAr: doc.notesAr,
    notesEn: doc.notesEn,
    seal: opts.business.stamp,
    stamp: opts.stamp,
  };
}

/** The stamp a settled document carries, and the day it got it. */
export function stampFor(state: DocState, lastPaidOn: string | null, lastCreditOn: string | null, animate = false): DocData["stamp"] {
  if (state === "paid") return { kind: "paid", date: lastPaidOn ?? lastCreditOn, animate };
  if (state === "credited") return { kind: "credited", date: lastCreditOn, animate };
  if (state === "void") return { kind: "withdrawn", date: null, animate };
  return null;
}
