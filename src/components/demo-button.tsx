"use client";

import { useActionState } from "react";
import { startDemoAction, type FormState } from "@/app/[lang]/actions";
import type { Lang } from "@/lib/types";
import { buttonClass, cn, Spinner } from "./ui";

/** Opens the demo. Building six months of a business takes a moment, so the button says so. */
export function DemoButton({
  lang,
  label,
  errors,
  size = "md",
  variant = "primary",
  compact,
  className,
}: {
  lang: Lang;
  label: string;
  errors: { rate: string; full: string };
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "seal" | "outline";
  compact?: boolean;
  className?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(startDemoAction, { error: null });
  const message = state.error === "rate" ? errors.rate : state.error === "full" ? errors.full : null;
  return (
    <form action={action} className={cn("relative", className)}>
      <input type="hidden" name="lang" value={lang} />
      <button type="submit" disabled={pending} className={buttonClass(variant, size)} aria-describedby={message ? "demo-error" : undefined}>
        {pending ? <Spinner /> : null}
        {label}
      </button>
      {message ? (
        <p id="demo-error" role="alert" className={cn("mt-2 max-w-[320px] text-[13px] font-medium text-late", compact && "absolute end-0 top-full w-[260px] rounded-control bg-paper p-2.5 shadow-lg")}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
