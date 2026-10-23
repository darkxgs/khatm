import "server-only";
import { headers } from "next/headers";

/** Where share links point: a fixed public URL if set, else the host this page was opened on. */
export async function publicOrigin(): Promise<string> {
  if (process.env.KHATM_PUBLIC_URL) return process.env.KHATM_PUBLIC_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** For metadata (no request in scope): the configured or production origin. */
export function staticOrigin(): string {
  if (process.env.KHATM_PUBLIC_URL) return process.env.KHATM_PUBLIC_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
