// Saudi e-invoicing (ZATCA) helpers that run anywhere: the phase-one QR code,
// and checks for the identifiers a tax invoice has to carry.

export type QrFields = {
  sellerName: string;
  vatNumber: string;
  /** ISO 8601 with time zone, e.g. 2026-10-23T14:05:00Z */
  timestamp: string;
  /** Invoice total including VAT, two decimals: "1150.00" */
  total: string;
  /** VAT total, two decimals: "150.00" */
  vat: string;
};

const TAGS: (keyof QrFields)[] = ["sellerName", "vatNumber", "timestamp", "total", "vat"];

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(text: string): Uint8Array {
  const bin = atob(text.replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * The QR payload for a phase-one (generation phase) invoice: five fields,
 * each written as tag (1 byte), length (1 byte) and UTF-8 value, then the
 * whole byte string in Base64.
 */
export function encodeQr(f: QrFields): string {
  const enc = new TextEncoder();
  const parts: number[] = [];
  TAGS.forEach((key, i) => {
    const value = enc.encode(f[key]);
    if (value.length > 255) throw new Error(`${key} is too long for the QR code`);
    parts.push(i + 1, value.length, ...value);
  });
  return toBase64(Uint8Array.from(parts));
}

export type DecodedTag = { tag: number; value: string; bytes: number };

/** Reads any TLV payload back: tags 1–5 as text, longer phase-two tags as hex. */
export function decodeQr(base64: string): DecodedTag[] {
  const bytes = fromBase64(base64);
  const dec = new TextDecoder("utf-8", { fatal: false });
  const out: DecodedTag[] = [];
  let i = 0;
  while (i < bytes.length) {
    if (i + 2 > bytes.length) throw new Error("truncated");
    const tag = bytes[i];
    const len = bytes[i + 1];
    const value = bytes.slice(i + 2, i + 2 + len);
    if (value.length !== len) throw new Error("truncated");
    out.push({ tag, bytes: len, value: tag <= 5 ? dec.decode(value) : [...value].map((b) => b.toString(16).padStart(2, "0")).join("") });
    i += 2 + len;
  }
  return out;
}

/** A VAT registration number: 15 digits, starting and ending with 3. */
export const isVatNumber = (v: string) => /^3\d{13}3$/.test(v);

/** A commercial registration number: 10 digits. */
export const isCrNumber = (v: string) => /^\d{10}$/.test(v);

/** A Saudi IBAN (SA + 22 characters) with a valid ISO 13616 check (mod 97). */
export function isSaudiIban(raw: string): boolean {
  const v = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^SA\d{2}[0-9A-Z]{20}$/.test(v)) return false;
  const moved = v.slice(4) + v.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const d of digits) rem = (rem * 10 + Number(d)) % 97;
  return rem === 1;
}

export const formatIban = (raw: string) =>
  raw
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/(.{4})/g, "$1 ")
    .trim();

/** VAT categories as ZATCA names them: standard, zero-rated, exempt, out of scope. */
export type VatCategory = "S" | "Z" | "E" | "O";
export const VAT_RATES: Record<VatCategory, number> = { S: 1500, Z: 0, E: 0, O: 0 };
