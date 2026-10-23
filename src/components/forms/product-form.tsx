"use client";

import { useState, useTransition } from "react";
import { saveProductAction } from "@/app/[lang]/app/actions";
import { parseSar, sar } from "@/lib/amounts";
import { dict } from "@/lib/i18n";
import type { Lang, VatCategory } from "@/lib/types";
import { VAT_RATES } from "@/lib/zatca";
import { buttonClass, cn, Field, inputClass, selectClass, Spinner } from "../ui";

export type ProductData = { id: string; nameAr: string; nameEn: string; unitAr: string | null; unitEn: string | null; price: number; vat: VatCategory };

export function ProductForm({ lang, initial, onSaved, submitLabel }: { lang: Lang; initial?: ProductData | null; onSaved: () => void; submitLabel: string }) {
  const t = dict(lang);
  const P = t.products;
  const [nameAr, setNameAr] = useState(initial?.nameAr ?? "");
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? "");
  const [unitAr, setUnitAr] = useState(initial?.unitAr ?? "");
  const [unitEn, setUnitEn] = useState(initial?.unitEn ?? "");
  const [price, setPrice] = useState(initial ? sar(initial.price) : "");
  const [vat, setVat] = useState<VatCategory>(initial?.vat ?? "S");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const err = (k: string) => (errors[k] ? (t.errors[errors[k]] ?? t.common.tryAgain) : null);
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const minor = parseSar(price);
        start(async () => {
          const res = await saveProductAction(initial?.id ?? null, { nameAr, nameEn, unitAr, unitEn, price: minor, vat });
          if (!res.ok) return setErrors(res.errors);
          onSaved();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={P.nameAr} error={err("nameAr")}>
          <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" className={inputClass} aria-invalid={!!errors.nameAr} />
        </Field>
        <Field label={P.nameEn}>
          <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" className={inputClass} />
        </Field>
        <Field label={P.unitAr} hint={lang === "ar" ? P.unitHint : undefined}>
          <input value={unitAr} onChange={(e) => setUnitAr(e.target.value)} dir="rtl" className={inputClass} />
        </Field>
        <Field label={P.unitEn} hint={lang === "en" ? P.unitHint : undefined}>
          <input value={unitEn} onChange={(e) => setUnitEn(e.target.value)} dir="ltr" className={inputClass} />
        </Field>
        <Field label={P.price} error={err("price")}>
          <div dir="ltr" className="relative">
            <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[14px] font-bold text-muted">SAR</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={cn(inputClass, "tnum ps-14")} aria-invalid={!!errors.price} />
          </div>
        </Field>
        <Field label={P.vat}>
          <select value={vat} onChange={(e) => setVat(e.target.value as VatCategory)} className={selectClass}>
            {(Object.keys(VAT_RATES) as VatCategory[]).map((c) => (
              <option key={c} value={c}>
                {t.vatCats[c]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "mt-1 w-full")}>
        {pending ? <Spinner /> : null}
        {submitLabel}
      </button>
    </form>
  );
}
