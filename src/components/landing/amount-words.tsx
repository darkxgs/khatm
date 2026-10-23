"use client";

import { useId, useState } from "react";
import { parseSar, sar } from "@/lib/amounts";
import { amountInArabic, amountInEnglish } from "@/lib/tafqeet";
import { cn } from "../ui";

const EXAMPLES = ["2,000", "11", "1,250.50", "3,000,000"];

/**
 * The amount on a cheque-like slip: figures in the box, words on the lines.
 * Type anything and both languages rewrite themselves.
 */
export function AmountWords({ label, hint, start = "14,047.25" }: { label: string; hint: string; start?: string }) {
  const [text, setText] = useState(start);
  const id = useId();
  const parsed = parseSar(text);
  const minor = parsed != null && parsed < 1e13 ? parsed : null;
  return (
    // A slip with the faint diagonal security print of a cheque.
    <div className="relative overflow-hidden rounded-[8px] border border-[#cfd2e6] bg-paper bg-[repeating-linear-gradient(135deg,rgb(61_58_158/0.045)_0_1px,transparent_1px_7px)] p-5 shadow-[0_1px_2px_rgb(23_26_44/0.05)] sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label htmlFor={id} className="text-[14px] font-semibold text-ink-2">
          {label}
        </label>
        <div className="flex flex-wrap gap-1.5" dir="ltr">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setText(e)}
              className={cn(
                "tnum h-8 rounded-full border px-3 text-[13px] font-semibold transition-colors",
                text === e ? "border-ink bg-ink text-white" : "border-rule text-ink-2 hover:border-faint hover:text-ink",
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div dir="ltr" className="mt-3 flex items-baseline gap-3 rounded-[6px] border-2 border-ink bg-paper px-4 py-2 focus-within:border-seal">
        <span className="text-[15px] font-bold text-muted">SAR</span>
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${id}-hint`}
          className="tnum w-full min-w-0 bg-transparent text-[30px] font-extrabold tracking-[-0.02em] text-ink outline-none sm:text-[38px]"
        />
      </div>
      <p id={`${id}-hint`} className="mt-2 text-[13px] text-muted">
        {hint}
      </p>
      <output htmlFor={id} aria-live="polite" className="mt-6 block">
        <p lang="ar" dir="rtl" className="border-b border-dotted border-faint pb-2 text-right text-[19px] leading-[1.9] font-bold text-ink sm:text-[23px]">
          {minor != null ? amountInArabic(minor) : "—"}
        </p>
        <p lang="en" dir="ltr" className="mt-3 border-b border-dotted border-faint pb-2 text-left text-[16px] leading-relaxed text-ink-2 sm:text-[18px]">
          {minor != null ? amountInEnglish(minor) : "—"}
        </p>
        {minor != null ? (
          <p dir="ltr" className="tnum mt-3 text-left text-[13px] text-muted">
            {sar(minor)}
          </p>
        ) : null}
      </output>
    </div>
  );
}
