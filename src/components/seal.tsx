import { cn } from "./ui";

// A company seal (ختم), drawn the way Saudi rubber stamps are cut: two rings,
// the Arabic name around the top, the English name around the bottom, and the
// commercial registration number in the middle. With `inked`, it is printed
// through a speckled-ink filter so it reads as stamped, not typeset.

type Props = {
  nameAr: string;
  nameEn: string;
  crNumber?: string | null;
  cityAr?: string | null;
  className?: string;
  inked?: boolean;
  color?: string;
  /** A stable seed so the ink pattern is the same on every render. */
  seed?: number;
  title?: string;
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};

/** Long names get smaller letters so they still fit their half of the ring. */
const fit = (text: string, arc: number, max: number, perChar: number) => Math.max(8.5, Math.min(max, arc / Math.max(1, text.length * perChar)));

export function Seal({ nameAr, nameEn, crNumber, cityAr, className, inked = false, color = "#3d3a9e", seed = 7, title }: Props) {
  const id = `seal-${hash(`${nameAr}|${nameEn}|${crNumber}|${inked}|${seed}`)}`;
  const ar = nameAr.trim() || nameEn.trim();
  const enName = (nameEn.trim() || nameAr.trim()).toUpperCase();
  // Half-ring lengths at each text radius, less room for the separators.
  const arSize = fit(ar, Math.PI * 67 * 0.78, 17, 0.62);
  const enSize = fit(enName, Math.PI * 80 * 0.74, 13.5, 0.7);
  const initials = enName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <svg viewBox="0 0 200 200" className={cn("block", className)} role="img" aria-label={title ?? `${nameAr} ${nameEn}`.trim()}>
      <defs>
        {/* Top arc runs clockwise (letters stand outward), bottom arc counter-clockwise (letters stand inward). */}
        <path id={`${id}-top`} d="M 33,100 A 67,67 0 0,1 167,100" fill="none" />
        <path id={`${id}-bottom`} d="M 20,100 A 80,80 0 0,0 180,100" fill="none" />
        {inked ? (
          <filter id={`${id}-ink`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} result="grain" />
            <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.5" result="holes" />
            <feComposite in="SourceGraphic" in2="holes" operator="in" result="speckled" />
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={seed + 3} result="warp" />
            <feDisplacementMap in="speckled" in2="warp" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        ) : null}
      </defs>
      <g fill={color} stroke={color} filter={inked ? `url(#${id}-ink)` : undefined}>
        <circle cx="100" cy="100" r="95" fill="none" strokeWidth="3.4" />
        <circle cx="100" cy="100" r="88" fill="none" strokeWidth="1.1" />
        <circle cx="100" cy="100" r="57" fill="none" strokeWidth="1.1" />
        <text fontSize={arSize} fontWeight={700} stroke="none" lang="ar" direction="rtl" style={{ fontFamily: "'Noto Kufi Arabic Variable', sans-serif" }}>
          <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
            {ar}
          </textPath>
        </text>
        <text fontSize={enSize} fontWeight={700} stroke="none" letterSpacing="1.2" style={{ fontFamily: "'Manrope Variable', sans-serif" }}>
          <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">
            {enName}
          </textPath>
        </text>
        {/* Separators where the two names meet. */}
        <path d="M 13.5,100 l 4,-4 l 4,4 l -4,4 z M 178.5,100 l 4,-4 l 4,4 l -4,4 z" stroke="none" />
        {crNumber ? (
          <g stroke="none" textAnchor="middle">
            <text x="100" y="84" fontSize="12" fontWeight={600} lang="ar" style={{ fontFamily: "'Noto Kufi Arabic Variable', sans-serif" }}>
              س.ت
            </text>
            <text x="100" y="106" fontSize="17" fontWeight={800} letterSpacing="0.6" style={{ fontFamily: "'Manrope Variable', sans-serif", fontVariantNumeric: "tabular-nums" }}>
              {crNumber}
            </text>
            {cityAr ? (
              <text x="100" y="127" fontSize="12.5" fontWeight={600} lang="ar" style={{ fontFamily: "'Noto Kufi Arabic Variable', sans-serif" }}>
                {cityAr}
              </text>
            ) : null}
          </g>
        ) : (
          <text x="100" y="114" fontSize="40" fontWeight={800} textAnchor="middle" stroke="none" style={{ fontFamily: "'Manrope Variable', sans-serif" }}>
            {initials}
          </text>
        )}
      </g>
    </svg>
  );
}
