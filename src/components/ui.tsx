import { clsx, type ClassValue } from "clsx";
import type { ReactNode, SVGProps } from "react";
import { twMerge } from "tailwind-merge";
import type { DocState } from "@/lib/types";

export const cn = (...v: ClassValue[]) => twMerge(clsx(v));

type Variant = "primary" | "seal" | "outline" | "ghost" | "danger" | "quiet-danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // Ink: the everyday action. The violet is kept for the seal and for issuing.
  primary: "bg-ink text-white hover:bg-[#262a40] active:bg-[#262a40]",
  seal: "bg-seal text-white hover:bg-seal-deep active:bg-seal-deep",
  outline: "border border-rule bg-paper text-ink hover:border-faint hover:bg-well",
  ghost: "text-ink-2 hover:bg-rule-2 hover:text-ink",
  danger: "bg-late text-white hover:brightness-95",
  "quiet-danger": "text-late hover:bg-late-soft",
};
const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[14px]",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-[16px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform,filter] duration-150 select-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4 animate-spin", className)} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.6" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Field({ label, hint, error, children, className, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; htmlFor?: string }) {
  const content = (
    <>
      <span className="text-[14px] font-semibold text-ink-2">{label}</span>
      {children}
    </>
  );
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      {htmlFor ? (
        <>
          <label htmlFor={htmlFor} className="text-[14px] font-semibold text-ink-2">
            {label}
          </label>
          {children}
        </>
      ) : (
        <label className="grid gap-1.5">{content}</label>
      )}
      {error ? (
        <p className="text-[13px] font-medium text-late" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] leading-snug text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "h-11 w-full min-w-0 rounded-control border border-rule bg-paper px-3.5 text-[15px] text-ink placeholder:text-[#8a8ea1] transition-[border-color,box-shadow] focus:border-seal focus:outline-none focus-visible:outline-none focus:ring-3 focus:ring-seal/15 aria-[invalid=true]:border-late aria-[invalid=true]:ring-late/15 disabled:bg-well disabled:text-muted";

export const textareaClass = cn(inputClass, "h-auto min-h-[84px] py-2.5 leading-relaxed");

export const selectClass = cn(
  inputClass,
  "cursor-pointer appearance-none bg-[length:16px] bg-[position:right_12px_center] bg-no-repeat pe-9 rtl:bg-[position:left_12px_center]",
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235f6479' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")]",
);

/** An on/off switch that is a real checkbox underneath. */
export function Switch({
  checked,
  onChange,
  label,
  name,
  disabled,
  className,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  label: string;
  name?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("relative inline-flex shrink-0 cursor-pointer items-center", disabled && "cursor-not-allowed opacity-60", className)}>
      <input type="checkbox" name={name} className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} aria-label={label} />
      <span
        aria-hidden
        className="h-6 w-10 rounded-full bg-rule transition-colors duration-200 peer-checked:bg-seal peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-seal"
      />
      <span
        aria-hidden
        className="absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out peer-checked:translate-x-4 rtl:peer-checked:-translate-x-4"
      />
    </label>
  );
}

/* ------------------------------- state chips ------------------------------ */

const STATE_TONE: Record<DocState, string> = {
  draft: "border-dashed border-faint bg-transparent text-muted",
  unpaid: "border-rule bg-paper text-ink-2",
  partial: "border-part/25 bg-part-soft text-part",
  overdue: "border-late/25 bg-late-soft text-late",
  paid: "border-paid/25 bg-paid-soft text-paid",
  credited: "border-seal/20 bg-seal-soft text-seal",
  void: "border-rule bg-well text-muted line-through decoration-1",
  sent: "border-rule bg-paper text-ink-2",
  accepted: "border-paid/25 bg-paid-soft text-paid",
  issued: "border-seal/20 bg-seal-soft text-seal",
};

/** A document's status, in the ink that status is always written in. */
export function StateChip({ state, label, className }: { state: DocState; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-semibold whitespace-nowrap", STATE_TONE[state], className)}>
      {state === "paid" || state === "accepted" ? <Icon.check size={13} strokeWidth={2.4} /> : state === "overdue" ? <Icon.clock size={13} strokeWidth={2.2} /> : null}
      {label}
    </span>
  );
}

/* ---------------------------------- icons --------------------------------- */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20, props: IconProps) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const Icon = {
  plus: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  close: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  check: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  ),
  search: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </svg>
  ),
  chevron: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  chevronDown: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  globe: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z" />
    </svg>
  ),
  clock: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  overview: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M4 19.5h16M6.5 16v-5M11 16V7M15.5 16v-3.5M20 16V9.5" />
    </svg>
  ),
  documents: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M7 3.5h7.5L19 8v12.5H7z" />
      <path d="M14.5 3.5V8H19M10 12h6M10 15.5h6" />
      <path d="M4.5 6.5v15H15" />
    </svg>
  ),
  customers: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M3 19.5c.8-3.3 3.2-5 6-5s5.2 1.7 6 5" />
      <path d="M15.5 5.3a3.5 3.5 0 0 1 0 6.4M17.5 14.8c1.7.7 3 2.3 3.5 4.7" />
    </svg>
  ),
  products: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M12 3.5l8 4v9l-8 4-8-4v-9z" />
      <path d="M4 7.5l8 4 8-4M12 11.5v9" />
    </svg>
  ),
  vat: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8.5 15.5l7-7" />
      <circle cx="9" cy="9" r="1.2" />
      <circle cx="15" cy="15" r="1.2" />
    </svg>
  ),
  settings: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  ),
  link: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  ),
  print: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M7 9V3.5h10V9M7 17H4.5v-8h15v8H17" />
      <path d="M7 14h10v6.5H7z" />
    </svg>
  ),
  mail: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  ),
  whatsapp: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M4.5 20l1.2-4A8 8 0 1 1 8.6 19z" />
      <path d="M9.2 8.6c.2-.4.5-.5.8-.5h.5l.8 1.9-.6.8c.5 1 1.4 1.9 2.4 2.4l.8-.6 1.9.8v.5c0 .3-.1.6-.5.8-.6.3-1.4.4-2.3 0a7.3 7.3 0 0 1-3.6-3.6c-.4-.9-.3-1.7 0-2.3z" />
    </svg>
  ),
  copy: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </svg>
  ),
  trash: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.9 12.1a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7M9.5 7V4.5h5V7" />
    </svg>
  ),
  edit: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M14.5 5.5l4 4L9 19H5v-4z" />
      <path d="M12.5 7.5l4 4" />
    </svg>
  ),
  credit: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M7 3.5h10v17l-2.5-1.6-2.5 1.6-2.5-1.6L7 20.5z" />
      <path d="M9.5 10h5" />
    </svg>
  ),
  coins: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <rect x="3" y="6.5" width="18" height="11" rx="1.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 9.5v5M17.5 9.5v5" />
    </svg>
  ),
  duplicate: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <rect x="8" y="3.5" width="12" height="14" rx="2" />
      <path d="M16 17.5v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h2" />
      <path d="M14 8v5M11.5 10.5h5" />
    </svg>
  ),
  convert: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  ),
  back: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)} className={cn("rtl:-scale-x-100", p.className)}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  ),
  menu: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  camera: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v10.5H4z" />
      <circle cx="12" cy="13.5" r="3.3" />
    </svg>
  ),
  qr: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h1M20 14v1" />
    </svg>
  ),
  alert: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5M12 16.2v.3" />
    </svg>
  ),
  eye: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  ),
  download: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />
    </svg>
  ),
  signOut: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)} className={cn("rtl:-scale-x-100", p.className)}>
      <path d="M14 4.5H6.5v15H14M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5" />
    </svg>
  ),
  dot: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  ),
};
