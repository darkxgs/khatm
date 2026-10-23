import type { DB } from "./index";

/** A Drizzle transaction handle (or the database itself: both run queries). */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Q = DB | Tx;

/** postgres.js returns rows as an array, PGlite as { rows }. */
export function rowsOf<T>(r: unknown): T[] {
  return (Array.isArray(r) ? r : ((r as { rows?: T[] }).rows ?? [])) as T[];
}
