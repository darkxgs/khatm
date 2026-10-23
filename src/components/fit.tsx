"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "./ui";

export const A4_WIDTH = 794;

/**
 * Shows an A4 page at whatever width its column has, by zooming it (layout
 * and all, unlike a transform). Container queries in globals.css size it to
 * within a step before any script runs, so a phone never sees the page
 * cropped while the app loads; this then sets the exact zoom.
 */
export function Fit({ children, className, max = 1, pageClassName }: { children: ReactNode; className?: string; max?: number; pageClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => el.style.setProperty("--z", String(Math.min(max, el.clientWidth / A4_WIDTH)));
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [max]);
  return (
    <div ref={ref} data-fit className={cn("w-full", className)}>
      <div data-fit-page className={pageClassName} style={{ width: A4_WIDTH }}>
        {children}
      </div>
    </div>
  );
}
