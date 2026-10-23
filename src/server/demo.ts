import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import type { Connection, DB } from "@/db";
import * as s from "@/db/schema";
import { rowsOf } from "@/db/tx";
import { todayIn } from "@/lib/dates";
import { BUSINESS, CUSTOMERS, PRODUCTS } from "@/lib/demo-data";
import { newId } from "@/lib/id";
import { allowAttempt } from "./auth";
import { convertQuote, issue, recordPayment, saveDraft, startCreditNote, type LineIn } from "./docs";
import { claim } from "./jobs";

// Naqsh (نقش), a fictional design studio in Riyadh with six months of
// invoicing behind it: paid, part-paid and overdue invoices, a credit note,
// an export invoice at zero rate, quotations and drafts. Every visitor who
// opens the demo gets their own copy for a day.

type Spec = {
  kind: s.DocKind;
  customer: string | null;
  daysAgo: number;
  lines: [product: string, qty: number, discountPct?: number][];
  zeroRated?: boolean;
  pay?: { daysAgo: number; amount: "full" | "half" | number; method: s.PayMethod }[];
  draft?: boolean;
};

const HISTORY: Spec[] = [
  { kind: "tax", customer: "rewaq", daysAgo: 170, lines: [["identity", 1]], pay: [{ daysAgo: 160, amount: "full", method: "transfer" }] },
  {
    kind: "tax",
    customer: "habba",
    daysAgo: 150,
    lines: [
      ["packaging", 1],
      ["photo", 1],
    ],
    pay: [{ daysAgo: 135, amount: "full", method: "transfer" }],
  },
  {
    kind: "tax",
    customer: "lamsa",
    daysAgo: 128,
    lines: [
      ["page", 5],
      ["consult", 3, 10],
    ],
    pay: [{ daysAgo: 110, amount: "full", method: "transfer" }],
  },
  { kind: "simplified", customer: "noura", daysAgo: 120, lines: [["logo", 1]], pay: [{ daysAgo: 120, amount: "full", method: "card" }] },
  {
    kind: "tax",
    customer: "gulf",
    daysAgo: 100,
    zeroRated: true,
    lines: [
      ["identity", 1],
      ["templates", 1],
    ],
    pay: [{ daysAgo: 85, amount: "full", method: "transfer" }],
  },
  { kind: "tax", customer: "rewaq", daysAgo: 95, lines: [["social", 3]], pay: [{ daysAgo: 80, amount: 2 * 747_500, method: "transfer" }] },
  {
    kind: "tax",
    customer: "habba",
    daysAgo: 75,
    lines: [
      ["social", 1],
      ["templates", 1],
    ],
    pay: [{ daysAgo: 70, amount: "full", method: "transfer" }],
  },
  { kind: "tax", customer: "athar", daysAgo: 62, lines: [["page", 3, 15]] },
  {
    kind: "quote",
    customer: "lamsa",
    daysAgo: 45,
    lines: [
      ["packaging", 2],
      ["photo", 2],
    ],
  },
  {
    kind: "tax",
    customer: "rewaq",
    daysAgo: 33,
    lines: [
      ["page", 8],
      ["consult", 6],
    ],
  },
  {
    kind: "simplified",
    customer: "noura",
    daysAgo: 20,
    lines: [
      ["cards", 2],
      ["consult", 1],
    ],
    pay: [{ daysAgo: 20, amount: "full", method: "cash" }],
  },
  { kind: "tax", customer: "habba", daysAgo: 12, lines: [["social", 1]] },
  { kind: "tax", customer: "gulf", daysAgo: 6, zeroRated: true, lines: [["page", 4]] },
  { kind: "quote", customer: "athar", daysAgo: 4, lines: [["identity", 1, 20]] },
  { kind: "tax", customer: "lamsa", daysAgo: 2, lines: [["social", 1]], pay: [{ daysAgo: 1, amount: "full", method: "transfer" }] },
  {
    kind: "tax",
    customer: "rewaq",
    daysAgo: 0,
    lines: [
      ["packaging", 1],
      ["consult", 2],
    ],
    draft: true,
  },
  { kind: "simplified", customer: null, daysAgo: 0, lines: [["cards", 1]], draft: true },
];

/** The same moment of a day `daysAgo` before `now`, at 10:00 in Riyadh. */
const daysBefore = (now: Date, days: number) => {
  const d = new Date(now.getTime() - days * 86_400_000);
  d.setUTCHours(7, 0, 0, 0);
  return d;
};

export async function createDemoAccount(db: DB, opts: { expiresAt: Date; now?: Date }): Promise<{ user: s.User; business: s.Business }> {
  const now = opts.now ?? new Date();
  const uid = newId("usr");
  const bid = newId("biz");
  await db.insert(s.users).values({ id: uid, email: null, passwordHash: null, name: null, isDemo: true, expiresAt: opts.expiresAt });
  await db
    .insert(s.businesses)
    .values({ id: bid, ownerId: uid, invoicePrefix: "INV", creditPrefix: "CRN", quotePrefix: "QUO", nextInvoice: 1, nextCredit: 1, nextQuote: 1, termsDays: 14, timezone: "Asia/Riyadh", ...BUSINESS });
  const customerIds = new Map<string, string>();
  await db.insert(s.customers).values(
    CUSTOMERS.map(({ key, ...c }) => {
      const id = newId("cus");
      customerIds.set(key, id);
      return { id, businessId: bid, archived: false, ...c };
    }),
  );
  const productIds = new Map<string, string>();
  await db.insert(s.products).values(
    PRODUCTS.map(({ key, ...p }, i) => {
      const id = newId("prd");
      productIds.set(key, id);
      return { id, businessId: bid, archived: false, createdAt: new Date(now.getTime() - (PRODUCTS.length - i) * 1000), ...p };
    }),
  );

  const lineFor = (key: string, qty: number, discountPct = 0, zero = false): LineIn => {
    const p = PRODUCTS.find((x) => x.key === key)!;
    return {
      productId: productIds.get(key)!,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      unitAr: p.unitAr,
      unitEn: p.unitEn,
      qtyMilli: qty * 1000,
      unitPrice: p.price,
      discountBps: discountPct * 100,
      vat: zero ? "Z" : p.vat,
    };
  };

  let business = (await db.select().from(s.businesses).where(eq(s.businesses.id, bid)))[0];
  const issued = new Map<number, string>();
  for (const [i, spec] of HISTORY.entries()) {
    const at = daysBefore(now, spec.daysAgo);
    const res = await saveDraft(db, business, null, {
      kind: spec.kind,
      customerId: spec.customer ? customerIds.get(spec.customer)! : null,
      issueDate: spec.draft ? null : todayIn(business.timezone, at),
      supplyDate: null,
      dueDate: null,
      notesAr: spec.kind === "tax" ? BUSINESS.notesAr : null,
      notesEn: spec.kind === "tax" ? BUSINESS.notesEn : null,
      lines: spec.lines.map(([k, q, d]) => lineFor(k, q, d, spec.zeroRated)),
    });
    if (!res.ok) throw new Error(`demo seed: draft ${i} failed (${res.error})`);
    if (spec.draft) continue;
    const r = await issue(db, business, res.id, at);
    if (!r.ok) throw new Error(`demo seed: issue ${i} failed (${r.error})`);
    issued.set(i, res.id);
    for (const p of spec.pay ?? []) {
      const [d] = await db.select({ total: s.documents.total }).from(s.documents).where(eq(s.documents.id, res.id));
      const amount = p.amount === "full" ? d.total : p.amount === "half" ? Math.round(d.total / 2) : p.amount;
      const paid = await recordPayment(db, bid, res.id, { amount, paidOn: todayIn(business.timezone, daysBefore(now, p.daysAgo)), method: p.method, note: null });
      if (!paid.ok) throw new Error(`demo seed: payment ${i} failed (${paid.error})`);
    }
    business = (await db.select().from(s.businesses).where(eq(s.businesses.id, bid)))[0];

    // The third month of Rewaq's account management was cancelled: a credit note for it.
    if (i === 5) {
      const cn = await startCreditNote(db, business, res.id);
      if (!cn.ok) throw new Error("demo seed: credit note");
      await saveDraft(db, business, cn.id, {
        kind: "credit",
        customerId: customerIds.get("rewaq")!,
        issueDate: todayIn(business.timezone, daysBefore(now, 60)),
        supplyDate: null,
        dueDate: null,
        notesAr: null,
        notesEn: null,
        reasonAr: "إلغاء الشهر الثالث من إدارة الحسابات بطلب من العميل",
        reasonEn: "Third month of account management cancelled at the client's request",
        referenceId: res.id,
        lines: [lineFor("social", 1)],
      });
      const ci = await issue(db, business, cn.id, daysBefore(now, 60));
      if (!ci.ok) throw new Error(`demo seed: credit issue (${ci.error})`);
    }
    // Lamsa accepted the packaging quote: it became an invoice, half paid so far.
    if (i === 8) {
      const inv = await convertQuote(db, business, res.id, "tax");
      if (!inv.ok) throw new Error("demo seed: convert");
      const at2 = daysBefore(now, 40);
      const [draft] = await db.select().from(s.documents).where(eq(s.documents.id, inv.id));
      await db
        .update(s.documents)
        .set({ issueDate: todayIn(business.timezone, at2) })
        .where(eq(s.documents.id, draft.id));
      const ii = await issue(db, business, inv.id, at2);
      if (!ii.ok) throw new Error(`demo seed: converted issue (${ii.error})`);
      const [d] = await db.select({ total: s.documents.total }).from(s.documents).where(eq(s.documents.id, inv.id));
      await recordPayment(db, bid, inv.id, { amount: Math.round(d.total / 2), paidOn: todayIn(business.timezone, daysBefore(now, 30)), method: "transfer", note: "50% advance" });
      business = (await db.select().from(s.businesses).where(eq(s.businesses.id, bid)))[0];
    }
  }
  // Each document was "written" when it was issued, not when the demo was made.
  await db.execute(sql`UPDATE khatm.documents SET created_at = issued_at - interval '25 minutes', updated_at = issued_at WHERE business_id = ${bid} AND issued_at IS NOT NULL`);
  const [user] = await db.select().from(s.users).where(eq(s.users.id, uid));
  return { user, business };
}

const DEMO_HOURS = 24;
const MAX_DEMOS = 400;

export type DemoResult = { ok: true; user: s.User } | { ok: false; error: "rate" | "full" };

export async function startDemo(conn: Connection, ipHash: string): Promise<DemoResult> {
  const perHour = process.env.NODE_ENV === "production" ? 8 : 10_000;
  if (!(await allowAttempt(conn, `demo:${ipHash}`, perHour, 3600))) return { ok: false, error: "rate" };
  const [{ n }] = rowsOf<{ n: number }>(await conn.db.execute(sql`SELECT count(*)::int AS n FROM khatm.users WHERE is_demo AND expires_at > now()`));
  if (n >= MAX_DEMOS) {
    await cleanup(conn);
    return { ok: false, error: "full" };
  }
  const { user } = await conn.db.transaction((tx) => createDemoAccount(tx as unknown as DB, { expiresAt: new Date(Date.now() + DEMO_HOURS * 3600_000) }));
  return { ok: true, user };
}

/** Expired demos go, with everything in them. */
export async function cleanup(conn: Connection) {
  const removed = await conn.db
    .delete(s.users)
    .where(and(eq(s.users.isDemo, true), lt(s.users.expiresAt, new Date())))
    .returning({ id: s.users.id });
  await conn.db.delete(s.attempts).where(lt(s.attempts.at, new Date(Date.now() - 86_400_000)));
  return { removed: removed.length };
}

export async function cleanupIfDue(conn: Connection) {
  if (await claim(conn, "cleanup", 3600)) await cleanup(conn);
}
