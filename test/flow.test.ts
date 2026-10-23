import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getConnection, type Connection } from "@/db";
import * as s from "@/db/schema";
import { documentTotals } from "@/lib/amounts";
import { todayIn } from "@/lib/dates";
import { decodeQr } from "@/lib/zatca";
import { signIn, signUp } from "@/server/accounts";
import { saveCustomer, updateBusiness, saveProduct, customerBalance } from "@/server/business";
import { cleanup, createDemoAccount } from "@/server/demo";
import { convertQuote, issue, recordPayment, saveDraft, startCreditNote, deletePayment, duplicate, type LineIn } from "@/server/docs";
import { dashboard, documentByToken, documentDetail, listDocuments, summaryOf, vatReturn } from "@/server/queries";
import { markViewed } from "@/server/docs";
import { readSessionToken, sessionToken } from "@/server/auth";
import { appKey } from "@/server/keys";
import { rawQuery } from "@/db/raw";

let conn: Connection;
const TZ = "Asia/Riyadh";
const today = () => todayIn(TZ);
const biz = async (id: string) => (await conn.db.select().from(s.businesses).where(eq(s.businesses.id, id)))[0];

beforeAll(async () => {
  conn = await getConnection();
});

describe("the demo business", () => {
  let bid: string;
  beforeAll(async () => {
    const { business } = await createDemoAccount(conn.db, { expiresAt: new Date(Date.now() + 3600_000) });
    bid = business.id;
  });

  it("has six months of history, numbered in the order it happened", async () => {
    const all = await listDocuments(conn.db, bid, today());
    const invoices = all.filter((d) => (d.kind === "tax" || d.kind === "simplified") && d.status === "issued");
    const byDate = [...invoices].sort((a, b) => (a.issueDate! < b.issueDate! ? -1 : a.issueDate! > b.issueDate! ? 1 : a.number!.localeCompare(b.number!)));
    expect(byDate.map((d) => d.number)).toEqual(invoices.map((d) => d.number).sort());
    expect(invoices.map((d) => d.number).sort()[0]).toBe("INV-00001");
    expect(invoices).toHaveLength(14);

    const credits = all.filter((d) => d.kind === "credit");
    expect(credits.map((d) => [d.number, d.state])).toEqual([["CRN-00001", "issued"]]);
    const quotes = all.filter((d) => d.kind === "quote").sort((a, b) => a.number!.localeCompare(b.number!));
    expect(quotes.map((d) => [d.number, d.state])).toEqual([
      ["QUO-00001", "accepted"],
      ["QUO-00002", "sent"],
    ]);
    expect(all.filter((d) => d.state === "draft")).toHaveLength(2);
    // Drafts come first in the list.
    expect(all.slice(0, 2).every((d) => d.state === "draft")).toBe(true);
  });

  it("has invoices in every state", async () => {
    const invoices = await listDocuments(conn.db, bid, today(), "invoices");
    const count = (state: string) => invoices.filter((d) => d.state === state).length;
    expect(count("overdue")).toBe(3);
    expect(count("unpaid")).toBe(2);
    expect(count("paid")).toBe(9);
    // The cancelled month was credited; the rest of that invoice was paid.
    const rewaq = invoices.find((d) => d.credited > 0)!;
    expect(rewaq).toMatchObject({ state: "paid", balance: 0 });
    expect(rewaq.paid + rewaq.credited).toBe(rewaq.total);
  });

  it("adds up on the dashboard", async () => {
    const d = await dashboard(conn.db, bid, today());
    const open = (await listDocuments(conn.db, bid, today(), "unpaid")).reduce((a, x) => a + x.balance, 0);
    expect(d.outstanding).toBe(open);
    expect(d.aging.reduce((a, b) => a + b.amount, 0)).toBe(d.outstanding);
    expect(d.overdueCount).toBe(3);
    expect(d.overdue).toBe(d.aging.slice(1).reduce((a, b) => a + b.amount, 0));
    expect(d.months).toHaveLength(6);
    expect(d.months.at(-1)!.key).toBe(today().slice(0, 7));
    expect(d.months.every((m) => m.sales >= 0)).toBe(true);
  });

  it("nets the credit note off in the VAT return", async () => {
    const r = await vatReturn(conn.db, bid, "2000-01-01", today());
    const docs = await conn.db.select().from(s.documents).where(eq(s.documents.businessId, bid));
    const issued = docs.filter((d) => d.status === "issued" && d.kind !== "quote");
    const vat = issued.reduce((a, d) => a + (d.kind === "credit" ? -d.vat : d.vat), 0);
    const net = issued.reduce((a, d) => a + (d.kind === "credit" ? -d.taxable : d.taxable), 0);
    expect({ net: r.totals.net, vat: r.totals.vat }).toEqual({ net, vat });
    // The demo's zero-rated sales are all to a customer in Dubai: exports.
    const exports = r.rows.find((x) => x.key === "Zx")!;
    expect(exports.vat).toBe(0);
    expect(exports.net).toBeGreaterThan(0);
    expect(r.rows.find((x) => x.key === "Zd")!.net).toBe(0);
    expect(r.rows.find((x) => x.key === "S")!.credits).toBe(650_000);
  });
});

describe("a new account", () => {
  let business: s.Business;
  let customerId: string;
  const line = (over: Partial<LineIn> = {}): LineIn => ({
    nameAr: "تصميم شعار",
    nameEn: "Logo design",
    unitAr: "تصميم",
    unitEn: "design",
    qtyMilli: 1000,
    unitPrice: 100_000,
    discountBps: 0,
    vat: "S",
    ...over,
  });
  const draft = (kind: s.DocKind, lines: LineIn[], extra: Partial<Parameters<typeof saveDraft>[3]> = {}) =>
    saveDraft(conn.db, business, null, { kind, customerId, issueDate: null, supplyDate: null, dueDate: null, notesAr: null, notesEn: null, lines, ...extra });

  beforeAll(async () => {
    const res = await signUp(conn, "ip-test", { email: "  Owner@Example.com ", password: "correct horse battery", businessName: "Test Studio", lang: "en" });
    if (!res.ok) throw new Error(res.error);
    business = (await conn.db.select().from(s.businesses).where(eq(s.businesses.ownerId, res.user.id)))[0];
    const c = await saveCustomer(conn.db, business.id, null, { kind: "business", nameAr: "شركة الاختبار", nameEn: "Test Buyer Co", vatNumber: "300000000000003", country: "SA" });
    if (!c.ok) throw new Error(JSON.stringify(c.errors));
    customerId = c.id;
  });

  it("signs in with the email in any case, and not with the wrong password", async () => {
    expect(await signUp(conn, "ip-test", { email: "owner@example.com", password: "another password", businessName: "X", lang: "en" })).toEqual({ ok: false, error: "taken" });
    expect((await signIn(conn, "ip-test", "OWNER@example.com", "correct horse battery")).ok).toBe(true);
    expect(await signIn(conn, "ip-test", "owner@example.com", "wrong password!")).toEqual({ ok: false, error: "wrong" });
    expect(await signIn(conn, "ip-test", "nobody@example.com", "correct horse battery")).toEqual({ ok: false, error: "wrong" });
    const [u] = await conn.db.select().from(s.users).where(eq(s.users.email, "owner@example.com"));
    expect(u.passwordHash).not.toContain("correct");
  });

  it("checks Saudi identifiers in settings", async () => {
    const bad = await updateBusiness(conn.db, business, { nameEn: "Test Studio", vatNumber: "123", crNumber: "12", iban: "SA0380000000608010167518", postalCode: "123", invoicePrefix: "inv 1" });
    expect(bad).toEqual({ ok: false, errors: { vatNumber: "vat", crNumber: "cr", iban: "iban", postalCode: "postal", invoicePrefix: "prefix" } });
  });

  it("won't issue a tax invoice until the seller and the buyer are complete", async () => {
    const d = await draft("tax", [line()]);
    if (!d.ok) throw new Error(d.error);
    expect(await issue(conn.db, business, d.id)).toEqual({ ok: false, error: "seller_vat" });
    const up = await updateBusiness(conn.db, business, {
      nameAr: "استوديو الاختبار",
      nameEn: "Test Studio",
      vatNumber: "399999999900003",
      buildingNo: "١٢٣٤",
      streetEn: "King Fahd Rd",
      cityEn: "Riyadh",
      postalCode: "12345",
      iban: "SA03 8000 0000 6080 1016 7519",
    });
    expect(up.ok).toBe(true);
    business = await biz(business.id);
    expect(business.buildingNo).toBe("1234");
    expect(business.iban).toBe("SA0380000000608010167519");
    expect(await issue(conn.db, business, d.id)).toEqual({ ok: false, error: "buyer_address" });
    await saveCustomer(conn.db, business.id, customerId, {
      kind: "business",
      nameAr: "شركة الاختبار",
      nameEn: "Test Buyer Co",
      vatNumber: "300000000000003",
      streetAr: "شارع العليا",
      cityAr: "الرياض",
      country: "SA",
    });
  });

  it("numbers on issue, freezes both parties and writes the QR code", async () => {
    const d = await draft("tax", [line({ qtyMilli: 2500, unitPrice: 40_000 }), line({ nameEn: "Hosting", nameAr: "استضافة", unitPrice: 50_000, discountBps: 1000 })]);
    if (!d.ok) throw new Error(d.error);
    const at = new Date("2026-10-23T09:15:42.123Z");
    const r = await issue(conn.db, business, d.id, at);
    expect(r).toEqual({ ok: true, number: "INV-00001" });
    const det = (await documentDetail(conn.db, business.id, d.id))!;
    // 2.5 × 400 = 1000; 500 less 10% = 450; VAT 15% on 1450 = 217.50.
    expect(det.doc).toMatchObject({ status: "issued", gross: 150_000, discount: 5_000, taxable: 145_000, vat: 21_750, total: 166_750, issueDate: "2026-10-23", dueDate: "2026-11-06" });
    expect(decodeQr(det.doc.qr!).map((x) => x.value)).toEqual(["استوديو الاختبار", "399999999900003", "2026-10-23T09:15:42Z", "1667.50", "217.50"]);
    expect(det.doc.buyer).toMatchObject({ nameEn: "Test Buyer Co", vatNumber: "300000000000003" });

    // Renaming the customer later leaves the issued invoice as it was.
    await saveCustomer(conn.db, business.id, customerId, {
      kind: "business",
      nameAr: "شركة الاختبار",
      nameEn: "Renamed Co",
      vatNumber: "300000000000003",
      streetAr: "شارع العليا",
      cityAr: "الرياض",
      country: "SA",
    });
    expect((await documentDetail(conn.db, business.id, d.id))!.doc.buyer!.nameEn).toBe("Test Buyer Co");
    // And it can't be edited any more.
    expect(await saveDraft(conn.db, business, d.id, { kind: "tax", customerId, issueDate: null, supplyDate: null, dueDate: null, notesAr: null, notesEn: null, lines: [line()] })).toEqual({
      ok: false,
      error: "not_draft",
    });
    expect(await issue(conn.db, business, d.id)).toEqual({ ok: false, error: "not_draft" });
  });

  it("keeps one sequence for invoices and separate ones for quotations and credit notes", async () => {
    const simple = await draft("simplified", [line()], { customerId: null });
    const quote = await draft("quote", [line()]);
    if (!simple.ok || !quote.ok) throw new Error("draft");
    expect(await issue(conn.db, business, simple.id)).toEqual({ ok: true, number: "INV-00002" });
    expect(await issue(conn.db, business, quote.id)).toEqual({ ok: true, number: "QUO-00001" });
    // Quotations carry no QR code; simplified invoices do, with no buyer.
    const q = (await documentDetail(conn.db, business.id, quote.id))!.doc;
    expect(q.qr).toBeNull();
    const sDoc = (await documentDetail(conn.db, business.id, simple.id))!.doc;
    expect(sDoc.buyer).toBeNull();
    expect(decodeQr(sDoc.qr!)).toHaveLength(5);
  });

  it("lets a draft change kind, but not into or out of a credit note", async () => {
    const d = await draft("tax", [line()]);
    if (!d.ok) throw new Error(d.error);
    const base = { customerId, issueDate: null, supplyDate: null, dueDate: null, notesAr: null, notesEn: null, lines: [line()] };
    expect(await saveDraft(conn.db, business, d.id, { kind: "quote", ...base })).toEqual({ ok: true, id: d.id });
    expect((await documentDetail(conn.db, business.id, d.id))!.doc.kind).toBe("quote");
    expect(await saveDraft(conn.db, business, d.id, { kind: "credit", ...base })).toEqual({ ok: false, error: "reference" });
    expect(await saveDraft(conn.db, business, null, { kind: "credit", ...base })).toEqual({ ok: false, error: "reference" });
    expect((await saveDraft(conn.db, business, null, { kind: "bogus" as s.DocKind, ...base })).ok).toBe(false);
  });

  it("works out totals on the server, whatever the browser sent", async () => {
    const lines = [line({ qtyMilli: 3000, unitPrice: 33_333 }), line({ unitPrice: 1, vat: "Z" }), line({ unitPrice: 99_999, discountBps: 333 })];
    const d = await draft("tax", lines);
    if (!d.ok) throw new Error(d.error);
    const doc = (await documentDetail(conn.db, business.id, d.id))!.doc;
    const want = documentTotals(lines);
    expect({ taxable: doc.taxable, vat: doc.vat, total: doc.total }).toEqual({ taxable: want.taxable, vat: want.vat, total: want.total });
    expect(await draft("tax", [])).toEqual({ ok: false, error: "lines" });
    expect(await draft("tax", [line({ qtyMilli: 0 })])).toEqual({ ok: false, error: "line", index: 0 });
    expect(await draft("tax", [line(), line({ nameAr: " ", nameEn: "" })])).toEqual({ ok: false, error: "line", index: 1 });
  });

  it("tracks payments to the halala", async () => {
    const d = await draft("tax", [line({ unitPrice: 200_000 })]); // 2,000 + VAT = 2,300
    if (!d.ok) throw new Error(d.error);
    expect((await recordPayment(conn.db, business.id, d.id, { amount: 100, paidOn: today(), method: "cash", note: null })).ok).toBe(false); // a draft
    await issue(conn.db, business, d.id);
    const first = await recordPayment(conn.db, business.id, d.id, { amount: 100_000, paidOn: today(), method: "transfer", note: "  first half " });
    expect(first).toMatchObject({ ok: true, settled: false });
    expect((await summaryOf(conn.db, business.id, d.id, today()))!).toMatchObject({ state: "partial", balance: 130_000 });
    expect(await recordPayment(conn.db, business.id, d.id, { amount: 130_001, paidOn: today(), method: "transfer", note: null })).toEqual({ ok: false, error: "amount" });
    const last = await recordPayment(conn.db, business.id, d.id, { amount: 130_000, paidOn: today(), method: "card", note: null });
    expect(last).toMatchObject({ ok: true, settled: true });
    expect((await summaryOf(conn.db, business.id, d.id, today()))!).toMatchObject({ state: "paid", balance: 0 });
    // Taking a payment back reopens the invoice.
    if (!last.ok) throw new Error();
    await deletePayment(conn.db, business.id, last.id);
    expect((await summaryOf(conn.db, business.id, d.id, today()))!.state).toBe("partial");
  });

  it("marks an unpaid invoice overdue after its due date", async () => {
    const d = await draft("tax", [line()], { issueDate: "2026-01-01", dueDate: "2026-01-15" });
    if (!d.ok) throw new Error(d.error);
    await issue(conn.db, business, d.id);
    expect((await summaryOf(conn.db, business.id, d.id, "2026-01-15"))!.state).toBe("unpaid");
    expect((await summaryOf(conn.db, business.id, d.id, "2026-01-16"))!.state).toBe("overdue");
  });

  it("corrects an invoice with credit notes, never more than it was for", async () => {
    const inv = await draft("tax", [line({ qtyMilli: 4000 })]); // 4,000 + VAT = 4,600
    if (!inv.ok) throw new Error(inv.error);
    await issue(conn.db, business, inv.id);
    const cn = await startCreditNote(conn.db, business, inv.id);
    if (!cn.ok) throw new Error(cn.error);
    expect(await issue(conn.db, business, cn.id)).toEqual({ ok: false, error: "reason" });
    const half = {
      kind: "credit" as const,
      customerId,
      issueDate: null,
      supplyDate: null,
      dueDate: null,
      notesAr: null,
      notesEn: null,
      reasonEn: "Two logos cancelled",
      referenceId: inv.id,
      lines: [line({ qtyMilli: 2000 })],
    };
    await saveDraft(conn.db, business, cn.id, half);
    expect(await issue(conn.db, business, cn.id)).toEqual({ ok: true, number: "CRN-00001" });
    expect((await summaryOf(conn.db, business.id, inv.id, today()))!).toMatchObject({ state: "partial", credited: 230_000, balance: 230_000 });

    // A second note for three more logos would credit more than the invoice.
    const cn2 = await startCreditNote(conn.db, business, inv.id);
    if (!cn2.ok) throw new Error(cn2.error);
    await saveDraft(conn.db, business, cn2.id, { ...half, lines: [line({ qtyMilli: 3000 })] });
    expect(await issue(conn.db, business, cn2.id)).toEqual({ ok: false, error: "credit_exceeds" });
    await saveDraft(conn.db, business, cn2.id, half);
    expect(await issue(conn.db, business, cn2.id)).toEqual({ ok: true, number: "CRN-00002" });
    expect((await summaryOf(conn.db, business.id, inv.id, today()))!).toMatchObject({ state: "credited", balance: 0 });
    // Nothing left to pay, and nothing left to credit.
    expect(await recordPayment(conn.db, business.id, inv.id, { amount: 1, paidOn: today(), method: "cash", note: null })).toEqual({ ok: false, error: "amount" });
    // Credit notes can't be paid, and quotations can't be credited.
    expect((await recordPayment(conn.db, business.id, cn.id, { amount: 1, paidOn: today(), method: "cash", note: null })).ok).toBe(false);
  });

  it("turns an accepted quotation into an invoice with the same lines", async () => {
    const q = await draft("quote", [line({ qtyMilli: 3000 }), line({ nameEn: "Photography", nameAr: "تصوير", unitPrice: 320_000 })]);
    if (!q.ok) throw new Error(q.error);
    expect((await convertQuote(conn.db, business, q.id, "tax")).ok).toBe(false); // still a draft
    await issue(conn.db, business, q.id);
    expect((await summaryOf(conn.db, business.id, q.id, today()))!.state).toBe("sent");
    const inv = await convertQuote(conn.db, business, q.id, "tax");
    if (!inv.ok) throw new Error(inv.error);
    const det = (await documentDetail(conn.db, business.id, inv.id))!;
    expect(det.doc).toMatchObject({ kind: "tax", status: "draft", referenceId: q.id });
    expect(det.lines.map((l) => [l.nameEn, l.qtyMilli])).toEqual([
      ["Logo design", 3000],
      ["Photography", 1000],
    ]);
    expect((await summaryOf(conn.db, business.id, q.id, today()))!.state).toBe("accepted");
    // The invoice page links back to the quotation, and the quotation to its invoice.
    expect(det.related.map((r) => r.id)).toEqual([q.id]);
    expect((await documentDetail(conn.db, business.id, q.id))!.related.map((r) => r.id)).toEqual([inv.id]);
    const dup = await duplicate(conn.db, business, q.id);
    expect(dup.ok).toBe(true);
  });

  it("shows a shared document by its link, and notes the first time it's opened", async () => {
    const d = (await listDocuments(conn.db, business.id, today(), "invoices")).find((x) => x.status === "issued")!;
    const det = (await documentDetail(conn.db, business.id, d.id))!;
    expect(await documentByToken(conn.db, "short")).toBeNull();
    const shared = (await documentByToken(conn.db, det.doc.shareToken!))!;
    expect(shared.doc.id).toBe(d.id);
    expect(shared.doc.viewedAt).toBeNull();
    await markViewed(conn.db, d.id);
    const first = (await documentByToken(conn.db, det.doc.shareToken!))!.doc.viewedAt!;
    await markViewed(conn.db, d.id);
    expect((await documentByToken(conn.db, det.doc.shareToken!))!.doc.viewedAt!.getTime()).toBe(first.getTime());
  });

  it("keeps each business's documents to itself", async () => {
    const other = await createDemoAccount(conn.db, { expiresAt: new Date(Date.now() + 3600_000) });
    const [mine] = await listDocuments(conn.db, business.id, today());
    expect(await documentDetail(conn.db, other.business.id, mine.id)).toBeNull();
    expect((await recordPayment(conn.db, other.business.id, mine.id, { amount: 1, paidOn: today(), method: "cash", note: null })).ok).toBe(false);
    expect((await saveDraft(conn.db, other.business, null, { kind: "tax", customerId, issueDate: null, supplyDate: null, dueDate: null, notesAr: null, notesEn: null, lines: [line()] })).ok).toBe(
      false,
    );
    expect((await saveProduct(conn.db, other.business.id, "prd_nothere", { nameEn: "X", price: 1 })).ok).toBe(false);
  });

  it("sums a customer's account", async () => {
    const b = await customerBalance(conn.db, business.id, customerId);
    const docs = await listDocuments(conn.db, business.id, today(), "invoices", "", customerId);
    expect(b.balance).toBe(docs.filter((d) => d.status === "issued").reduce((a, d) => a + d.balance, 0));
  });
});

describe("cleanup", () => {
  it("removes expired demos and everything in them", async () => {
    const { user, business } = await createDemoAccount(conn.db, { expiresAt: new Date(Date.now() - 1000) });
    const before = await conn.db.select().from(s.documents).where(eq(s.documents.businessId, business.id));
    expect(before.length).toBeGreaterThan(10);
    const { removed } = await cleanup(conn);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await conn.db.select().from(s.users).where(eq(s.users.id, user.id))).toHaveLength(0);
    expect(await conn.db.select().from(s.documents).where(eq(s.documents.businessId, business.id))).toHaveLength(0);
    expect(await conn.db.select().from(s.payments).where(eq(s.payments.businessId, business.id))).toHaveLength(0);
  });
});

describe("keys and sessions", () => {
  it("makes its own keys once, keeps them in the database, and signs sessions with them", async () => {
    const session = await appKey("session");
    expect(session.length).toBeGreaterThanOrEqual(40);
    expect(await appKey("session")).toBe(session);
    expect(await appKey("rate")).not.toBe(session);
    const rows = await rawQuery<{ name: string; value: string }>(conn.raw, `SELECT name, value FROM khatm.app_keys ORDER BY name`);
    expect(rows.map((r) => r.name)).toEqual(["rate", "session"]);
    expect(rows.find((r) => r.name === "session")!.value).toBe(session);

    const exp = Date.now() + 60_000;
    const token = await sessionToken("usr_1", exp);
    expect(await readSessionToken(token)).toEqual({ uid: "usr_1", exp });
    const [payload, mac] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "usr_2", exp })).toString("base64url");
    expect(await readSessionToken(`${forged}.${mac}`)).toBeNull();
    expect(await readSessionToken(`${payload}.${mac.slice(0, -2)}xx`)).toBeNull();
    expect(await readSessionToken(await sessionToken("usr_1", Date.now() - 1000))).toBeNull();
  });
});
