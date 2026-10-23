"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { recordPaymentAction } from "@/app/[lang]/app/actions";
import { parseSar, sar } from "@/lib/amounts";
import { dict } from "@/lib/i18n";
import type { Lang, PayMethod } from "@/lib/types";
import { Sheet } from "../sheet";
import { buttonClass, cn, Field, Icon, inputClass, Spinner } from "../ui";

const METHODS: PayMethod[] = ["transfer", "cash", "card", "other"];

/** "Record a payment": a sheet with the balance filled in. Settling the invoice brings the stamp down. */
export function PaymentButton({ lang, docId, balance, today, className }: { lang: Lang; docId: string; balance: number; today: string; className?: string }) {
  const t = dict(lang);
  const P = t.payment;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(sar(balance));
  const [paidOn, setPaidOn] = useState(today);
  const [method, setMethod] = useState<PayMethod>("transfer");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = useId();

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const minor = parseSar(amount);
    if (minor == null || minor <= 0 || minor > balance) return setError(P.errors.amount);
    setError(null);
    start(async () => {
      const res = await recordPaymentAction(docId, { amount: minor, paidOn, method, note: note || null });
      if (!res.ok) return setError(P.errors[res.error]);
      setOpen(false);
      if (res.settled) router.replace(`?just=paid`, { scroll: false });
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAmount(sar(balance));
          setError(null);
          setOpen(true);
        }}
        className={buttonClass("primary", "lg", cn("w-full", className))}
      >
        <Icon.coins size={20} />
        {t.view.record}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label={P.title} closeLabel={t.common.close} header={<h2 className="px-5 pt-6 pb-1 text-[20px] font-extrabold text-ink">{P.title}</h2>}>
        <form onSubmit={submit} className="grid gap-4 px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]" noValidate>
          <Field label={P.amount} hint={P.balanceHint(lang === "ar" ? `${sar(balance)} ر.س` : `SAR ${sar(balance)}`)} error={error}>
            <div dir="ltr" className="relative">
              <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[14px] font-bold text-muted">SAR</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className={cn(inputClass, "tnum h-12 ps-14 text-[18px] font-bold")}
                aria-invalid={!!error}
                autoFocus
              />
            </div>
          </Field>
          <Field label={P.date}>
            <input type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} className={inputClass} dir="ltr" />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-[14px] font-semibold text-ink-2">{P.method}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {METHODS.map((m) => (
                <label
                  key={m}
                  className={cn(
                    "flex h-11 cursor-pointer items-center justify-center rounded-control border text-[14px] font-semibold transition-colors",
                    method === m ? "border-ink bg-ink text-white" : "border-rule bg-paper text-ink-2 hover:border-faint",
                  )}
                >
                  <input type="radio" name={`${id}-method`} value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                  {t.methods[m]}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={`${P.note} (${t.common.optional})`}>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={P.notePlaceholder} maxLength={200} className={inputClass} />
          </Field>
          <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "mt-1 w-full")}>
            {pending ? <Spinner /> : null}
            {P.submit}
          </button>
        </form>
      </Sheet>
    </>
  );
}

/** Copy the share link, or hand it to WhatsApp or the mail app. */
export function ShareRow({ lang, link, message, subject }: { lang: Lang; link: string; message: string; subject: string }) {
  const t = dict(lang).view;
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);
  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          } catch {
            // No clipboard (an insecure page, an old browser): show the link to copy by hand.
            setManual(true);
          }
        }}
        className={buttonClass("outline", "md", "w-full justify-start")}
      >
        {copied ? <Icon.check size={18} className="text-paid" strokeWidth={2.4} /> : <Icon.link size={18} />}
        <span aria-live="polite">{copied ? t.linkCopied : t.copyLink}</span>
      </button>
      {manual ? <input readOnly value={link} dir="ltr" onFocus={(e) => e.currentTarget.select()} className={inputClass} autoFocus /> : null}
      <div className="grid grid-cols-2 gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "md", "justify-start px-3.5")}>
          <Icon.whatsapp size={18} />
          <span className="truncate">{t.whatsapp}</span>
        </a>
        <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`} className={buttonClass("outline", "md", "justify-start px-3.5")}>
          <Icon.mail size={18} />
          <span className="truncate">{t.email}</span>
        </a>
      </div>
    </div>
  );
}

export function PrintButton({ label, className, variant = "outline" }: { label: string; className?: string; variant?: "outline" | "primary" }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass(variant, "md", cn("justify-start", className))}>
      <Icon.print size={18} />
      {label}
    </button>
  );
}

/**
 * Runs a server action (already bound to its arguments) with a spinner. With
 * `confirm`, the first click opens a small confirmation under the button.
 */
export function RunButton({
  action,
  children,
  className,
  variant = "outline",
  confirm,
}: {
  action: () => Promise<unknown>;
  children: ReactNode;
  className?: string;
  variant?: "outline" | "ghost" | "quiet-danger" | "primary";
  confirm?: { text: string; cancel: string };
}) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!asking) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setAsking(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAsking(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [asking]);
  const run = () => start(async () => void (await action()));
  return (
    <div ref={box} className={cn("relative", className?.includes("w-full") && "w-full")}>
      <button
        type="button"
        disabled={pending}
        aria-expanded={confirm ? asking : undefined}
        onClick={() => (confirm ? setAsking((v) => !v) : run())}
        className={buttonClass(variant, "md", cn("justify-start", className))}
      >
        {pending ? <Spinner /> : null}
        {children}
      </button>
      {asking && confirm ? (
        <div
          role="alertdialog"
          aria-label={confirm.text}
          className="absolute end-0 top-full z-40 mt-2 w-[280px] rounded-[12px] border border-rule bg-paper p-3.5 shadow-[0_16px_40px_-10px_rgb(23_26_44/0.3)]"
        >
          <p className="text-[14px] leading-snug font-medium text-ink">{confirm.text}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setAsking(false)} className={buttonClass("ghost", "sm")}>
              {confirm.cancel}
            </button>
            <button type="button" disabled={pending} onClick={run} className={buttonClass("danger", "sm")} autoFocus>
              {pending ? <Spinner /> : null}
              {children}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
