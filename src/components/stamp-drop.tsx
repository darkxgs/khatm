"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { spring, type SpringHandle } from "@/lib/spring";

/**
 * Brings a stamp down onto the page: it falls from above the paper, overshoots
 * into a squash as it lands, and the sheet underneath gives a little. Shown in
 * place, without motion, when the visitor prefers reduced motion.
 */
export function StampDrop({ children, play = true, delay = 500, angle = -12, className }: { children: ReactNode; play?: boolean; delay?: number; angle?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rest = `rotate(${angle}deg)`;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!play || reduced) {
      el.style.opacity = "1";
      el.style.transform = rest;
      return;
    }
    el.style.opacity = "0";
    el.style.transform = `scale(1.7) rotate(${angle - 9}deg)`;
    let handle: SpringHandle | null = null;
    let landed = false;
    let timer = 0;
    const drop = () => {
      handle = spring({
        from: 0,
        to: 1,
        config: { response: 0.34, damping: 0.52 },
        onUpdate: (p) => {
          // p passes 1 on the way in: the stamp squashes slightly before settling.
          const scale = 1.7 - 0.7 * p;
          el.style.opacity = String(Math.min(1, p * 2.4));
          el.style.transform = `scale(${scale}) rotate(${angle - 9 * (1 - Math.min(p, 1))}deg)`;
          if (!landed && p >= 0.97) {
            landed = true;
            const paper = el.closest<HTMLElement>("[data-paper]");
            paper?.animate([{ transform: "translateY(0) scale(1)" }, { transform: "translateY(1.5px) scale(0.997)" }, { transform: "translateY(0) scale(1)" }], {
              duration: 240,
              easing: "cubic-bezier(.2,.8,.3,1)",
            });
          }
        },
        onDone: () => {
          el.style.transform = rest;
        },
      });
    };
    // Wait until the page is on screen, so the moment isn't spent below the fold.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          timer = window.setTimeout(drop, delay);
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
      handle?.stop();
    };
  }, [play, delay, angle]);

  return (
    <div ref={ref} className={className} style={{ opacity: play ? 0 : 1, transform: `rotate(${angle}deg)`, willChange: play ? "transform, opacity" : undefined }}>
      {children}
    </div>
  );
}
