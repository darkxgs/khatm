import "server-only";
import { and, eq, sql } from "drizzle-orm";
import * as s from "@/db/schema";
import { rowsOf, type Q, type Tx } from "@/db/tx";
import { documentTotals, lineAmounts, qrAmount } from "@/lib/amounts";
import { addDays, todayIn } from "@/lib/dates";
import { newId, newShareToken } from "@/lib/id";
import { encodeQr, isVatNumber, VAT_RATES, type VatCategory } from "@/lib/zatca";

// Documents are drafts until issued. Issuing gives them their number from the
// business's sequence, freezes both parties, stamps the time and the QR code,
// and locks them: an issued invoice is corrected with a credit note, never edited.

export type LineIn = {
  productId?: string | null;
  nameAr: string;
  nameEn: string;
  unitAr?: string | null;
  unitEn?: string | null;
  qtyMilli: number;
  unitPrice: number;
  discountBps: number;
  vat: VatCategory;
};

export type DraftIn = {
  kind: s.DocKind;
  customerId: string | null;
  issueDate: string | null;
  supplyDate: string | null;
  dueDate: string | null;
  notesAr: string | null;
  notesEn: string | null;
  reasonAr?: string | null;
  reasonEn?: string | null;
  referenceId?: string | null;
  lines: LineIn[];
};

export type DraftError = "lines" | "line" | "customer" | "dates" | "not_draft" | "reference";
export type SaveResult = { ok: true; id: string } | { ok: false; error: DraftError; index?: number };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const clean = (v: string | null | undefined, max = 500) => {
  const t = (v ?? "").trim().slice(0, max);
  return t || null;
};

function checkLines(lines: LineIn[]): { ok: true } | { ok: false; error: "lines" | "line"; index?: number } {
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 100) return { ok: false, error: "lines" };
  for (const [i, l] of lines.entries()) {
    const named = (l.nameAr ?? "").trim() || (l.nameEn ?? "").trim();
    const okNums =
      Number.isInteger(l.qtyMilli) &&
      l.qtyMilli > 0 &&
      l.qtyMilli <= 100_000_000 &&
      Number.isInteger(l.unitPrice) &&
      l.unitPrice >= 0 &&
      l.unitPrice <= 10_000_000_000 &&
      Number.isInteger(l.discountBps) &&
      l.discountBps >= 0 &&
      l.discountBps <= 10_000;
    if (!named || !okNums || !(l.vat in VAT_RATES)) return { ok: false, error: "line", index: i };
  }
  return { ok: true };
}

function lineRows(documentId: string, lines: LineIn[]) {
  return lines.map((l, i) => {
    const a = lineAmounts(l);
    return {
      id: newId("ln"),
      documentId,
      sort: i,
      productId: l.productId ?? null,
      nameAr: l.nameAr.trim().slice(0, 300),
      nameEn: l.nameEn.trim().slice(0, 300),
      unitAr: clean(l.unitAr, 40),
      unitEn: clean(l.unitEn, 40),
      qtyMilli: l.qtyMilli,
      unitPrice: l.unitPrice,
      discountBps: l.discountBps,
      vat: l.vat,
      vatBps: a.vatBps,
      net: a.net,
      vatAmount: a.vat,
      total: a.total,
    };
  });
}

/** Creates a draft (id null) or rewrites one. Totals are worked out here, never taken from the browser. */
const KINDS: s.DocKind[] = ["tax", "simplified", "credit", "quote"];

export async function saveDraft(db: Q, business: s.Business, id: string | null, input: DraftIn): Promise<SaveResult> {
  if (!KINDS.includes(input.kind)) return { ok: false, error: "lines" };
  const lc = checkLines(input.lines);
  if (!lc.ok) return lc;
  for (const d of [input.issueDate, input.supplyDate, input.dueDate]) if (d && !DAY_RE.test(d)) return { ok: false, error: "dates" };
  return (db as Tx).transaction(async (tx) => {
    if (input.customerId) {
      const [c] = await tx
        .select({ id: s.customers.id })
        .from(s.customers)
        .where(and(eq(s.customers.id, input.customerId), eq(s.customers.businessId, business.id)));
      if (!c) return { ok: false, error: "customer" } as const;
    }
    if (input.referenceId) {
      const [ref] = await tx
        .select({ id: s.documents.id })
        .from(s.documents)
        .where(and(eq(s.documents.id, input.referenceId), eq(s.documents.businessId, business.id)));
      if (!ref) return { ok: false, error: "reference" } as const;
    }
    const totals = documentTotals(input.lines);
    const fields = {
      customerId: input.customerId,
      issueDate: input.issueDate,
      supplyDate: input.supplyDate,
      dueDate: input.dueDate,
      notesAr: clean(input.notesAr, 1000),
      notesEn: clean(input.notesEn, 1000),
      reasonAr: clean(input.reasonAr, 300),
      reasonEn: clean(input.reasonEn, 300),
      gross: totals.gross,
      discount: totals.discount,
      taxable: totals.taxable,
      vat: totals.vat,
      total: totals.total,
      updatedAt: new Date(),
    };
    let docId = id;
    if (docId) {
      const [d] = await tx
        .select()
        .from(s.documents)
        .where(and(eq(s.documents.id, docId), eq(s.documents.businessId, business.id)))
        .for("update");
      if (!d || d.status !== "draft") return { ok: false, error: "not_draft" } as const;
      // A draft can switch between invoice kinds and a quotation; a credit note stays a credit note.
      if ((d.kind === "credit") !== (input.kind === "credit")) return { ok: false, error: "reference" } as const;
      await tx
        .update(s.documents)
        .set({ ...fields, kind: input.kind })
        .where(eq(s.documents.id, docId));
      await tx.delete(s.lines).where(eq(s.lines.documentId, docId));
    } else {
      if (input.kind === "credit" && !input.referenceId) return { ok: false, error: "reference" } as const;
      docId = newId("doc");
      await tx.insert(s.documents).values({ id: docId, businessId: business.id, kind: input.kind, status: "draft", referenceId: input.referenceId ?? null, ...fields });
    }
    await tx.insert(s.lines).values(lineRows(docId, input.lines));
    return { ok: true, id: docId } as const;
  });
}

export function partyOf(p: s.Business | s.Customer): s.Party {
  return {
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    vatNumber: p.vatNumber,
    crNumber: p.crNumber,
    buildingNo: p.buildingNo,
    streetAr: p.streetAr,
    streetEn: p.streetEn,
    districtAr: p.districtAr,
    districtEn: p.districtEn,
    cityAr: p.cityAr,
    cityEn: p.cityEn,
    postalCode: p.postalCode,
    additionalNo: p.additionalNo,
    country: "country" in p ? p.country : "SA",
    phone: p.phone,
    email: p.email,
    iban: "iban" in p ? p.iban : null,
    bankAr: "bankAr" in p ? p.bankAr : null,
    bankEn: "bankEn" in p ? p.bankEn : null,
  };
}

const hasAddress = (p: { cityAr: string | null; cityEn: string | null; streetAr: string | null; streetEn: string | null }) => !!(p.cityAr || p.cityEn) && !!(p.streetAr || p.streetEn);

export type IssueError = "not_draft" | "lines" | "seller_name" | "seller_vat" | "seller_address" | "buyer_required" | "buyer_vat" | "buyer_address" | "reference" | "credit_exceeds" | "reason";
export type IssueResult = { ok: true; number: string } | { ok: false; error: IssueError };

/** What a document still needs before it can be issued; empty when it's ready. */
export function issueProblems(kind: s.DocKind, seller: s.Business, buyer: s.Customer | null, hasLines: boolean, reason?: string | null): IssueError[] {
  const out: IssueError[] = [];
  if (!hasLines) out.push("lines");
  if (!seller.nameAr && !seller.nameEn) out.push("seller_name");
  if (kind !== "quote") {
    if (!seller.vatNumber || !isVatNumber(seller.vatNumber)) out.push("seller_vat");
    if (!hasAddress(seller)) out.push("seller_address");
  }
  if (kind === "tax" || kind === "quote") {
    if (!buyer) out.push("buyer_required");
  }
  if (kind === "tax" && buyer) {
    // A standard tax invoice names the buyer with an address; a Saudi VAT number, if given, must be valid.
    if (buyer.vatNumber && (buyer.country ?? "SA") === "SA" && !isVatNumber(buyer.vatNumber)) out.push("buyer_vat");
    if (!hasAddress(buyer)) out.push("buyer_address");
  }
  if (kind === "credit" && !(reason ?? "").trim()) out.push("reason");
  return out;
}

export async function issue(db: Q, business: s.Business, id: string, at: Date = new Date()): Promise<IssueResult> {
  return (db as Tx).transaction(async (tx) => {
    const [d] = await tx
      .select()
      .from(s.documents)
      .where(and(eq(s.documents.id, id), eq(s.documents.businessId, business.id)))
      .for("update");
    if (!d || d.status !== "draft") return { ok: false, error: "not_draft" } as const;
    const [biz] = await tx.select().from(s.businesses).where(eq(s.businesses.id, business.id)).for("update");
    const buyer = d.customerId ? ((await tx.select().from(s.customers).where(eq(s.customers.id, d.customerId)))[0] ?? null) : null;
    const lineCount = (await tx.select({ id: s.lines.id }).from(s.lines).where(eq(s.lines.documentId, id))).length;
    const problems = issueProblems(d.kind, biz, buyer, lineCount > 0, d.reasonAr || d.reasonEn);
    if (problems.length) return { ok: false, error: problems[0] } as const;

    if (d.kind === "credit") {
      const [ref] = d.referenceId
        ? await tx
            .select()
            .from(s.documents)
            .where(and(eq(s.documents.id, d.referenceId), eq(s.documents.businessId, business.id)))
        : [];
      if (!ref || ref.status !== "issued" || (ref.kind !== "tax" && ref.kind !== "simplified")) return { ok: false, error: "reference" } as const;
      const [{ credited }] = rowsOf<{ credited: number }>(
        await tx.execute(sql`SELECT coalesce(sum(total), 0)::int AS credited FROM khatm.documents WHERE reference_id = ${ref.id} AND kind = 'credit' AND status = 'issued'`),
      );
      if (credited + d.total > ref.total) return { ok: false, error: "credit_exceeds" } as const;
    }

    // The next number in this kind's sequence (tax and simplified invoices share one).
    const seq = d.kind === "credit" ? "next_credit" : d.kind === "quote" ? "next_quote" : "next_invoice";
    const prefix = d.kind === "credit" ? biz.creditPrefix : d.kind === "quote" ? biz.quotePrefix : biz.invoicePrefix;
    const [{ n }] = rowsOf<{ n: number }>(await tx.execute(sql`UPDATE khatm.businesses SET ${sql.raw(seq)} = ${sql.raw(seq)} + 1 WHERE id = ${business.id} RETURNING ${sql.raw(seq)} - 1 AS n`));
    const number = `${prefix}-${String(n).padStart(5, "0")}`;

    const today = todayIn(biz.timezone, at);
    const issueDate = d.issueDate ?? today;
    const seller = partyOf(biz);
    const qr =
      d.kind === "quote"
        ? null
        : encodeQr({
            sellerName: (biz.nameAr || biz.nameEn).slice(0, 80),
            vatNumber: biz.vatNumber!,
            timestamp: at.toISOString().replace(/\.\d{3}Z$/, "Z"),
            total: qrAmount(d.total),
            vat: qrAmount(d.vat),
          });
    await tx
      .update(s.documents)
      .set({
        status: "issued",
        number,
        seller,
        buyer: buyer ? partyOf(buyer) : null,
        issueDate,
        supplyDate: d.supplyDate ?? issueDate,
        dueDate: d.dueDate ?? (d.kind === "credit" ? null : addDays(issueDate, biz.termsDays)),
        issuedAt: at,
        qr,
        shareToken: newShareToken(),
        updatedAt: at,
      })
      .where(eq(s.documents.id, id));
    return { ok: true, number } as const;
  });
}

/** Money already settled against an invoice: payments plus issued credit notes. */
export async function settled(db: Q, docId: string) {
  const [row] = rowsOf<{ paid: number; credited: number }>(
    await db.execute(sql`
      SELECT
        (SELECT coalesce(sum(amount), 0)::int FROM khatm.payments WHERE document_id = ${docId}) AS paid,
        (SELECT coalesce(sum(total), 0)::int FROM khatm.documents WHERE reference_id = ${docId} AND kind = 'credit' AND status = 'issued') AS credited`),
  );
  return row;
}

export type PaymentError = "not_found" | "not_payable" | "amount" | "date";

export async function recordPayment(db: Q, businessId: string, docId: string, p: { amount: number; paidOn: string; method: s.PayMethod; note: string | null }) {
  if (!Number.isInteger(p.amount) || p.amount <= 0) return { ok: false as const, error: "amount" as PaymentError };
  if (!DAY_RE.test(p.paidOn)) return { ok: false as const, error: "date" as PaymentError };
  return (db as Tx).transaction(async (tx) => {
    const [d] = await tx
      .select()
      .from(s.documents)
      .where(and(eq(s.documents.id, docId), eq(s.documents.businessId, businessId)))
      .for("update");
    if (!d) return { ok: false as const, error: "not_found" as PaymentError };
    if (d.status !== "issued" || (d.kind !== "tax" && d.kind !== "simplified")) return { ok: false as const, error: "not_payable" as PaymentError };
    const { paid, credited } = await settled(tx, docId);
    if (p.amount > d.total - paid - credited) return { ok: false as const, error: "amount" as PaymentError };
    const id = newId("pay");
    await tx.insert(s.payments).values({ id, businessId, documentId: docId, amount: p.amount, paidOn: p.paidOn, method: p.method, note: clean(p.note, 200) });
    return { ok: true as const, id, settled: p.amount === d.total - paid - credited };
  });
}

export async function deletePayment(db: Q, businessId: string, paymentId: string) {
  await db.delete(s.payments).where(and(eq(s.payments.id, paymentId), eq(s.payments.businessId, businessId)));
}

async function linesOf(db: Q, docId: string): Promise<LineIn[]> {
  const rows = await db.select().from(s.lines).where(eq(s.lines.documentId, docId)).orderBy(s.lines.sort);
  return rows.map((l) => ({
    productId: l.productId,
    nameAr: l.nameAr,
    nameEn: l.nameEn,
    unitAr: l.unitAr,
    unitEn: l.unitEn,
    qtyMilli: l.qtyMilli,
    unitPrice: l.unitPrice,
    discountBps: l.discountBps,
    vat: l.vat,
  }));
}

async function ownDoc(db: Q, businessId: string, id: string) {
  const [d] = await db
    .select()
    .from(s.documents)
    .where(and(eq(s.documents.id, id), eq(s.documents.businessId, businessId)));
  return d ?? null;
}

/** A credit note draft for the whole of an invoice; it can be trimmed before issuing. */
export async function startCreditNote(db: Q, business: s.Business, invoiceId: string): Promise<SaveResult> {
  const inv = await ownDoc(db, business.id, invoiceId);
  if (!inv || inv.status !== "issued" || (inv.kind !== "tax" && inv.kind !== "simplified")) return { ok: false, error: "reference" };
  return saveDraft(db, business, null, {
    kind: "credit",
    customerId: inv.customerId,
    issueDate: null,
    supplyDate: null,
    dueDate: null,
    notesAr: null,
    notesEn: null,
    reasonAr: null,
    reasonEn: null,
    referenceId: inv.id,
    lines: await linesOf(db, inv.id),
  });
}

/** Turns an accepted quotation into a draft invoice with the same lines. */
export async function convertQuote(db: Q, business: s.Business, quoteId: string, kind: "tax" | "simplified"): Promise<SaveResult> {
  const q = await ownDoc(db, business.id, quoteId);
  if (!q || q.kind !== "quote" || q.status !== "issued") return { ok: false, error: "reference" };
  return saveDraft(db, business, null, {
    kind,
    customerId: q.customerId,
    issueDate: null,
    supplyDate: null,
    dueDate: null,
    notesAr: q.notesAr,
    notesEn: q.notesEn,
    referenceId: q.id,
    lines: await linesOf(db, q.id),
  });
}

/** A new draft with the same customer and lines. */
export async function duplicate(db: Q, business: s.Business, id: string): Promise<SaveResult> {
  const d = await ownDoc(db, business.id, id);
  if (!d || d.kind === "credit") return { ok: false, error: "reference" };
  return saveDraft(db, business, null, {
    kind: d.kind,
    customerId: d.customerId,
    issueDate: null,
    supplyDate: null,
    dueDate: null,
    notesAr: d.notesAr,
    notesEn: d.notesEn,
    lines: await linesOf(db, d.id),
  });
}

export async function deleteDraft(db: Q, businessId: string, id: string) {
  await db.delete(s.documents).where(and(eq(s.documents.id, id), eq(s.documents.businessId, businessId), eq(s.documents.status, "draft")));
}

/** Quotations can be withdrawn; invoices can't (they're corrected with a credit note). */
export async function voidQuote(db: Q, businessId: string, id: string) {
  await db
    .update(s.documents)
    .set({ status: "void", updatedAt: new Date() })
    .where(and(eq(s.documents.id, id), eq(s.documents.businessId, businessId), eq(s.documents.kind, "quote"), eq(s.documents.status, "issued")));
}

export async function markViewed(db: Q, docId: string) {
  await db.execute(sql`UPDATE khatm.documents SET viewed_at = now() WHERE id = ${docId} AND viewed_at IS NULL`);
}
