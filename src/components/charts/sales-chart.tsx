"use client";

import { useState } from "react";
import { compactSar } from "@/lib/money";
import type { Lang } from "@/lib/types";
import { cn } from "../ui";

export type SalesPoint = { key: string; label: string; long: string; value: number; display: string };

/**
 * Monthly sales as bars: one series, so no legend; the latest month is
 * labelled, every bar shows its figure on hover or focus, and a table carries
 * the same numbers for screen readers.
 */
export function SalesChart({ points, caption, monthHeader, valueHeader, lang }: { points: SalesPoint[]; caption: string; monthHeader: string; valueHeader: string; lang: Lang }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const nice = niceMax(max);
  const ticks = [0, nice / 2, nice];
  const H = 168;
  const last = points.length - 1;
  return (
    <figure className="m-0">
      <div className="relative" style={{ height: H + 28 }}>
        {/* Gridlines, quiet. */}
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ top: H - (t / nice) * H }} aria-hidden>
            <span className="tnum w-9 shrink-0 -translate-y-1/2 text-end text-[11px] text-muted">{compactSar(t, lang)}</span>
            <span className={cn("h-px flex-1 -translate-y-1/2", t === 0 ? "bg-rule" : "bg-rule-2")} />
          </div>
        ))}
        <div className="absolute inset-y-0 end-0 start-11 flex items-end justify-around" style={{ height: H }}>
          {points.map((p, i) => {
            const h = p.value > 0 ? Math.max(3, (p.value / nice) * H) : 0;
            const show = active === i || (active === null && i === last);
            return (
              <button
                key={p.key}
                type="button"
                className="group relative flex h-full w-full max-w-[64px] cursor-default items-end justify-center outline-none"
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${p.long}: ${p.display}`}
              >
                <span
                  className={cn(
                    "block w-[22px] rounded-t-[4px] transition-[background-color] duration-150",
                    active === i ? "bg-seal-deep" : "bg-chart",
                    "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-seal",
                  )}
                  style={{ height: h }}
                />
                {show ? (
                  // The first and last bars anchor their label to the side facing into the chart, so it never runs off it.
                  <span
                    className={cn(
                      "tnum pointer-events-none absolute z-10 rounded-[6px] bg-ink px-2 py-1 text-[12px] font-semibold whitespace-nowrap text-white shadow-md",
                      i === 0 ? "start-[calc(50%-11px)]" : i === last ? "end-[calc(50%-11px)]" : "",
                    )}
                    style={{ bottom: h + 8 }}
                  >
                    {p.display}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="absolute inset-x-0 end-0 start-11 flex justify-around" style={{ top: H + 8 }} aria-hidden>
          {points.map((p, i) => (
            <span key={p.key} className={cn("w-full max-w-[64px] text-center text-[12px]", i === active || (active === null && i === last) ? "font-semibold text-ink" : "text-muted")}>
              {p.label}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">{monthHeader}</th>
            <th scope="col">{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <td>{p.long}</td>
              <td>{p.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** A round top for the scale: 1, 2 or 5 times a power of ten. */
function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
