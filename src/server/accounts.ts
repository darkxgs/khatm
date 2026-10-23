import "server-only";
import { eq } from "drizzle-orm";
import type { Connection } from "@/db";
import * as s from "@/db/schema";
import { newId } from "@/lib/id";
import { allowAttempt } from "./auth";
import { hashPassword, verifyPassword } from "./password";

// Real accounts: an email, a password and one business. A new business starts
// empty; the settings page asks for what a tax invoice needs before the first
// one can be issued.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PASSWORD_MIN = 10;

export const normalizeEmail = (v: string) => v.trim().toLowerCase();

export type SignUpError = "email" | "password" | "name" | "taken" | "rate";

export async function signUp(
  conn: Connection,
  ipHash: string,
  input: { email: string; password: string; businessName: string; lang: "ar" | "en" },
): Promise<{ ok: true; user: s.User } | { ok: false; error: SignUpError }> {
  const email = normalizeEmail(input.email);
  const name = input.businessName.trim().slice(0, 120);
  if (!EMAIL_RE.test(email) || email.length > 200) return { ok: false, error: "email" };
  if (input.password.length < PASSWORD_MIN || input.password.length > 200) return { ok: false, error: "password" };
  if (!name) return { ok: false, error: "name" };
  if (!(await allowAttempt(conn, `signup:${ipHash}`, process.env.NODE_ENV === "production" ? 5 : 1000, 3600))) return { ok: false, error: "rate" };

  const uid = newId("usr");
  const passwordHash = hashPassword(input.password);
  try {
    await conn.db.transaction(async (tx) => {
      await tx.insert(s.users).values({ id: uid, email, passwordHash, name: null, isDemo: false, expiresAt: null });
      // The name goes in the language they signed up in; the other is filled in settings.
      await tx.insert(s.businesses).values({
        id: newId("biz"),
        ownerId: uid,
        nameAr: input.lang === "ar" ? name : "",
        nameEn: input.lang === "en" ? name : "",
        invoicePrefix: "INV",
        creditPrefix: "CRN",
        quotePrefix: "QUO",
        nextInvoice: 1,
        nextCredit: 1,
        nextQuote: 1,
        termsDays: 14,
        timezone: "Asia/Riyadh",
      });
    });
  } catch (err) {
    // Drizzle wraps the driver's error; the unique violation is underneath.
    const code = (err as { code?: string }).code ?? (err as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") return { ok: false, error: "taken" };
    throw err;
  }
  const [user] = await conn.db.select().from(s.users).where(eq(s.users.id, uid));
  return { ok: true, user };
}

export async function signIn(conn: Connection, ipHash: string, emailRaw: string, password: string): Promise<{ ok: true; user: s.User } | { ok: false; error: "wrong" | "rate" }> {
  const email = normalizeEmail(emailRaw);
  const max = process.env.NODE_ENV === "production" ? 10 : 1000;
  if (!(await allowAttempt(conn, `signin:${ipHash}`, max, 900)) || !(await allowAttempt(conn, `signin:${email}`, max, 900))) return { ok: false, error: "rate" };
  const [user] = await conn.db.select().from(s.users).where(eq(s.users.email, email));
  // Hash anyway when there's no such user, so timing doesn't tell which emails exist.
  const ok = user?.passwordHash ? verifyPassword(password, user.passwordHash) : (verifyPassword(password, dummyHash()), false);
  return ok && user ? { ok: true, user } : { ok: false, error: "wrong" };
}

let dummy: string | null = null;
const dummyHash = () => (dummy ??= hashPassword("not-a-real-password"));
