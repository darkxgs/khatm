"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { saveCustomerAction } from "@/app/[lang]/app/actions";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { buttonClass, cn, Field, inputClass, selectClass, Spinner } from "../ui";

export type CustomerData = {
  id: string;
  kind: "business" | "person";
  nameAr: string;
  nameEn: string;
  vatNumber: string | null;
  crNumber: string | null;
  buildingNo: string | null;
  streetAr: string | null;
  streetEn: string | null;
  districtAr: string | null;
  districtEn: string | null;
  cityAr: string | null;
  cityEn: string | null;
  postalCode: string | null;
  additionalNo: string | null;
  country: string;
  email: string | null;
  phone: string | null;
};

const COUNTRIES = ["SA", "AE", "BH", "KW", "OM", "QA", "EG", "JO", "GB", "US"];

type Values = Omit<CustomerData, "id">;
const empty: Values = {
  kind: "business",
  nameAr: "",
  nameEn: "",
  vatNumber: null,
  crNumber: null,
  buildingNo: null,
  streetAr: null,
  streetEn: null,
  districtAr: null,
  districtEn: null,
  cityAr: null,
  cityEn: null,
  postalCode: null,
  additionalNo: null,
  country: "SA",
  email: null,
  phone: null,
};

/** A customer: who they are, their identifiers, and their national address. */
export function CustomerForm({ lang, initial, onSaved, submitLabel }: { lang: Lang; initial?: CustomerData | null; onSaved: (c: CustomerData) => void; submitLabel: string }) {
  const t = dict(lang);
  const C = t.customers;
  const A = t.address;
  const [v, setV] = useState<Values>(() => (initial ? { ...initial } : { ...empty }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [otherCountry, setOtherCountry] = useState(() => !!initial && !COUNTRIES.includes(initial.country));
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((x) => ({ ...x, [k]: val }));
  const text = (k: keyof Values) => ({
    value: (v[k] as string | null) ?? "",
    onChange: (e: ChangeEvent<HTMLInputElement>) => set(k, e.target.value as never),
    "aria-invalid": !!errors[k as string],
  });
  const err = (k: string) => (errors[k] ? (t.errors[errors[k]] ?? t.common.tryAgain) : null);
  const business = v.kind === "business";
  const saudi = v.country === "SA";

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    start(async () => {
      const res = await saveCustomerAction(initial?.id ?? null, v);
      if (!res.ok) return setErrors(res.errors);
      setErrors({});
      onSaved({ id: res.id, ...v, nameAr: v.nameAr.trim(), nameEn: v.nameEn.trim() });
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="grid grid-cols-2 gap-1 rounded-[12px] bg-rule-2/70 p-1" role="radiogroup" aria-label={C.kinds.business}>
        {(["business", "person"] as const).map((k) => (
          <label
            key={k}
            className={cn(
              "flex h-10 cursor-pointer items-center justify-center rounded-[9px] text-[14px] font-semibold",
              v.kind === k ? "bg-paper text-ink shadow-[0_1px_2px_rgb(23_26_44/0.1)]" : "text-ink-2",
            )}
          >
            <input type="radio" className="sr-only" checked={v.kind === k} onChange={() => set("kind", k)} />
            {C.kinds[k]}
          </label>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={C.nameAr} error={err("nameAr")}>
          <input {...text("nameAr")} dir="rtl" lang="ar" className={inputClass} autoComplete="off" />
        </Field>
        <Field label={C.nameEn}>
          <input {...text("nameEn")} dir="ltr" lang="en" className={inputClass} autoComplete="off" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={C.country} error={err("country")}>
          {otherCountry ? (
            <input
              value={v.country}
              onChange={(e) => set("country", e.target.value.toUpperCase().slice(0, 2))}
              dir="ltr"
              maxLength={2}
              className={inputClass}
              placeholder="XX"
              aria-invalid={!!errors.country}
            />
          ) : (
            <select
              value={v.country}
              onChange={(e) => {
                if (e.target.value === "other") {
                  setOtherCountry(true);
                  set("country", "");
                } else set("country", e.target.value);
              }}
              className={selectClass}
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {C.countries[c]}
                </option>
              ))}
              <option value="other">{C.otherCountry}</option>
            </select>
          )}
        </Field>
        {business ? (
          <Field label={C.vatNumber} hint={saudi ? C.vatHint : undefined} error={err("vatNumber")}>
            <input {...text("vatNumber")} dir="ltr" inputMode="numeric" className={cn(inputClass, "tnum")} autoComplete="off" />
          </Field>
        ) : (
          <Field label={C.phone}>
            <input {...text("phone")} dir="ltr" type="tel" className={inputClass} autoComplete="off" />
          </Field>
        )}
      </div>
      {!saudi && business ? <p className="-mt-2 text-[13px] text-muted">{C.exportNote}</p> : null}

      {business ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={C.crNumber} error={err("crNumber")}>
            <input {...text("crNumber")} dir="ltr" inputMode="numeric" className={cn(inputClass, "tnum")} autoComplete="off" />
          </Field>
          <Field label={C.email} error={err("email")}>
            <input {...text("email")} dir="ltr" type="email" className={inputClass} autoComplete="off" />
          </Field>
        </div>
      ) : (
        <Field label={C.email} error={err("email")}>
          <input {...text("email")} dir="ltr" type="email" className={inputClass} autoComplete="off" />
        </Field>
      )}

      <fieldset className="grid gap-4 border-t border-rule pt-4">
        <legend className="mb-1 pt-1 text-[15px] font-bold text-ink">{A.title}</legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label={A.buildingNo} hint={saudi ? A.buildingHint : undefined} error={err("buildingNo")}>
            <input {...text("buildingNo")} dir="ltr" inputMode="numeric" className={cn(inputClass, "tnum")} />
          </Field>
          <Field label={A.postalCode} hint={saudi ? A.postalHint : undefined} error={err("postalCode")}>
            <input {...text("postalCode")} dir="ltr" inputMode="numeric" className={cn(inputClass, "tnum")} />
          </Field>
          <Field label={A.additionalNo} hint={saudi ? A.additionalHint : undefined} error={err("additionalNo")} className="col-span-2 sm:col-span-1">
            <input {...text("additionalNo")} dir="ltr" inputMode="numeric" className={cn(inputClass, "tnum")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={A.streetAr}>
            <input {...text("streetAr")} dir="rtl" className={inputClass} />
          </Field>
          <Field label={A.streetEn}>
            <input {...text("streetEn")} dir="ltr" className={inputClass} />
          </Field>
          <Field label={A.districtAr}>
            <input {...text("districtAr")} dir="rtl" className={inputClass} />
          </Field>
          <Field label={A.districtEn}>
            <input {...text("districtEn")} dir="ltr" className={inputClass} />
          </Field>
          <Field label={A.cityAr}>
            <input {...text("cityAr")} dir="rtl" className={inputClass} />
          </Field>
          <Field label={A.cityEn}>
            <input {...text("cityEn")} dir="ltr" className={inputClass} />
          </Field>
        </div>
      </fieldset>

      {errors.form ? (
        <p role="alert" className="text-[14px] font-medium text-late">
          {err("form")}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "w-full")}>
        {pending ? <Spinner /> : null}
        {submitLabel}
      </button>
    </form>
  );
}
