"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn, Icon, inputClass, Spinner } from "../ui";

/** Filter tabs that are links (so they're shareable and work without script). */
export function FilterTabs({ tabs, active, label }: { tabs: { key: string; label: string; href: string }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-[12px] bg-rule-2/70 p-1">
        {tabs.map((t) => (
          <li key={t.key}>
            <Link
              href={t.href}
              aria-current={t.key === active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-[9px] px-3.5 text-[14px] font-semibold whitespace-nowrap transition-colors",
                t.key === active ? "bg-paper text-ink shadow-[0_1px_2px_rgb(23_26_44/0.1)]" : "text-ink-2 hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A search box that updates the address as you type (debounced), keeping other parameters. */
export function SearchBox({ placeholder, param = "q" }: { placeholder: string; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(param) ?? "");
  const [pending, start] = useTransition();
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const push = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v.trim()) next.set(param, v.trim());
    else next.delete(param);
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  return (
    <div className="relative w-full sm:w-[300px]">
      <Icon.search size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          window.clearTimeout(timer.current);
          const v = e.target.value;
          timer.current = window.setTimeout(() => push(v), 250);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(inputClass, "ps-10 pe-9")}
      />
      {pending ? <Spinner className="absolute end-3 top-1/2 -translate-y-1/2 text-muted" /> : null}
    </div>
  );
}
