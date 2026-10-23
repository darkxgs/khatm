"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getConnection } from "@/db";
import * as s from "@/db/schema";
import { isLang } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { currentAccount } from "@/server/auth";
import { archiveCustomer, archiveProduct, saveCustomer, saveProduct, updateBusiness, type BusinessIn, type CustomerIn, type FormResult, type ProductIn } from "@/server/business";
import {
  convertQuote,
  deleteDraft,
  deletePayment,
  duplicate,
  issue,
  recordPayment,
  saveDraft,
  startCreditNote,
  voidQuote,
  type DraftError,
  type DraftIn,
  type IssueError,
  type SaveResult,
} from "@/server/docs";

// Everything a signed-in page changes goes through here. Each action finds the
// account from the session cookie; nothing the browser sends can name another
// business.

async function ctx() {
  const conn = await getConnection();
  const account = await currentAccount(conn);
  if (!account) throw new Error("signed out");
  return { conn, db: conn.db, business: account.business };
}

const L = (l: string): Lang => (isLang(l) ? l : "ar");

export async function saveDraftAction(id: string | null, input: DraftIn): Promise<SaveResult> {
  const { db, business } = await ctx();
  return saveDraft(db, business, id, input);
}

export type IssueOutcome = { ok: true; id: string; number: string } | { ok: false; id: string | null; error: DraftError | IssueError; index?: number };

/** Saves the draft as it is on screen, then issues it. */
export async function saveAndIssueAction(id: string | null, input: DraftIn): Promise<IssueOutcome> {
  const { db, business } = await ctx();
  const saved = await saveDraft(db, business, id, input);
  if (!saved.ok) return { ok: false, id, error: saved.error, index: saved.index };
  const res = await issue(db, business, saved.id);
  return res.ok ? { ok: true, id: saved.id, number: res.number } : { ok: false, id: saved.id, error: res.error };
}

export async function recordPaymentAction(docId: string, p: { amount: number; paidOn: string; method: s.PayMethod; note: string | null }) {
  const { db, business } = await ctx();
  const res = await recordPayment(db, business.id, docId, p);
  if (res.ok) refresh();
  return res;
}

export async function deletePaymentAction(paymentId: string) {
  const { db, business } = await ctx();
  await deletePayment(db, business.id, paymentId);
  refresh();
}

export async function creditNoteAction(lang: string, invoiceId: string) {
  const { db, business } = await ctx();
  const res = await startCreditNote(db, business, invoiceId);
  if (!res.ok) return res;
  redirect(`/${L(lang)}/app/documents/${res.id}/edit`);
}

export async function convertQuoteAction(lang: string, quoteId: string, kind: "tax" | "simplified") {
  const { db, business } = await ctx();
  const res = await convertQuote(db, business, quoteId, kind);
  if (!res.ok) return res;
  redirect(`/${L(lang)}/app/documents/${res.id}/edit`);
}

export async function duplicateAction(lang: string, id: string) {
  const { db, business } = await ctx();
  const res = await duplicate(db, business, id);
  if (!res.ok) return res;
  redirect(`/${L(lang)}/app/documents/${res.id}/edit`);
}

export async function deleteDraftAction(lang: string, id: string) {
  const { db, business } = await ctx();
  await deleteDraft(db, business.id, id);
  redirect(`/${L(lang)}/app/documents`);
}

export async function voidQuoteAction(id: string) {
  const { db, business } = await ctx();
  await voidQuote(db, business.id, id);
  refresh();
}

export async function saveCustomerAction(id: string | null, input: CustomerIn): Promise<FormResult> {
  const { db, business } = await ctx();
  const res = await saveCustomer(db, business.id, id, input);
  if (res.ok) refresh();
  return res;
}

export async function archiveCustomerAction(lang: string, id: string) {
  const { db, business } = await ctx();
  await archiveCustomer(db, business.id, id);
  redirect(`/${L(lang)}/app/customers`);
}

export async function saveProductAction(id: string | null, input: ProductIn): Promise<FormResult> {
  const { db, business } = await ctx();
  const res = await saveProduct(db, business.id, id, input);
  if (res.ok) refresh();
  return res;
}

export async function archiveProductAction(id: string) {
  const { db, business } = await ctx();
  await archiveProduct(db, business.id, id);
  refresh();
}

export async function updateBusinessAction(input: BusinessIn): Promise<FormResult> {
  const { db, business } = await ctx();
  const res = await updateBusiness(db, business, input);
  if (res.ok) refresh();
  return res;
}
