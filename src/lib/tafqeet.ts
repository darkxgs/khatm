// Amounts in words, as Saudi invoices print them ("فقط ... لا غير").
//
// Arabic counting changes the counted noun with the number: one and two have
// their own forms (ريال واحد، ريالان), 3–10 take the plural (ثلاثة ريالات),
// 11–99 the accusative singular (أحد عشر ريالًا), and round hundreds and
// thousands the genitive (مئة ريال). Numbers 3–10 also take the opposite
// gender to the noun (ثلاثة ريالات but ثلاث هللات). A phrase directly followed
// by another noun goes into the construct state (ألفا ريال، أحد عشر ألف ريال).

type Gender = "m" | "f";
type Noun = { one: string; two: string; twoConstruct: string; plural: string; acc: string; gen: string; gender: Gender };

const UNITS: Record<Gender, string[]> = {
  m: ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"],
  f: ["", "واحدة", "اثنتان", "ثلاث", "أربع", "خمس", "ست", "سبع", "ثماني", "تسع"],
};
const COMPOUND_ONE: Record<Gender, string> = { m: "واحد", f: "إحدى" };
const TEN: Record<Gender, string> = { m: "عشرة", f: "عشر" };
const TEENS: Record<Gender, string[]> = {
  m: ["أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"],
  f: ["إحدى عشرة", "اثنتا عشرة", "ثلاث عشرة", "أربع عشرة", "خمس عشرة", "ست عشرة", "سبع عشرة", "ثماني عشرة", "تسع عشرة"],
};
const TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"];

export const NOUNS = {
  riyal: { one: "ريال سعودي واحد", two: "ريالان سعوديان", twoConstruct: "ريالا", plural: "ريالات سعودية", acc: "ريالًا سعوديًا", gen: "ريال سعودي", gender: "m" },
  halala: { one: "هللة واحدة", two: "هللتان", twoConstruct: "هللتا", plural: "هللات", acc: "هللة", gen: "هللة", gender: "f" },
  thousand: { one: "ألف", two: "ألفان", twoConstruct: "ألفا", plural: "آلاف", acc: "ألفًا", gen: "ألف", gender: "m" },
  million: { one: "مليون", two: "مليونان", twoConstruct: "مليونا", plural: "ملايين", acc: "مليونًا", gen: "مليون", gender: "m" },
  billion: { one: "مليار", two: "ملياران", twoConstruct: "مليارا", plural: "مليارات", acc: "مليارًا", gen: "مليار", gender: "m" },
} satisfies Record<string, Noun>;

/** 1–99 as words, in the form a noun of gender `g` needs. */
function below100(n: number, g: Gender): string {
  if (n < 10) return UNITS[g][n];
  if (n === 10) return TEN[g];
  if (n < 20) return TEENS[g][n - 11];
  const u = n % 10;
  const t = TENS[Math.floor(n / 10)];
  if (!u) return t;
  return `${u === 1 ? COMPOUND_ONE[g] : UNITS[g][u]} و${t}`;
}

/** 1–999 as words; `construct` when a noun follows directly (مئتا ريال). */
function below1000(n: number, g: Gender, construct = false): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hw = h === 2 && construct && !r ? "مئتا" : HUNDREDS[h];
  if (!h) return below100(r, g);
  if (!r) return hw;
  return `${HUNDREDS[h]} و${below100(r, g)}`;
}

/**
 * `n` (1–999) of a noun, with the noun in the form the number calls for.
 * `construct`: another noun follows (the currency after "ألف").
 */
function counted(n: number, noun: Noun, construct = false): string {
  if (n === 1) return noun.one;
  if (n === 2) return construct ? noun.twoConstruct : noun.two;
  const r = n % 100;
  const h = n - r;
  if (!h) return r <= 10 ? `${below100(r, noun.gender)} ${noun.plural}` : `${below100(r, noun.gender)} ${construct ? noun.gen : noun.acc}`;
  if (!r) return `${below1000(h, noun.gender, true)} ${noun.gen}`;
  // "مئة ألف وألف": with one or two left over, the noun is said twice so the
  // phrase can't be read as a sum (مئة وألف would mean 1,100).
  if (r === 1) return `${below1000(h, noun.gender, true)} ${noun.gen} و${noun.one}`;
  if (r === 2) return `${below1000(h, noun.gender, true)} ${noun.gen} و${construct ? noun.twoConstruct : noun.two}`;
  return `${HUNDREDS[h / 100]} و${counted(r, noun, construct)}`;
}

const SCALES: [number, Noun][] = [
  [1e9, NOUNS.billion],
  [1e6, NOUNS.million],
  [1e3, NOUNS.thousand],
];

/** A whole number of a noun, e.g. 1250 riyals → "ألف ومئتان وخمسون ريالًا سعوديًا". */
export function arabicCount(n: number, noun: Noun): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1e12) throw new RangeError("out of range");
  if (n === 0) return `صفر ${noun.gen}`;
  const parts: string[] = [];
  let rest = n;
  for (const [size, scale] of SCALES) {
    const c = Math.floor(rest / size);
    rest %= size;
    if (c) parts.push(counted(c, scale, rest === 0));
  }
  if (rest) {
    parts.push(counted(rest, noun));
    return parts.join(" و");
  }
  // Only round groups: the currency follows the last scale word directly.
  return `${parts.join(" و")} ${noun.gen}`;
}

/** "فقط ألف ومئتان وخمسون ريالًا سعوديًا وخمس وسبعون هللة لا غير" from 125075 halalas. */
export function amountInArabic(minor: number): string {
  const riyals = Math.floor(minor / 100);
  const halalas = minor % 100;
  const r = riyals ? arabicCount(riyals, NOUNS.riyal) : "";
  const h = halalas ? arabicCount(halalas, NOUNS.halala) : "";
  const body = r && h ? `${r} و${h}` : r || h || arabicCount(0, NOUNS.riyal);
  return `فقط ${body} لا غير`;
}

/* --------------------------------- English -------------------------------- */

const EN_UNITS = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function enBelow1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? EN_UNITS[r] : `${EN_TENS[Math.floor(r / 10)]}${r % 10 ? `-${EN_UNITS[r % 10]}` : ""}`;
  return [h ? `${EN_UNITS[h]} hundred` : "", rest].filter(Boolean).join(" ");
}

export function englishNumber(n: number): string {
  if (n === 0) return "zero";
  const out: string[] = [];
  let rest = n;
  for (const [size, word] of [
    [1e9, "billion"],
    [1e6, "million"],
    [1e3, "thousand"],
  ] as const) {
    const c = Math.floor(rest / size);
    rest %= size;
    if (c) out.push(`${enBelow1000(c)} ${word}`);
  }
  if (rest) out.push(enBelow1000(rest));
  return out.join(" ");
}

/** "One thousand two hundred fifty Saudi riyals and seventy-five halalas only" */
export function amountInEnglish(minor: number): string {
  const riyals = Math.floor(minor / 100);
  const halalas = minor % 100;
  const r = `${englishNumber(riyals)} Saudi ${riyals === 1 ? "riyal" : "riyals"}`;
  const h = halalas ? ` and ${englishNumber(halalas)} ${halalas === 1 ? "halala" : "halalas"}` : "";
  const text = `${riyals || !halalas ? r : ""}${riyals || !halalas ? h : `${englishNumber(halalas)} ${halalas === 1 ? "halala" : "halalas"}`} only`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
