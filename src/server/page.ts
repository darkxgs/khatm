import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getConnection } from "@/db";
import { todayIn } from "@/lib/dates";
import { dict, isLang } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { requireAccount } from "./auth";

/** Everything a signed-in page starts from: language, words, the account, the database, and today's date where the business is. */
export async function appPage(params: Promise<{ lang: string }>) {
  await connection();
  const { lang: l } = await params;
  if (!isLang(l)) notFound();
  const lang: Lang = l;
  const conn = await getConnection();
  const account = await requireAccount(lang, conn);
  const today = todayIn(account.business.timezone);
  return { lang, t: dict(lang), account, business: account.business, conn, db: conn.db, today };
}
