import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijkmnopqrstuvwxyz";
const short = customAlphabet(alphabet, 14);
const token = customAlphabet("23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", 22);

/** Prefixed, URL-safe ids: `doc_7h2k...`. The prefix makes logs readable. */
export const newId = (prefix: string) => `${prefix}_${short()}`;

/** The unguessable part of a document's share link. */
export const newShareToken = () => token();
