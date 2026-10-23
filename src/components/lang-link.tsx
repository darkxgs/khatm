"use client";

import Link from "next/link";
import type { Lang } from "@/lib/types";
import { cn } from "./ui";

/** Switches language and remembers the choice (the proxy reads it for links without one). */
export function LangLink({ to, href, label, className }: { to: Lang; href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      hrefLang={to}
      lang={to}
      onClick={() => {
        document.cookie = `khatm_lang=${to}; path=/; max-age=31536000; samesite=lax`;
      }}
      className={cn("inline-flex h-9 items-center rounded-control px-3 text-[14px] font-semibold text-ink-2 transition-colors hover:bg-rule-2 hover:text-ink", className)}
    >
      {label}
    </Link>
  );
}
