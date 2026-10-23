import { describe, expect, it } from "vitest";
import { decodeQr, encodeQr, isSaudiIban, isVatNumber } from "@/lib/zatca";

describe("ZATCA QR (phase one)", () => {
  it("matches the example in ZATCA's guideline byte for byte", () => {
    const qr = encodeQr({ sellerName: "Bobs Records", vatNumber: "310122393500003", timestamp: "2022-04-25T15:30:00Z", total: "1000.00", vat: "150.00" });
    expect(qr).toBe("AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==");
  });

  it("counts Arabic names in bytes, not characters, and reads them back", () => {
    const qr = encodeQr({ sellerName: "استوديو نقش", vatNumber: "399999999900003", timestamp: "2026-10-23T14:05:00Z", total: "1150.00", vat: "150.00" });
    const tags = decodeQr(qr);
    expect(tags.map((t) => t.tag)).toEqual([1, 2, 3, 4, 5]);
    expect(tags[0]).toEqual({ tag: 1, value: "استوديو نقش", bytes: 21 });
    expect(tags[3].value).toBe("1150.00");
  });

  it("refuses a field too long for a one-byte length", () => {
    expect(() => encodeQr({ sellerName: "ا".repeat(200), vatNumber: "399999999900003", timestamp: "x", total: "1", vat: "0" })).toThrow();
  });
});

describe("identifiers", () => {
  it("checks VAT numbers", () => {
    expect(isVatNumber("399999999900003")).toBe(true);
    expect(isVatNumber("399999999900004")).toBe(false);
    expect(isVatNumber("29999999990000")).toBe(false);
  });
  it("checks Saudi IBANs with mod 97", () => {
    expect(isSaudiIban("SA03 8000 0000 6080 1016 7519")).toBe(true);
    expect(isSaudiIban("SA03 8000 0000 6080 1016 7518")).toBe(false);
    expect(isSaudiIban("GB82WEST12345698765432")).toBe(false);
  });
});
