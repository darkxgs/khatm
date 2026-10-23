"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { project, rubberband, spring, SPRINGS, VelocityTracker, type SpringHandle } from "@/lib/spring";
import { cn } from "./ui";

/**
 * A bottom sheet you can throw away. Drag its top down and let go: where it
 * goes depends on where the flick was heading (position plus projected
 * momentum), not where the finger stopped. It can be caught mid-animation,
 * pulls with resistance past the top, and the backdrop follows the sheet.
 */
export function Sheet({
  open,
  onClose,
  label,
  closeLabel,
  children,
  header,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  closeLabel: string;
  children: ReactNode;
  /** The draggable top of the sheet (a photo, a title). A handle is always drawn. */
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(open);
  const sheet = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const anim = useRef<SpringHandle | null>(null);
  const y = useRef(0);
  const leaving = useRef(false);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const dismissRef = useRef<(() => void) | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Fully out of sight: its height, plus the gap it floats above the bottom edge on wider screens.
  const height = () => (sheet.current?.getBoundingClientRect().height ?? window.innerHeight) + 32;
  const paint = useCallback((v: number) => {
    y.current = v;
    if (sheet.current) sheet.current.style.transform = `translate3d(0, ${v}px, 0)`;
    if (backdrop.current) backdrop.current.style.opacity = String(Math.max(0, Math.min(1, 1 - v / height())));
  }, []);

  const animateTo = useCallback(
    (to: number, velocity = 0, done?: () => void) => {
      anim.current?.stop();
      anim.current = spring({ from: y.current, to, velocity, config: SPRINGS.sheet, onUpdate: paint, onDone: done });
    },
    [paint],
  );

  // Open: mount, then rise from below the screen. Close: fall, then unmount.
  useEffect(() => {
    if (open && !mounted) {
      restoreFocus.current = document.activeElement as HTMLElement | null;
      // Mounting here (not during render) lets the close animation finish first.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
    }
    if (!open && mounted && !leaving.current) {
      leaving.current = true;
      animateTo(height(), 0, () => {
        leaving.current = false;
        setMounted(false);
      });
    }
  }, [open, mounted, animateTo]);

  useLayoutEffect(() => {
    if (!mounted || !open) return;
    paint(height());
    animateTo(0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheet.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prevOverflow;
      restoreFocus.current?.focus?.({ preventScroll: true });
    };
    // Run once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => () => anim.current?.stop(), []);

  // Escape closes the sheet wherever focus has wandered inside it.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissRef.current?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted]);

  const dismiss = useCallback(
    (velocity = 0) => {
      if (leaving.current) return;
      leaving.current = true;
      animateTo(height(), Math.max(velocity, 0), () => {
        leaving.current = false;
        setMounted(false);
        onCloseRef.current();
      });
    },
    [animateTo],
  );

  useEffect(() => {
    dismissRef.current = () => dismiss();
  }, [dismiss]);

  // Dragging the header.
  const drag = useRef<{ id: number; startY: number; startOffset: number; tracker: VelocityTracker } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || leaving.current) return;
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select, label")) return;
    anim.current?.stop();
    const tracker = new VelocityTracker();
    tracker.add(e.clientX, e.clientY);
    drag.current = { id: e.pointerId, startY: e.clientY, startOffset: y.current, tracker };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.tracker.add(e.clientX, e.clientY);
    const raw = d.startOffset + (e.clientY - d.startY);
    paint(raw < 0 ? rubberband(raw, height()) : raw);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const v = d.tracker.get().y;
    const h = height();
    const heading = y.current + project(v);
    if (heading > h * 0.5 || (v > 900 && y.current > 8)) dismiss(v);
    else animateTo(0, v);
  };

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div ref={backdrop} className="absolute inset-0 bg-[rgb(17_19_33/0.45)] opacity-0" onClick={() => dismiss()} aria-hidden />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-sheet bg-white shadow-[0_-12px_40px_rgb(0_0_0/0.18)] outline-none sm:bottom-6 sm:max-h-[86dvh] sm:rounded-sheet",
          className,
        )}
        // Starts below the screen; the spring takes over from here. (An inline transform,
        // not a translate utility: Tailwind's `translate` property would stack with it.)
        style={{ transform: "translate3d(0, 100%, 0)" }}
      >
        <div
          className="relative shrink-0 cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="absolute inset-x-0 top-2 z-10 mx-auto block h-1.5 w-10 rounded-full bg-black/20 mix-blend-multiply" aria-hidden />
          {header ?? <div className="h-6" />}
          <button
            type="button"
            onClick={() => dismiss()}
            className="absolute end-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur transition-transform active:scale-95"
            aria-label={closeLabel}
          >
            <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? <div className="shrink-0 border-t border-black/[0.06] bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
