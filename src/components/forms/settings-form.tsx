"use client";

import { useState, useTransition, type ReactNode } from "react";
import { updateBusinessAction } from "@/app/[lang]/app/actions";
import type { BusinessIn } from "@/server/business";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { Seal } from "../seal";
import { buttonClass, cn, Field, Icon, inputClass, Spinner, Switch, textareaClass } from "../ui";

export type SettingsValues = Required<{ [K in keyof BusinessIn]: NonNullable<BusinessIn[K]> extends number ? string : NonNullable<BusinessIn[K]> extends boolean ? boolean : string }>;

function Section({ id, title, children, aside }: { id?: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-rule py-7 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-[18px] font-extrabold text-ink">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A field that the form can scroll to when the server rejects it. */
function F({ k, label, hint, error, children, className }: { k: string; label: string; hint?: string; error: string | null; children: ReactNode; className?: string }) {
  return (
    <div data-field={k} className={className}>
      <Field label={label} hint={hint} error={error}>
        {children}
      </Field>
    </div>
  );
}

/** The business's own details: everything a tax invoice prints about the seller. */
export function SettingsForm({ lang, initial, welcome }: { lang: Lang; initial: SettingsValues; welcome: boolean }) {
  const t = dict(lang);
  const S = t.settings;
  const A = t.address;
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof SettingsValues) => (e: { target: { value: string } }) => {
    setSaved(false);
    setV((x) => ({ ...x, [k]: e.target.value }));
  };
  const err = (k: string) => (errors[k] ? (t.errors[errors[k]] ?? t.common.tryAgain) : null);
  const input = (k: keyof SettingsValues, opts: { dir?: "ltr" | "rtl"; numeric?: boolean; type?: string } = {}) => (
    <input
      value={v[k] as string}
      onChange={set(k)}
      dir={opts.dir}
      type={opts.type}
      inputMode={opts.numeric ? "numeric" : undefined}
      aria-invalid={!!errors[k]}
      className={cn(inputClass, opts.numeric && "tnum")}
    />
  );
  const next = `${(v.invoicePrefix || "INV").toUpperCase()}-${String(Number(v.nextInvoice) || 1).padStart(5, "0")}`;

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    start(async () => {
      const res = await updateBusinessAction({ ...v, nextInvoice: Number(v.nextInvoice), termsDays: Number(v.termsDays) });
      if (!res.ok) {
        setErrors(res.errors);
        const first = Object.keys(res.errors)[0];
        document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      setErrors({});
      setSaved(true);
    });
  };

  return (
    <form onSubmit={submit} noValidate className="max-w-[780px]">
      {welcome ? <p className="mb-7 rounded-[12px] bg-seal-soft px-4 py-3 text-[15px] text-seal">{t.dashboard.start.body}</p> : null}

      <Section title={S.business}>
        <div className="grid gap-4 sm:grid-cols-2">
          <F k="nameAr" error={err("nameAr")} label={S.nameAr}>
            {input("nameAr", { dir: "rtl" })}
          </F>
          <F k="nameEn" error={err("nameEn")} label={S.nameEn}>
            {input("nameEn", { dir: "ltr" })}
          </F>
          <F k="vatNumber" error={err("vatNumber")} label={S.vatNumber} hint={S.vatHint}>
            {input("vatNumber", { dir: "ltr", numeric: true })}
          </F>
          <F k="crNumber" error={err("crNumber")} label={S.crNumber} hint={S.crHint}>
            {input("crNumber", { dir: "ltr", numeric: true })}
          </F>
        </div>
      </Section>

      <Section id="address" title={A.title}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <F k="buildingNo" error={err("buildingNo")} label={A.buildingNo} hint={A.buildingHint}>
            {input("buildingNo", { dir: "ltr", numeric: true })}
          </F>
          <F k="postalCode" error={err("postalCode")} label={A.postalCode} hint={A.postalHint}>
            {input("postalCode", { dir: "ltr", numeric: true })}
          </F>
          <F k="additionalNo" error={err("additionalNo")} label={A.additionalNo} hint={A.additionalHint} className="col-span-2 sm:col-span-1">
            {input("additionalNo", { dir: "ltr", numeric: true })}
          </F>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <F k="streetAr" error={err("streetAr")} label={A.streetAr}>
            {input("streetAr", { dir: "rtl" })}
          </F>
          <F k="streetEn" error={err("streetEn")} label={A.streetEn}>
            {input("streetEn", { dir: "ltr" })}
          </F>
          <F k="districtAr" error={err("districtAr")} label={A.districtAr}>
            {input("districtAr", { dir: "rtl" })}
          </F>
          <F k="districtEn" error={err("districtEn")} label={A.districtEn}>
            {input("districtEn", { dir: "ltr" })}
          </F>
          <F k="cityAr" error={err("cityAr")} label={A.cityAr}>
            {input("cityAr", { dir: "rtl" })}
          </F>
          <F k="cityEn" error={err("cityEn")} label={A.cityEn}>
            {input("cityEn", { dir: "ltr" })}
          </F>
        </div>
      </Section>

      <Section title={S.contact}>
        <div className="grid gap-4 sm:grid-cols-2">
          <F k="phone" error={err("phone")} label={S.phone}>
            {input("phone", { dir: "ltr", type: "tel" })}
          </F>
          <F k="email" error={err("email")} label={S.email}>
            {input("email", { dir: "ltr", type: "email" })}
          </F>
        </div>
      </Section>

      <Section title={S.bank}>
        <div className="grid gap-4 sm:grid-cols-2">
          <F k="bankAr" error={err("bankAr")} label={S.bankAr}>
            {input("bankAr", { dir: "rtl" })}
          </F>
          <F k="bankEn" error={err("bankEn")} label={S.bankEn}>
            {input("bankEn", { dir: "ltr" })}
          </F>
          <F k="iban" error={err("iban")} label={S.iban} hint={S.ibanHint} className="sm:col-span-2">
            {input("iban", { dir: "ltr" })}
          </F>
        </div>
      </Section>

      <Section title={S.numbering} aside={<span className="tnum text-[13.5px] font-semibold text-muted">{S.example(next)}</span>}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <F k="invoicePrefix" error={err("invoicePrefix")} label={S.invoicePrefix}>
            {input("invoicePrefix", { dir: "ltr" })}
          </F>
          <F k="creditPrefix" error={err("creditPrefix")} label={S.creditPrefix}>
            {input("creditPrefix", { dir: "ltr" })}
          </F>
          <F k="quotePrefix" error={err("quotePrefix")} label={S.quotePrefix}>
            {input("quotePrefix", { dir: "ltr" })}
          </F>
          <F k="nextInvoice" error={err("nextInvoice")} label={S.nextInvoice}>
            {input("nextInvoice", { dir: "ltr", numeric: true })}
          </F>
        </div>
        <p className="mt-2 text-[13px] text-muted">
          {S.prefixHint}. {S.nextHint}
        </p>
      </Section>

      <Section title={S.terms}>
        <div className="grid gap-4 sm:grid-cols-2">
          <F k="termsDays" error={err("termsDays")} label={S.termsDays} hint={S.termsHint}>
            {input("termsDays", { dir: "ltr", numeric: true })}
          </F>
        </div>
      </Section>

      <Section title={S.notes}>
        <div className="grid gap-4 sm:grid-cols-2">
          <F k="notesAr" error={err("notesAr")} label={S.notesAr}>
            <textarea value={v.notesAr} onChange={set("notesAr")} dir="rtl" rows={3} className={textareaClass} />
          </F>
          <F k="notesEn" error={err("notesEn")} label={S.notesEn}>
            <textarea value={v.notesEn} onChange={set("notesEn")} dir="ltr" rows={3} className={textareaClass} />
          </F>
        </div>
      </Section>

      <Section title={S.seal}>
        <div className="flex flex-wrap items-center gap-6">
          <Seal
            nameAr={v.nameAr}
            nameEn={v.nameEn}
            crNumber={v.crNumber || null}
            cityAr={v.cityAr || null}
            inked
            className={cn("size-[150px] shrink-0 transition-opacity", !v.stamp && "opacity-30")}
          />
          <div className="min-w-0 flex-1">
            <label className="flex items-center gap-3">
              <Switch
                checked={v.stamp}
                onChange={(on) => {
                  setSaved(false);
                  setV((x) => ({ ...x, stamp: on }));
                }}
                label={S.sealToggle}
              />
              <span className="text-[15px] font-semibold text-ink">{S.sealToggle}</span>
            </label>
            <p className="mt-2 max-w-[360px] text-[14px] leading-relaxed text-muted">{S.sealHint}</p>
          </div>
        </div>
      </Section>

      <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-end gap-3 border-t border-rule bg-desk/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <p className="me-auto text-[14px] font-semibold text-paid" aria-live="polite">
          {saved ? (
            <span className="inline-flex items-center gap-1.5">
              <Icon.check size={17} strokeWidth={2.4} />
              {S.saved}
            </span>
          ) : null}
        </p>
        <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>
          {pending ? <Spinner /> : null}
          {S.save}
        </button>
      </div>
    </form>
  );
}
