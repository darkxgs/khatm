"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Sheet } from "../sheet";
import { cn, Icon } from "../ui";

export type NavItem = { href: string; label: string; icon: keyof typeof Icon; active: boolean };

/** The phone's tab bar: the four places used most, the new-document button, and the rest in a sheet. */
export function MobileNav({
  main,
  more,
  newHref,
  newLabel,
  moreLabel,
  closeLabel,
  footer,
}: {
  main: NavItem[];
  more: NavItem[];
  newHref: string;
  newLabel: string;
  moreLabel: string;
  closeLabel: string;
  footer: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const moreActive = more.some((m) => m.active);
  const tab = (it: NavItem) => {
    const I = Icon[it.icon];
    return (
      <Link
        key={it.href}
        href={it.href}
        aria-current={it.active ? "page" : undefined}
        className={cn("flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-semibold", it.active ? "text-ink" : "text-muted")}
      >
        <I size={22} strokeWidth={it.active ? 2.1 : 1.8} />
        <span className="max-w-full truncate">{it.label}</span>
      </Link>
    );
  };
  return (
    <>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label={moreLabel}>
        <div className="mx-auto flex max-w-[560px] items-stretch px-1">
          {main.slice(0, 2).map(tab)}
          <div className="flex flex-1 items-center justify-center">
            <Link href={newHref} aria-label={newLabel} className="grid size-12 place-items-center rounded-full bg-ink text-white shadow-[0_6px_16px_-4px_rgb(23_26_44/0.5)] active:scale-95">
              <Icon.plus size={24} strokeWidth={2.2} />
            </Link>
          </div>
          {main.slice(2, 3).map(tab)}
          <button type="button" onClick={() => setOpen(true)} className={cn("flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-semibold", moreActive ? "text-ink" : "text-muted")}>
            <Icon.menu size={22} />
            <span>{moreLabel}</span>
          </button>
        </div>
      </nav>
      <Sheet open={open} onClose={() => setOpen(false)} label={moreLabel} closeLabel={closeLabel}>
        <div className="px-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <ul className="grid gap-0.5">
            {more.map((it) => {
              const I = Icon[it.icon];
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className={cn("flex h-13 items-center gap-3 rounded-[10px] px-3 text-[16px] font-semibold", it.active ? "bg-well text-ink" : "text-ink-2")}
                  >
                    <I size={22} />
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 border-t border-rule pt-3">{footer}</div>
        </div>
      </Sheet>
    </>
  );
}
