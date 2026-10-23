import { connection } from "next/server";
import { getConnection } from "@/db";
import { cleanup, cleanupIfDue } from "@/server/demo";

/**
 * Daily, from Vercel Cron: expired demos go, with everything in them. With
 * CRON_SECRET set, only a request carrying it (Vercel Cron sends it) runs the
 * cleanup. Without one, anyone may call this, and it does what opening a demo
 * already does: clean up at most once an hour.
 */
export async function GET(req: Request) {
  await connection();
  const conn = await getConnection();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    await cleanupIfDue(conn);
    return Response.json({ ok: true });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await cleanup(conn));
}
