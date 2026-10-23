import { describe, expect, it } from "vitest";
import { amountInArabic, amountInEnglish, arabicCount, englishNumber, NOUNS } from "@/lib/tafqeet";

const riyal = (n: number) => arabicCount(n, NOUNS.riyal);
const halala = (n: number) => arabicCount(n, NOUNS.halala);

describe("Arabic amounts in words", () => {
  it("counts riyals the way Arabic counts", () => {
    expect(riyal(1)).toBe("ريال سعودي واحد");
    expect(riyal(2)).toBe("ريالان سعوديان");
    expect(riyal(3)).toBe("ثلاثة ريالات سعودية");
    expect(riyal(10)).toBe("عشرة ريالات سعودية");
    expect(riyal(11)).toBe("أحد عشر ريالًا سعوديًا");
    expect(riyal(12)).toBe("اثنا عشر ريالًا سعوديًا");
    expect(riyal(21)).toBe("واحد وعشرون ريالًا سعوديًا");
    expect(riyal(99)).toBe("تسعة وتسعون ريالًا سعوديًا");
    expect(riyal(100)).toBe("مئة ريال سعودي");
    expect(riyal(200)).toBe("مئتا ريال سعودي");
    expect(riyal(105)).toBe("مئة وخمسة ريالات سعودية");
    expect(riyal(250)).toBe("مئتان وخمسون ريالًا سعوديًا");
  });

  it("joins thousands and millions, with the construct state before the currency", () => {
    expect(riyal(1000)).toBe("ألف ريال سعودي");
    expect(riyal(2000)).toBe("ألفا ريال سعودي");
    expect(riyal(3000)).toBe("ثلاثة آلاف ريال سعودي");
    expect(riyal(11000)).toBe("أحد عشر ألف ريال سعودي");
    expect(riyal(1250)).toBe("ألف ومئتان وخمسون ريالًا سعوديًا");
    expect(riyal(2500)).toBe("ألفان وخمسمئة ريال سعودي");
    expect(riyal(15000)).toBe("خمسة عشر ألف ريال سعودي");
    expect(riyal(105000)).toBe("مئة وخمسة آلاف ريال سعودي");
    expect(riyal(250300)).toBe("مئتان وخمسون ألفًا وثلاثمئة ريال سعودي");
    expect(riyal(1000000)).toBe("مليون ريال سعودي");
    expect(riyal(2345678)).toBe("مليونان وثلاثمئة وخمسة وأربعون ألفًا وستمئة وثمانية وسبعون ريالًا سعوديًا");
  });

  it("goes up to billions", () => {
    expect(riyal(1_000_000_000)).toBe("مليار ريال سعودي");
    expect(riyal(2_000_000_000)).toBe("مليارا ريال سعودي");
    expect(riyal(3_000_000_000)).toBe("ثلاثة مليارات ريال سعودي");
    expect(riyal(11_000_000_000)).toBe("أحد عشر مليار ريال سعودي");
    expect(riyal(1_000_000_001)).toBe("مليار وريال سعودي واحد");
    expect(englishNumber(999_999_999_999)).toBe("nine hundred ninety-nine billion nine hundred ninety-nine million nine hundred ninety-nine thousand nine hundred ninety-nine");
  });

  it("never reads a hundred and one thousand as eleven hundred", () => {
    expect(riyal(101000)).toBe("مئة ألف وألف ريال سعودي");
    expect(riyal(102000)).toBe("مئة ألف وألفا ريال سعودي");
  });

  it("counts halalas as a feminine noun", () => {
    expect(halala(1)).toBe("هللة واحدة");
    expect(halala(2)).toBe("هللتان");
    expect(halala(5)).toBe("خمس هللات");
    expect(halala(11)).toBe("إحدى عشرة هللة");
    expect(halala(75)).toBe("خمس وسبعون هللة");
  });

  it("writes whole amounts in the invoice formula", () => {
    expect(amountInArabic(125075)).toBe("فقط ألف ومئتان وخمسون ريالًا سعوديًا وخمس وسبعون هللة لا غير");
    expect(amountInArabic(115000)).toBe("فقط ألف ومئة وخمسون ريالًا سعوديًا لا غير");
    expect(amountInArabic(50)).toBe("فقط خمسون هللة لا غير");
    expect(amountInArabic(0)).toBe("فقط صفر ريال سعودي لا غير");
  });
});

describe("English amounts in words", () => {
  it("spells numbers", () => {
    expect(englishNumber(0)).toBe("zero");
    expect(englishNumber(21)).toBe("twenty-one");
    expect(englishNumber(1250)).toBe("one thousand two hundred fifty");
    expect(englishNumber(2345678)).toBe("two million three hundred forty-five thousand six hundred seventy-eight");
  });
  it("writes the invoice line", () => {
    expect(amountInEnglish(125075)).toBe("One thousand two hundred fifty Saudi riyals and seventy-five halalas only");
    expect(amountInEnglish(100)).toBe("One Saudi riyal only");
    expect(amountInEnglish(1)).toBe("One halala only");
  });
});
