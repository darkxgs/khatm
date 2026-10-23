import { cn } from "./ui";

// The rubber stamps a settled document gets: "paid" in green ink, "credited"
// in the seal's violet, "withdrawn" for a quotation taken back. Bilingual,
// like everything else on the page, with a date line under the word.

export type StampKind = "paid" | "credited" | "withdrawn";

const INK: Record<StampKind, { color: string; ar: string; en: string }> = {
  paid: { color: "#12704d", ar: "مدفوعة", en: "PAID" },
  credited: { color: "#3d3a9e", ar: "مُلغاة", en: "CREDITED" },
  withdrawn: { color: "#9b2c2c", ar: "مسحوب", en: "WITHDRAWN" },
};

/** "23 OCT 2026": stamps are cut in capitals. */
export function stampDate(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d).toUpperCase();
}

export function Stamp({ kind, date, className, seed = 11 }: { kind: StampKind; date?: string | null; className?: string; seed?: number }) {
  const ink = INK[kind];
  const id = `stamp-${kind}-${seed}`;
  const enSize = ink.en.length > 6 ? 21 : 27;
  return (
    <svg viewBox="0 0 280 124" className={cn("block", className)} role="img" aria-label={`${ink.ar} ${ink.en}${date ? ` ${date}` : ""}`}>
      <defs>
        <filter id={`${id}-ink`} x="-5%" y="-8%" width="110%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed={seed} result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.55" result="holes" />
          <feComposite in="SourceGraphic" in2="holes" operator="in" result="speckled" />
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed={seed + 5} result="warp" />
          <feDisplacementMap in="speckled" in2="warp" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g fill={ink.color} stroke={ink.color} filter={`url(#${id}-ink)`}>
        <rect x="4" y="4" width="272" height="116" rx="12" fill="none" strokeWidth="4.5" />
        <rect x="13" y="13" width="254" height="98" rx="7" fill="none" strokeWidth="1.5" />
        <line x1="140" y1="28" x2="140" y2="72" strokeWidth="1.5" />
        <text x="76" y="62" fontSize={enSize} fontWeight={800} textAnchor="middle" letterSpacing="2.5" stroke="none" style={{ fontFamily: "'Manrope Variable', sans-serif" }}>
          {ink.en}
        </text>
        <text x="204" y="62" fontSize="31" fontWeight={800} textAnchor="middle" stroke="none" lang="ar" direction="rtl" style={{ fontFamily: "'Noto Kufi Arabic Variable', sans-serif" }}>
          {ink.ar}
        </text>
        {date ? (
          <text x="140" y="98" fontSize="14" fontWeight={700} textAnchor="middle" letterSpacing="3" stroke="none" style={{ fontFamily: "'Manrope Variable', sans-serif" }}>
            {stampDate(date)}
          </text>
        ) : (
          <line x1="70" y1="92" x2="210" y2="92" strokeWidth="1.5" />
        )}
      </g>
    </svg>
  );
}
