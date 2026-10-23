import "server-only";
import { randomBytes } from "node:crypto";
import { getConnection } from "@/db";
import { rawQuery } from "@/db/raw";

// The keys Khatm signs and hashes with. A key set in the environment wins
// (AUTH_SECRET, RATE_SALT). Without one, the first request makes a random key
// and keeps it in the database, where every server instance finds the same
// one. A fresh deployment is safe before anyone sets a secret, and nothing
// guessable, like a URL or a project id, ever signs a cookie.

export type KeyName = "session" | "rate";

const ENV: Record<KeyName, string> = { session: "AUTH_SECRET", rate: "RATE_SALT" };
const loaded = new Map<KeyName, Promise<string>>();

export function appKey(name: KeyName): Promise<string> {
  const env = process.env[ENV[name]];
  if (env && env.length >= 16) return Promise.resolve(env);
  let key = loaded.get(name);
  if (!key) {
    if (env) console.warn(`[keys] ${ENV[name]} is shorter than 16 characters; using the key kept in the database.`);
    key = load(name).catch((err) => {
      loaded.delete(name);
      throw err;
    });
    loaded.set(name, key);
  }
  return key;
}

async function load(name: KeyName): Promise<string> {
  const { raw } = await getConnection();
  // Two statements, not one: the select needs a snapshot taken after a racing
  // instance's insert has committed, so both instances read the same key.
  await rawQuery(raw, `INSERT INTO khatm.app_keys (name, value) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`, [
    name,
    randomBytes(32).toString("base64url"),
  ]);
  const [row] = await rawQuery<{ value: string }>(raw, `SELECT value FROM khatm.app_keys WHERE name = $1`, [name]);
  if (!row) throw new Error(`The ${name} key is missing`);
  return row.value;
}
