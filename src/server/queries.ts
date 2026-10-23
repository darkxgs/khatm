import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import * as s from "@/db/schema";
import { rowsOf, type Q } from "@/db/tx";
import { addDays, daysBetween, monthKey, quarterOf } from "@/lib/dates";
import type { DocState, DocSummary } from "@/lib/types";
import type { VatCategory } from "@/lib/zatca";

type Row = {
  id: string;
  kind: s.DocKind;
  status: s.DocStatus;
  number: string | null;
  issue_date: string | null;
  due_date: string | null;
  total: number;
  paid: number;
  credited: number;
  converted: number;
  name_ar: string | null;
  name_en: string | null;
};

/** What people see as a document's status, from its money and dates. */
export function docState(r: { kind: s.DocKind; status: s.DocStatus; total: number; paid: number; credited: number; due_date: string | null; converted?: number }, today: string): DocState {
  if (r.status === "draft") return "draft";
  if (r.status === "void") return "void";
  if (r.kind === "quote") return r.converted ? "accepted" : "sent";
  if (r.kind === "credit") return "issued";
  if (r.credited >= r.total && r.total > 0) return "credited";
  const balance = r.total - r.paid - r.credited;
  if (balance <= 0) return "paid";
  if (r.due_date && r.due_date < today) return "overdue";
  return r.paid > 0 || r.credited > 0 ? "partial" : "unpaid";
}

const SUMMARY = sql`
  SELECT d.id, d.kind, d.status, d.number, to_char(d.issue_date, 'YYYY-MM-DD') AS issue_date, to_char(d.due_date, 'YYYY-MM-DD') AS due_date, d.total,
    coalesce((SELECT sum(amount) FROM khatm.payments p WHERE p.document_id = d.id), 0)::int AS paid,
    coalesce((SELECT sum(total) FROM khatm.documents c WHERE c.reference_id = d.id AND c.kind = 'credit' AND c.status = 'issued'), 0)::int AS credited,
    (SELECT count(*) FROM khatm.documents i WHERE i.reference_id = d.id AND i.kind IN ('tax', 'simplified'))::int AS converted,
    coalesce(d.buyer->>'nameAr', cu.name_ar) AS name_ar,
    coalesce(d.buyer->>'nameEn', cu.name_en) AS name_en
  FROM khatm.documents d
  LEFT JOIN khatm.customers cu ON cu.id = d.customer_id`;

function toSummary(r: Row, today: string): DocSummary {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    number: r.number,
    customerName: r.name_ar || r.name_en ? { ar: r.name_ar ?? "", en: r.name_en ?? "" } : null,
    issueDate: r.issue_date,
    dueDate: r.due_date,
    total: r.total,
    paid: r.paid,
    credited: r.credited,
    balance: r.kind === "tax" || r.kind === "simplified" ? Math.max(0, r.total - r.paid - r.credited) : 0,
    state: docState(r, today),
  };
}

export type ListFilter = "all" | "invoices" | "quotes" | "credits" | "drafts" | "unpaid" | "overdue" | "paid";

export async function listDocuments(db: Q, businessId: string, today: string, filter: ListFilter = "all", search = "", customerId?: string): Promise<DocSummary[]> {
  const where = [sql`d.business_id = ${businessId}`];
  if (filter === "invoices" || filter === "unpaid" || filter === "overdue" || filter === "paid") where.push(sql`d.kind IN ('tax', 'simplified')`);
  if (filter === "quotes") where.push(sql`d.kind = 'quote'`);
  if (filter === "credits") where.push(sql`d.kind = 'credit'`);
  if (filter === "drafts") where.push(sql`d.status = 'draft'`);
  if (customerId) where.push(sql`d.customer_id = ${customerId}`);
  const q = search.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(sql`(d.number ILIKE ${like} OR coalesce(d.buyer->>'nameAr', cu.name_ar, '') ILIKE ${like} OR coalesce(d.buyer->>'nameEn', cu.name_en, '') ILIKE ${like})`);
  }
  const rows = rowsOf<Row>(await db.execute(sql`${SUMMARY} WHERE ${sql.join(where, sql` AND `)} ORDER BY (d.status = 'draft') DESC, d.issue_date DESC NULLS FIRST, d.created_at DESC LIMIT 300`));
  const list = rows.map((r) => toSummary(r, today));
  if (filter === "unpaid") return list.filter((d) => d.state === "unpaid" || d.state === "partial" || d.state === "overdue");
  if (filter === "overdue") return list.filter((d) => d.state === "overdue");
  if (filter === "paid") return list.filter((d) => d.state === "paid");
  return list;
}

export async function summaryOf(db: Q, businessId: string, id: string, today: string): Promise<DocSummary | null> {
  const [r] = rowsOf<Row>(await db.execute(sql`${SUMMARY} WHERE d.business_id = ${businessId} AND d.id = ${id}`));
  return r ? toSummary(r, today) : null;
}

/** One document with everything its page shows. */
export async function documentDetail(db: Q, businessId: string, id: string) {
  const [doc] = await db
    .select()
    .from(s.documents)
    .where(and(eq(s.documents.id, id), eq(s.documents.businessId, businessId)));
  if (!doc) return null;
  const [lines, payments, related, customer] = await Promise.all([
    db.select().from(s.lines).where(eq(s.lines.documentId, id)).orderBy(asc(s.lines.sort)),
    db.select().from(s.payments).where(eq(s.payments.documentId, id)).orderBy(asc(s.payments.paidOn), asc(s.payments.createdAt)),
    db
      .select({ id: s.documents.id, kind: s.documents.kind, status: s.documents.status, number: s.documents.number, total: s.documents.total, issueDate: s.documents.issueDate })
      .from(s.documents)
      .where(and(eq(s.documents.businessId, businessId), sql`(${s.documents.referenceId} = ${id} OR ${s.documents.id} = ${doc.referenceId ?? ""})`)),
    doc.customerId ? db.select().from(s.customers).where(eq(s.customers.id, doc.customerId)) : Promise.resolve([] as s.Customer[]),
  ]);
  return { doc, lines, payments, related, customer: customer[0] ?? null };
}

export async function documentByToken(db: Q, token: string) {
  if (!/^[A-Za-z0-9]{16,40}$/.test(token)) return null;
  const [doc] = await db.select().from(s.documents).where(eq(s.documents.shareToken, token));
  if (!doc || doc.status === "draft") return null;
  const [lines, settledRows, [biz], [ref]] = await Promise.all([
    db.select().from(s.lines).where(eq(s.lines.documentId, doc.id)).orderBy(asc(s.lines.sort)),
    db.execute(sql`
      SELECT (SELECT coalesce(sum(amount), 0)::int FROM khatm.payments WHERE document_id = ${doc.id}) AS paid,
             (SELECT coalesce(sum(total), 0)::int FROM khatm.documents WHERE reference_id = ${doc.id} AND kind = 'credit' AND status = 'issued') AS credited`),
    db.select({ timezone: s.businesses.timezone }).from(s.businesses).where(eq(s.businesses.id, doc.businessId)),
    doc.referenceId
      ? db.select({ number: s.documents.number, issueDate: s.documents.issueDate }).from(s.documents).where(eq(s.documents.id, doc.referenceId))
      : Promise.resolve([] as { number: string | null; issueDate: string | null }[]),
  ]);
  const { paid, credited } = rowsOf<{ paid: number; credited: number }>(settledRows)[0];
  return { doc, lines, paid, credited, timezone: biz?.timezone ?? "Asia/Riyadh", reference: ref ?? null };
}

export type Dashboard = {
  outstanding: number;
  overdue: number;
  overdueCount: number;
  paidThisMonth: number;
  vatThisQuarter: number;
  quarter: { year: number; quarter: number };
  months: { key: string; sales: number }[];
  aging: { bucket: "current" | "1-30" | "31-60" | "61-90" | "90+"; amount: number; count: number }[];
  recent: DocSummary[];
};

export async function dashboard(db: Q, businessId: string, today: string): Promise<Dashboard> {
  const invoices = (await listDocuments(db, businessId, today, "invoices")).filter((d) => d.status === "issued");
  const open = invoices.filter((d) => d.balance > 0 && d.state !== "credited");
  const q = quarterOf(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const sixAgo = addDays(`${monthKey(addDays(monthStart, -150))}-01`, 0);

  const [[paidMonth], [vatQ], monthly, recent] = await Promise.all([
    db.execute(sql`SELECT coalesce(sum(amount), 0)::int AS v FROM khatm.payments WHERE business_id = ${businessId} AND paid_on >= ${monthStart}`).then((r) => rowsOf<{ v: number }>(r)),
    db
      .execute(
        sql`
        SELECT coalesce(sum(CASE WHEN kind = 'credit' THEN -vat ELSE vat END), 0)::int AS v
        FROM khatm.documents
        WHERE business_id = ${businessId} AND status = 'issued' AND kind IN ('tax', 'simplified', 'credit') AND issue_date BETWEEN ${q.start} AND ${q.end}`,
      )
      .then((r) => rowsOf<{ v: number }>(r)),
    db
      .execute(
        sql`
        SELECT to_char(issue_date, 'YYYY-MM') AS key, coalesce(sum(CASE WHEN kind = 'credit' THEN -taxable ELSE taxable END), 0)::int AS sales
        FROM khatm.documents
        WHERE business_id = ${businessId} AND status = 'issued' AND kind IN ('tax', 'simplified', 'credit') AND issue_date >= ${sixAgo}
        GROUP BY 1 ORDER BY 1`,
      )
      .then((r) => rowsOf<{ key: string; sales: number }>(r)),
    listDocuments(db, businessId, today, "all"),
  ]);

  const months: { key: string; sales: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const key = monthKey(addDays(`${today.slice(0, 7)}-15`, -30 * i));
    if (!months.some((m) => m.key === key)) months.push({ key, sales: monthly.find((m) => m.key === key)?.sales ?? 0 });
  }

  const buckets: Dashboard["aging"] = [
    { bucket: "current", amount: 0, count: 0 },
    { bucket: "1-30", amount: 0, count: 0 },
    { bucket: "31-60", amount: 0, count: 0 },
    { bucket: "61-90", amount: 0, count: 0 },
    { bucket: "90+", amount: 0, count: 0 },
  ];
  for (const d of open) {
    const late = d.dueDate ? daysBetween(d.dueDate, today) : 0;
    const b = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
    buckets[b].amount += d.balance;
    buckets[b].count += 1;
  }
  const overdue = open.filter((d) => d.state === "overdue");
  return {
    outstanding: open.reduce((s2, d) => s2 + d.balance, 0),
    overdue: overdue.reduce((s2, d) => s2 + d.balance, 0),
    overdueCount: overdue.length,
    paidThisMonth: paidMonth?.v ?? 0,
    vatThisQuarter: vatQ?.v ?? 0,
    quarter: { year: q.year, quarter: q.quarter },
    months,
    aging: buckets,
    recent: recent.slice(0, 6),
  };
}

export type VatRowKey = "S" | "Zd" | "Zx" | "E" | "O";

export type VatReturn = {
  start: string;
  end: string;
  rows: { key: VatRowKey; sales: number; credits: number; net: number; vat: number }[];
  totals: { sales: number; credits: number; net: number; vat: number };
  documents: number;
};

/**
 * The quarter's sales by VAT category, credit notes netted off: the sales side
 * of a VAT return. Zero-rated sales split into domestic ones and exports, by
 * the buyer's country on the issued document.
 */
export async function vatReturn(db: Q, businessId: string, start: string, end: string): Promise<VatReturn> {
  const rows = rowsOf<{ vat: VatCategory; export: boolean; sales: number; credits: number }>(
    await db.execute(sql`
      SELECT l.vat, coalesce(d.buyer->>'country', 'SA') <> 'SA' AS export,
        coalesce(sum(l.net) FILTER (WHERE d.kind <> 'credit'), 0)::int AS sales,
        coalesce(sum(l.net) FILTER (WHERE d.kind = 'credit'), 0)::int AS credits
      FROM khatm.lines l JOIN khatm.documents d ON d.id = l.document_id
      WHERE d.business_id = ${businessId} AND d.status = 'issued' AND d.kind IN ('tax', 'simplified', 'credit')
        AND d.issue_date BETWEEN ${start} AND ${end}
      GROUP BY 1, 2`),
  );
  // VAT itself comes from the documents (rounded once per category), not the lines.
  const [docVat] = rowsOf<{ v: number; vs: number; vc: number; n: number }>(
    await db.execute(sql`
      SELECT coalesce(sum(CASE WHEN kind = 'credit' THEN -vat ELSE vat END), 0)::int AS v,
        coalesce(sum(vat) FILTER (WHERE kind <> 'credit'), 0)::int AS vs,
        coalesce(sum(vat) FILTER (WHERE kind = 'credit'), 0)::int AS vc,
        count(*)::int AS n
      FROM khatm.documents
      WHERE business_id = ${businessId} AND status = 'issued' AND kind IN ('tax', 'simplified', 'credit') AND issue_date BETWEEN ${start} AND ${end}`),
  );
  const pick = (vat: VatCategory, exp?: boolean) => rows.filter((r) => r.vat === vat && (exp === undefined || r.export === exp));
  const sum = (rs: { sales: number; credits: number }[]) => rs.reduce((a, r) => ({ sales: a.sales + r.sales, credits: a.credits + r.credits }), { sales: 0, credits: 0 });
  const groups: [VatRowKey, { sales: number; credits: number }][] = [
    ["S", sum(pick("S"))],
    ["Zd", sum(pick("Z", false))],
    ["Zx", sum(pick("Z", true))],
    ["E", sum(pick("E"))],
    ["O", sum(pick("O"))],
  ];
  // Only standard-rated sales carry VAT, so the documents' VAT is all theirs.
  const out = groups.map(([key, g]) => ({ key, sales: g.sales, credits: g.credits, net: g.sales - g.credits, vat: key === "S" ? (docVat?.v ?? 0) : 0 }));
  return {
    start,
    end,
    rows: out,
    totals: { sales: out.reduce((a, r) => a + r.sales, 0), credits: out.reduce((a, r) => a + r.credits, 0), net: out.reduce((a, r) => a + r.net, 0), vat: docVat?.v ?? 0 },
    documents: docVat?.n ?? 0,
  };
}

/** What each customer owes, from their issued invoices. */
export async function customerBalances(db: Q, businessId: string, today: string) {
  const rows = rowsOf<{ customer_id: string; balance: number; overdue: number }>(
    await db.execute(sql`
      WITH inv AS (
        SELECT d.customer_id, d.due_date,
          d.total
          - coalesce((SELECT sum(amount) FROM khatm.payments p WHERE p.document_id = d.id), 0)
          - coalesce((SELECT sum(total) FROM khatm.documents c WHERE c.reference_id = d.id AND c.kind = 'credit' AND c.status = 'issued'), 0) AS balance
        FROM khatm.documents d
        WHERE d.business_id = ${businessId} AND d.status = 'issued' AND d.kind IN ('tax', 'simplified') AND d.customer_id IS NOT NULL
      )
      SELECT customer_id, coalesce(sum(balance) FILTER (WHERE balance > 0), 0)::int AS balance,
        coalesce(sum(balance) FILTER (WHERE balance > 0 AND due_date < ${today}), 0)::int AS overdue
      FROM inv GROUP BY customer_id`),
  );
  return new Map(rows.map((r) => [r.customer_id, { balance: r.balance, overdue: r.overdue }]));
}

export async function customersOf(db: Q, businessId: string) {
  return db
    .select()
    .from(s.customers)
    .where(and(eq(s.customers.businessId, businessId), eq(s.customers.archived, false)))
    .orderBy(asc(s.customers.nameEn));
}

export async function productsOf(db: Q, businessId: string) {
  return db
    .select()
    .from(s.products)
    .where(and(eq(s.products.businessId, businessId), eq(s.products.archived, false)))
    .orderBy(desc(s.products.createdAt));
}
