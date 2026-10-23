"use client";

import { useEffect, useState } from "react";
import { cn, Icon } from "./ui";

/** Copies a value (an IBAN, a link) and says so for two seconds. */
export function CopyButton({ value, label, done, className }: { value: string; label: string; done: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          /* The value is on screen to copy by hand. */
        }
      }}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-[13px] font-semibold text-seal hover:bg-seal-soft", className)}
    >
      {copied ? <Icon.check size={16} strokeWidth={2.4} /> : <Icon.copy size={16} />}
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}
