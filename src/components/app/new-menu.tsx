"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DocKind, Lang } from "@/lib/types";
import { buttonClass, cn, Icon } from "../ui";

type Item = { kind: Exclude<DocKind, "credit">; label: string; hint: string };

/** "New invoice", with the other kinds of document one click away. */
export function NewMenu({ lang, label, items, className, align = "start", full }: { lang: Lang; label: string; items: Item[]; className?: string; align?: "start" | "end"; full?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={box} className={cn("relative", full && "w-full", className)}>
      <div className={cn("flex", full && "w-full")}>
        <Link href={`/${lang}/app/documents/new?kind=tax`} className={buttonClass("primary", "md", cn("rounded-e-none pe-4", full && "flex-1"))}>
          <Icon.plus size={18} strokeWidth={2.2} />
          {label}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={label}
          className={buttonClass("primary", "md", "rounded-s-none border-s border-white/15 px-2.5")}
        >
          <Icon.chevronDown size={18} className={cn("transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-40 mt-2 w-[290px] overflow-hidden rounded-[12px] border border-rule bg-paper p-1.5 shadow-[0_12px_40px_-8px_rgb(23_26_44/0.28)]",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {items.map((it) => (
            <Link
              key={it.kind}
              role="menuitem"
              href={`/${lang}/app/documents/new?kind=${it.kind}`}
              onClick={() => setOpen(false)}
              className="block rounded-[8px] px-3 py-2.5 hover:bg-well focus-visible:bg-well"
            >
              <span className="block text-[15px] font-semibold text-ink">{it.label}</span>
              <span className="block text-[13px] leading-snug text-muted">{it.hint}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
