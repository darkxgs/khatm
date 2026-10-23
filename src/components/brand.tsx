import Link from "next/link";
import type { Lang } from "@/lib/types";
import { cn } from "./ui";

/** The mark: a small seal with the letter khā' (خ), for ختم. */
export function Mark({ className, color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("block", className)} aria-hidden>
      <circle cx="20" cy="20" r="18.4" fill="none" stroke={color} strokeWidth="2.6" />
      <circle cx="20" cy="20" r="14.6" fill="none" stroke={color} strokeWidth="1" />
      <text x="20" y="27.2" textAnchor="middle" fontSize="19" fontWeight={800} fill={color} style={{ fontFamily: "'Noto Kufi Arabic Variable', sans-serif" }}>
        خ
      </text>
    </svg>
  );
}

export function Logo({ lang, className, href }: { lang: Lang; className?: string; href?: string }) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2.5 text-ink", className)}>
      <Mark className="size-8 text-seal" />
      <span className={cn("text-[19px] leading-none font-extrabold tracking-[-0.01em]", lang === "ar" && "text-[20px]")}>{lang === "ar" ? "ختم" : "Khatm"}</span>
    </span>
  );
  return href ? (
    <Link href={href} className="rounded-control" aria-label={lang === "ar" ? "ختم" : "Khatm"}>
      {inner}
    </Link>
  ) : (
    inner
  );
}
