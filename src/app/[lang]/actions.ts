"use server";

import { redirect } from "next/navigation";
import { getConnection } from "@/db";
import { isLang } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { signIn, signUp, type SignUpError } from "@/server/accounts";
import { clientIpHash, endSession, startSession } from "@/server/auth";
import { cleanupIfDue, startDemo } from "@/server/demo";

const langOf = (v: FormDataEntryValue | null): Lang => (typeof v === "string" && isLang(v) ? v : "ar");

export type FormState = { error: string | null; values?: Record<string, string> };

/** Opens a fresh copy of the demo business for this visitor and signs them into it. */
export async function startDemoAction(_prev: FormState, form: FormData): Promise<FormState> {
  const lang = langOf(form.get("lang"));
  const conn = await getConnection();
  await cleanupIfDue(conn);
  const res = await startDemo(conn, await clientIpHash());
  if (!res.ok) return { error: res.error };
  await startSession(res.user);
  redirect(`/${lang}/app`);
}

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  const lang = langOf(form.get("lang"));
  const email = String(form.get("email") ?? "");
  const conn = await getConnection();
  const res = await signIn(conn, await clientIpHash(), email, String(form.get("password") ?? ""));
  if (!res.ok) return { error: res.error, values: { email } };
  await startSession(res.user);
  redirect(`/${lang}/app`);
}

export async function signUpAction(_prev: FormState, form: FormData): Promise<FormState> {
  const lang = langOf(form.get("lang"));
  const email = String(form.get("email") ?? "");
  const businessName = String(form.get("businessName") ?? "");
  const conn = await getConnection();
  const res = await signUp(conn, await clientIpHash(), { email, password: String(form.get("password") ?? ""), businessName, lang });
  if (!res.ok) return { error: res.error satisfies SignUpError, values: { email, businessName } };
  await startSession(res.user);
  redirect(`/${lang}/app/settings?welcome=1`);
}

export async function signOutAction(form: FormData) {
  const lang = langOf(form.get("lang"));
  await endSession();
  redirect(`/${lang}`);
}
