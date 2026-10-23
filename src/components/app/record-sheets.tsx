"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { CustomerForm, type CustomerData } from "../forms/customer-form";
import { ProductForm, type ProductData } from "../forms/product-form";
import { Sheet } from "../sheet";
import { buttonClass, cn } from "../ui";

/** A button that opens a sheet with a form in it. */
function SheetButton({
  label,
  title,
  closeLabel,
  children,
  className,
  variant = "primary",
  icon,
}: {
  label: ReactNode;
  title: string;
  closeLabel: string;
  children: (close: () => void) => ReactNode;
  className?: string;
  variant?: "primary" | "outline" | "ghost";
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass(variant, "md", className)}>
        {icon}
        {label}
      </button>
      <Sheet open={open} onClose={close} label={title} closeLabel={closeLabel} header={<h2 className="px-5 pt-6 pb-1 text-[20px] font-extrabold text-ink">{title}</h2>}>
        <div className="px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">{open ? children(close) : null}</div>
      </Sheet>
    </>
  );
}

export function CustomerSheetButton({
  lang,
  customer,
  label,
  className,
  variant,
  icon,
  openNewDoc,
  startOpen,
}: {
  lang: Lang;
  customer?: CustomerData | null;
  label: ReactNode;
  className?: string;
  variant?: "primary" | "outline" | "ghost";
  icon?: ReactNode;
  openNewDoc?: boolean;
  startOpen?: boolean;
}) {
  const t = dict(lang);
  const router = useRouter();
  const [open, setOpen] = useState(!!startOpen);
  const title = customer ? t.customers.edit : t.customers.new;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass(variant ?? "primary", "md", className)}>
        {icon}
        {label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label={title} closeLabel={t.common.close} header={<h2 className="px-5 pt-6 pb-1 text-[20px] font-extrabold text-ink">{title}</h2>}>
        <div className="px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
          {open ? (
            <CustomerForm
              lang={lang}
              initial={customer}
              submitLabel={customer ? t.common.save : t.customers.saveNew}
              onSaved={(c) => {
                setOpen(false);
                if (!customer) router.push(openNewDoc ? `/${lang}/app/documents/new?kind=tax&customer=${c.id}` : `/${lang}/app/customers/${c.id}`);
              }}
            />
          ) : null}
        </div>
      </Sheet>
    </>
  );
}

export function ProductSheetButton({
  lang,
  product,
  label,
  className,
  variant,
  icon,
}: {
  lang: Lang;
  product?: ProductData | null;
  label: ReactNode;
  className?: string;
  variant?: "primary" | "outline" | "ghost";
  icon?: ReactNode;
}) {
  const t = dict(lang);
  return (
    <SheetButton label={label} title={product ? t.products.edit : t.products.new} closeLabel={t.common.close} className={cn(className)} variant={variant} icon={icon}>
      {(close) => <ProductForm lang={lang} initial={product} submitLabel={product ? t.common.save : t.products.saveNew} onSaved={close} />}
    </SheetButton>
  );
}
