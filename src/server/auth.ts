import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getConnection, type Connection } from "@/db";
import { attempts, businesses, users, type Business, type User } from "@/db/schema";
import type { Lang } from "@/lib/types";

// Accounts are an email and a password (hashed with scrypt); the session is a
// signed cookie. Demo accounts have no email and expire with their data.

export const SESSION_COOKIE = "khatm_session";
const DAY = 86_400_000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.VERCEL_ENV === "production") throw new Error("AUTH_SECRET is not set");
  return "khatm-local-development-secret";
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function sessionToken(uid: string, exp: number): string {
  const payload = Buffer.from(JSON.stringify({ uid, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): { uid: string; exp: number } | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const want = Buffer.from(sign(payload));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const v = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid: string; exp: number };
    return typeof v.uid === "string" && v.exp > Date.now() ? v : null;
  } catch {
    return null;
  }
}

export async function startSession(u: Pick<User, "id" | "expiresAt">) {
  const exp = u.expiresAt ? u.expiresAt.getTime() : Date.now() + 30 * DAY;
  (await cookies()).set(SESSION_COOKIE, sessionToken(u.id, exp), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(exp),
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export type Account = { user: User; business: Business };

/** The signed-in user and their business, or null. Expired demos count as signed out. */
export async function currentAccount(conn?: Connection): Promise<Account | null> {
  const t = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!t) return null;
  const c = conn ?? (await getConnection());
  const [row] = await c.db.select({ user: users, business: businesses }).from(users).innerJoin(businesses, eq(businesses.ownerId, users.id)).where(eq(users.id, t.uid));
  if (!row) return null;
  if (row.user.isDemo && row.user.expiresAt && row.user.expiresAt.getTime() < Date.now()) return null;
  return row;
}

/** For pages behind sign-in. */
export async function requireAccount(lang: Lang, conn?: Connection): Promise<Account> {
  const a = await currentAccount(conn);
  if (!a) redirect(`/${lang}/signin`);
  return a;
}

export async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return createHash("sha256")
    .update(`${process.env.RATE_SALT ?? secret()}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

/** Counts an attempt against a sliding window; false when the limit is reached. */
export async function allowAttempt(conn: Connection, key: string, max: number, windowSec: number): Promise<boolean> {
  const since = new Date(Date.now() - windowSec * 1000);
  const [{ n }] = await conn.db
    .select({ n: sql<number>`count(*)::int` })
    .from(attempts)
    .where(and(eq(attempts.key, key), gt(attempts.at, since)));
  if (n >= max) return false;
  await conn.db.insert(attempts).values({ key, at: new Date() });
  return true;
}

/** The server's clock, read outside component bodies. */
export const serverNow = () => Date.now();
