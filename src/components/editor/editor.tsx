"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useRef, useState, useTransition } from "react";
import { saveAndIssueAction, saveDraftAction } from "@/app/[lang]/app/actions";
import { documentTotals, parsePercent, parseQty, parseSar, percentText, qtyText, sar } from "@/lib/amounts";
import { addDays, formatDay } from "@/lib/dates";
import { dict } from "@/lib/i18n";
import { nameIn } from "@/lib/party";
import { amountInArabic, amountInEnglish } from "@/lib/tafqeet";
import type { DocKind, Lang, Party, VatCategory } from "@/lib/types";
import { isVatNumber, VAT_RATES } from "@/lib/zatca";
import { InvoiceDocument, type DocData } from "../doc/invoice-document";
import { Fit } from "../fit";
import { CustomerForm, type CustomerData } from "../forms/customer-form";
import { Sheet } from "../sheet";
import { buttonClass, cn, Field, Icon, inputClass, selectClass, Spinner, textareaClass } from "../ui";

export type ProductOption = { id: string; nameAr: string; nameEn: string; unitAr: string | null; unitEn: string | null; price: number; vat: VatCategory };

export type EditorLine = {
  productId: string | null;
  nameAr: string;
  nameEn: string;
  unitAr: string | null;
  unitEn: string | null;
  qtyMilli: number;
  unitPrice: number;
  discountBps: number;
  vat: VatCategory;
};

export type EditorInitial = {
  id: string | null;
  kind: DocKind;
  customerId: string | null;
  issueDate: string | null;
  supplyDate: string | null;
  dueDate: string | null;
  notesAr: string | null;
  notesEn: string | null;
  reasonAr: string | null;
  reasonEn: string | null;
  referenceId: string | null;
  lines: EditorLine[];
};

type LineState = { key: string; productId: string | null; nameAr: string; nameEn: string; unitAr: string; unitEn: string; qty: string; price: string; discount: string; vat: VatCategory };

let seq = 0;
const lineKey = () => `l${++seq}`;
const blankLine = (): LineState => ({ key: lineKey(), productId: null, nameAr: "", nameEn: "", unitAr: "", unitEn: "", qty: "1", price: "", discount: "", vat: "S" });
const fromLine = (l: EditorLine): LineState => ({
  key: lineKey(),
  productId: l.productId,
  nameAr: l.nameAr,
  nameEn: l.nameEn,
  unitAr: l.unitAr ?? "",
  unitEn: l.unitEn ?? "",
  qty: qtyText(l.qtyMilli).replace(/,/g, ""),
  price: sar(l.unitPrice),
  discount: percentText(l.discountBps),
  vat: l.vat,
});

/** A line read from what's typed: null fields are the ones that don't parse. */
function parseLine(l: LineState) {
  const qtyMilli = parseQty(l.qty);
  const unitPrice = l.price.trim() === "" ? null : parseSar(l.price);
  const discountBps = parsePercent(l.discount);
  const named = !!(l.nameAr.trim() || l.nameEn.trim());
  const blank = !named && l.price.trim() === "";
  const ok = named && qtyMilli != null && unitPrice != null && discountBps != null;
  return { qtyMilli, unitPrice, discountBps, named, blank, ok };
}

const hasAddress = (p: { cityAr: string | null; cityEn: string | null; streetAr: string | null; streetEn: string | null } | null) => !!p && !!(p.cityAr || p.cityEn) && !!(p.streetAr || p.streetEn);

const toParty = (c: CustomerData): Party => ({ ...c });

export function Editor({
  lang,
  initial,
  seller,
  stamp,
  termsDays,
  today,
  nextNumbers,
  customers: initialCustomers,
  products,
  reference,
}: {
  lang: Lang;
  initial: EditorInitial;
  seller: Party;
  stamp: boolean;
  termsDays: number;
  today: string;
  nextNumbers: Record<DocKind, string>;
  customers: CustomerData[];
  products: ProductOption[];
  reference: { id: string; kind: DocKind; number: string | null; issueDate: string | null } | null;
}) {
  const t = dict(lang);
  const E = t.editor;
  const router = useRouter();
  const [docId, setDocId] = useState(initial.id);
  const [kind, setKind] = useState<DocKind>(initial.kind);
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState(initial.customerId);
  const [issueDate, setIssueDate] = useState(initial.issueDate ?? "");
  const [supplyDate, setSupplyDate] = useState(initial.supplyDate ?? "");
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const [notesAr, setNotesAr] = useState(initial.notesAr ?? "");
  const [notesEn, setNotesEn] = useState(initial.notesEn ?? "");
  const [reasonAr, setReasonAr] = useState(initial.reasonAr ?? "");
  const [reasonEn, setReasonEn] = useState(initial.reasonEn ?? "");
  const [lines, setLines] = useState<LineState[]>(() => (initial.lines.length ? initial.lines.map(fromLine) : [blankLine()]));
  const [dirty, setDirty] = useState(!initial.id);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [serverError, setServerError] = useState<{ error: string; index?: number } | null>(null);
  const [saving, startSave] = useTransition();
  const [issuing, startIssue] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState(false);
  const [customerSheet, setCustomerSheet] = useState<null | "new" | "edit">(null);
  const touch = () => {
    setDirty(true);
    setServerError(null);
  };

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const parsed = lines.map(parseLine);
  const used = lines.map((l, i) => ({ l, p: parsed[i] })).filter((x) => !x.p.blank);
  const validLines = used.filter((x) => x.p.ok);
  const totals = documentTotals(validLines.map(({ l, p }) => ({ qtyMilli: p.qtyMilli!, unitPrice: p.unitPrice!, discountBps: p.discountBps!, vat: l.vat })));
  const dueDefault = addDays(issueDate || today, termsDays);

  // What still stands between this draft and issuing it (the server checks the same).
  const problems: string[] = [];
  if (validLines.length === 0) problems.push("lines");
  else if (validLines.length !== used.length) problems.push("line");
  if (kind !== "quote") {
    if (!seller.vatNumber || !isVatNumber(seller.vatNumber)) problems.push("seller_vat");
    if (!hasAddress(seller)) problems.push("seller_address");
  }
  if ((kind === "tax" || kind === "quote") && !customer) problems.push("buyer_required");
  if (kind === "tax" && customer) {
    if (customer.vatNumber && customer.country === "SA" && !isVatNumber(customer.vatNumber)) problems.push("buyer_vat");
    if (!hasAddress(customer)) problems.push("buyer_address");
  }
  if (kind === "credit" && !(reasonAr.trim() || reasonEn.trim())) problems.push("reason");

  const input = () => ({
    kind,
    customerId,
    issueDate: issueDate || null,
    supplyDate: supplyDate || null,
    dueDate: kind === "credit" ? null : dueDate || null,
    notesAr: notesAr || null,
    notesEn: notesEn || null,
    reasonAr: kind === "credit" ? reasonAr || null : null,
    reasonEn: kind === "credit" ? reasonEn || null : null,
    referenceId: initial.referenceId,
    lines: used.map(({ l, p }) => ({
      productId: l.productId,
      nameAr: l.nameAr.trim(),
      nameEn: l.nameEn.trim(),
      unitAr: l.unitAr.trim() || null,
      unitEn: l.unitEn.trim() || null,
      qtyMilli: p.qtyMilli ?? 0,
      unitPrice: p.unitPrice ?? -1,
      discountBps: p.discountBps ?? -1,
      vat: l.vat,
    })),
  });

  const save = () =>
    startSave(async () => {
      const res = await saveDraftAction(docId, input());
      if (!res.ok) return setServerError(res);
      setDirty(false);
      setSavedAt(new Date().toISOString());
      if (!docId) {
        setDocId(res.id);
        router.replace(`/${lang}/app/documents/${res.id}/edit`, { scroll: false });
      }
    });

  const doIssue = () =>
    startIssue(async () => {
      const res = await saveAndIssueAction(docId, input());
      if (res.id && res.id !== docId) setDocId(res.id);
      if (!res.ok) {
        setConfirm(false);
        return setServerError({ error: res.error, index: res.index });
      }
      setDirty(false);
      router.push(`/${lang}/app/documents/${res.id}?just=issued`);
    });

  // Ctrl/Cmd+S saves; leaving with unsaved changes asks first.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setLine = (key: string, patch: Partial<LineState>) => {
    touch();
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };
  const addProduct = (p: ProductOption | null) => {
    touch();
    const line = p ? { ...blankLine(), productId: p.id, nameAr: p.nameAr, nameEn: p.nameEn, unitAr: p.unitAr ?? "", unitEn: p.unitEn ?? "", price: sar(p.price), vat: p.vat } : blankLine();
    setLines((ls) => {
      // Replace a single untouched blank line rather than adding under it.
      if (ls.length === 1 && parseLine(ls[0]).blank && !ls[0].nameAr && !ls[0].nameEn) return [line];
      return [...ls, line];
    });
  };

  // The live document, a beat behind the typing so the form stays quick.
  const docPreview: DocData = {
    kind,
    status: "draft",
    number: null,
    issueDate: issueDate || today,
    supplyDate: supplyDate || null,
    dueDate: kind === "credit" ? null : dueDate || dueDefault,
    seller,
    buyer: customer ? toParty(customer) : null,
    lines: validLines.map(({ l, p }) => ({
      nameAr: l.nameAr,
      nameEn: l.nameEn,
      unitAr: l.unitAr || null,
      unitEn: l.unitEn || null,
      qtyMilli: p.qtyMilli!,
      unitPrice: p.unitPrice!,
      discountBps: p.discountBps!,
      vat: l.vat,
    })),
    qr: null,
    reference: reference ? { number: reference.number, issueDate: reference.issueDate } : null,
    reasonAr: reasonAr || null,
    reasonEn: reasonEn || null,
    notesAr: notesAr || null,
    notesEn: notesEn || null,
    seal: stamp,
    stamp: null,
  };
  const deferred = useDeferredValue(docPreview);

  const problemText = (p: string) => (t.problems as Record<string, string>)[p] ?? t.common.tryAgain;
  const fixFor = (p: string) =>
    p.startsWith("seller") ? (
      <Link href={`/${lang}/app/settings`} className="font-semibold text-seal underline decoration-seal/30 underline-offset-2">
        {t.problems.fix}
      </Link>
    ) : (p === "buyer_address" || p === "buyer_vat") && customer ? (
      <button type="button" onClick={() => setCustomerSheet("edit")} className="font-semibold text-seal underline decoration-seal/30 underline-offset-2">
        {t.problems.fix}
      </button>
    ) : null;

  const kinds: DocKind[] = kind === "credit" ? ["credit"] : ["tax", "simplified", "quote"];
  const title = docId ? E.editTitle(t.kindsShort[kind]) : t.newKind[kind];

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,500px)]">
      <div className="min-w-0">
        <div className="mb-6">
          <Link href={docId ? `/${lang}/app/documents/${docId}` : `/${lang}/app/documents`} className="mb-2 inline-flex items-center gap-1 text-[14px] font-semibold text-muted hover:text-ink">
            <Icon.back size={17} />
            {t.docs.title}
          </Link>
          <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.015em] text-ink sm:text-[30px]">{title}</h1>
          {reference?.number ? (
            <p className="mt-1.5 text-[15px] text-ink-2">
              {reference.kind === "quote" ? E.fromQuote("") : E.against("")}
              <Link href={`/${lang}/app/documents/${reference.id}`} className="tnum font-semibold text-seal hover:underline">
                <bdi dir="ltr">{reference.number}</bdi>
              </Link>
            </p>
          ) : null}
        </div>

        {/* Type */}
        {kinds.length > 1 ? (
          <fieldset className="mb-7">
            <legend className="mb-2 text-[14px] font-semibold text-ink-2">{E.kind}</legend>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {kinds.map((k) => (
                <label
                  key={k}
                  className={cn(
                    "cursor-pointer rounded-[12px] border px-2.5 py-2.5 transition-colors sm:px-3.5 sm:py-3",
                    kind === k ? "border-ink bg-paper shadow-[0_0_0_1px_var(--color-ink)]" : "border-rule bg-paper/60 hover:border-faint hover:bg-paper",
                  )}
                >
                  <input
                    type="radio"
                    name="kind"
                    className="sr-only"
                    checked={kind === k}
                    onChange={() => {
                      touch();
                      setKind(k);
                    }}
                  />
                  <span className="block text-[14px] leading-snug font-bold text-ink sm:text-[15px]">{t.kinds[k]}</span>
                  <span className="mt-0.5 hidden text-[13px] leading-snug text-muted sm:block">{t.kindHint[k]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {/* Customer */}
        <section className="mb-7">
          <CustomerPicker
            lang={lang}
            customers={customers}
            value={customerId}
            allowNone={kind === "simplified" || kind === "credit"}
            onChange={(id) => {
              touch();
              setCustomerId(id);
            }}
            onNew={() => setCustomerSheet("new")}
            onEdit={() => setCustomerSheet("edit")}
          />
        </section>

        {/* Dates */}
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <Field label={E.issueDate} hint={E.issueDateHint}>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => {
                touch();
                setIssueDate(e.target.value);
              }}
              className={inputClass}
              dir="ltr"
            />
          </Field>
          {kind !== "quote" ? (
            <Field label={E.supplyDate} hint={E.supplyDateHint}>
              <input
                type="date"
                value={supplyDate}
                onChange={(e) => {
                  touch();
                  setSupplyDate(e.target.value);
                }}
                className={inputClass}
                dir="ltr"
              />
            </Field>
          ) : null}
          {kind !== "credit" ? (
            <Field label={kind === "quote" ? E.validUntil : E.dueDate} hint={dueDate ? undefined : `${E.dueHint(termsDays)}: ${formatDay(dueDefault, lang)}`}>
              <input
                type="date"
                value={dueDate}
                min={issueDate || undefined}
                onChange={(e) => {
                  touch();
                  setDueDate(e.target.value);
                }}
                className={inputClass}
                dir="ltr"
              />
            </Field>
          ) : null}
        </section>

        {/* Items */}
        <section className="mb-8">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[18px] font-extrabold text-ink">{E.items}</h2>
          </div>
          <ol className="grid gap-3">
            {lines.map((l, i) => (
              <LineEditor
                key={l.key}
                lang={lang}
                index={i}
                line={l}
                parsed={parsed[i]}
                error={serverError?.index === i}
                onChange={(patch) => setLine(l.key, patch)}
                onRemove={
                  lines.length > 1
                    ? () => {
                        touch();
                        setLines((ls) => ls.filter((x) => x.key !== l.key));
                      }
                    : undefined
                }
              />
            ))}
          </ol>
          <ProductMenu lang={lang} products={products} onPick={addProduct} />
        </section>

        {/* Credit note reason */}
        {kind === "credit" ? (
          <section className="mb-8">
            <h2 className="mb-3 text-[18px] font-extrabold text-ink">{E.reason}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={E.reasonAr}>
                <input
                  value={reasonAr}
                  onChange={(e) => {
                    touch();
                    setReasonAr(e.target.value);
                  }}
                  dir="rtl"
                  className={inputClass}
                  maxLength={300}
                />
              </Field>
              <Field label={E.reasonEn}>
                <input
                  value={reasonEn}
                  onChange={(e) => {
                    touch();
                    setReasonEn(e.target.value);
                  }}
                  dir="ltr"
                  className={inputClass}
                  maxLength={300}
                />
              </Field>
            </div>
          </section>
        ) : null}

        {/* Totals, live */}
        <section className="mb-8 rounded-panel border border-rule bg-paper p-5" aria-live="polite">
          <dl className="grid gap-2 text-[15px]">
            <TotalLine label={E.totals.gross} value={sar(totals.gross)} />
            {totals.discount ? <TotalLine label={E.totals.discount} value={`−${sar(totals.discount)}`} /> : null}
            {totals.breakdown.map((b) =>
              b.category === "S" ? (
                <TotalLine key="S" label={E.totals.vat("15%")} value={sar(b.vat)} />
              ) : (
                <TotalLine key={b.category} label={b.category === "Z" ? E.totals.zero : b.category === "E" ? E.totals.exempt : E.totals.outside} value={sar(b.taxable)} muted />
              ),
            )}
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t-2 border-ink pt-3">
              <dt className="text-[16px] font-bold text-ink">{E.totals.total}</dt>
              <dd className="tnum text-[24px] font-extrabold text-ink" dir="ltr">
                <span className="me-1.5 text-[13px] font-bold text-muted">SAR</span>
                {sar(totals.total)}
              </dd>
            </div>
          </dl>
          <div className="mt-3 border-t border-rule-2 pt-3">
            <p className="text-[12.5px] font-semibold text-muted">{E.totals.words}</p>
            <p lang="ar" dir="rtl" className="mt-1 text-[15px] leading-relaxed font-semibold text-ink">
              {amountInArabic(totals.total)}
            </p>
            <p lang="en" dir="ltr" className="mt-0.5 text-[14px] text-ink-2">
              {amountInEnglish(totals.total)}
            </p>
          </div>
        </section>

        {/* Notes */}
        <section className="mb-4">
          <h2 className="mb-3 text-[18px] font-extrabold text-ink">{E.notes}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={E.notesAr}>
              <textarea
                value={notesAr}
                onChange={(e) => {
                  touch();
                  setNotesAr(e.target.value);
                }}
                dir="rtl"
                rows={3}
                maxLength={1000}
                className={textareaClass}
              />
            </Field>
            <Field label={E.notesEn}>
              <textarea
                value={notesEn}
                onChange={(e) => {
                  touch();
                  setNotesEn(e.target.value);
                }}
                dir="ltr"
                rows={3}
                maxLength={1000}
                className={textareaClass}
              />
            </Field>
          </div>
        </section>

        {/* The action bar: it rides along the bottom of the screen while the form scrolls. */}
        <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t border-rule bg-desk/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("me-auto min-w-0 text-[13px] text-muted", serverError ? "basis-full sm:basis-auto" : "hidden sm:block")} aria-live="polite">
              {serverError ? (
                <span className="font-semibold text-late">{serverError.index != null ? E.lineError(serverError.index + 1) : problemText(serverError.error)}</span>
              ) : dirty ? (
                E.unsaved
              ) : savedAt ? (
                t.common.saved
              ) : null}
            </p>
            <button type="button" onClick={() => setPreview(true)} className={buttonClass("ghost", "md", "px-3 xl:hidden")} aria-label={E.preview}>
              <Icon.eye size={18} />
              <span className="hidden sm:inline">{E.preview}</span>
            </button>
            <button type="button" onClick={save} disabled={saving || issuing} className={buttonClass("outline", "md", "ms-auto sm:ms-0")}>
              {saving ? <Spinner /> : null}
              {E.saveDraft}
            </button>
            <button type="button" onClick={() => setConfirm(true)} disabled={saving || issuing} className={buttonClass("seal", "md")}>
              {E.issue[kind]}
            </button>
          </div>
        </div>
      </div>

      {/* The page as it will print. */}
      <aside className="sticky top-6 hidden xl:block" aria-label={E.previewTitle}>
        <Fit pageClassName="rounded-[3px] shadow-[0_1px_2px_rgb(23_26_44/0.08),0_18px_48px_-18px_rgb(23_26_44/0.35)]">
          <InvoiceDocument data={deferred} />
        </Fit>
      </aside>

      <Sheet open={preview} onClose={() => setPreview(false)} label={E.previewTitle} closeLabel={t.common.close} className="max-w-[860px]">
        <div className="bg-desk p-3 sm:p-5">
          <Fit pageClassName="rounded-[3px] shadow-sm">
            <InvoiceDocument data={deferred} />
          </Fit>
        </div>
      </Sheet>

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        label={E.confirmTitle[kind]}
        closeLabel={t.common.close}
        header={<h2 className="px-5 pt-6 pb-1 text-[20px] font-extrabold text-ink">{problems.length ? E.readyTitle : E.confirmTitle[kind]}</h2>}
      >
        <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          {problems.length ? (
            <ul className="grid gap-2">
              {problems.map((p) => (
                <li key={p} className="flex items-start gap-2.5 rounded-[10px] bg-late-soft px-3 py-2.5 text-[14px] text-late">
                  <Icon.alert size={18} className="mt-0.5 shrink-0" />
                  <span className="flex-1">{problemText(p)}</span>
                  {fixFor(p)}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className="text-[15px] leading-relaxed text-ink-2">{kind === "quote" ? E.confirmQuote(nextNumbers[kind]) : E.confirmBody(nextNumbers[kind])}</p>
              <div className="mt-4 flex items-baseline justify-between gap-3 rounded-[12px] bg-well px-4 py-3">
                <span className="text-[14px] font-semibold text-ink-2">{customer ? nameIn(customer, lang) : t.docs.noCustomer}</span>
                <span className="tnum text-[18px] font-extrabold text-ink" dir="ltr">
                  SAR {sar(totals.total)}
                </span>
              </div>
              <button type="button" onClick={doIssue} disabled={issuing} className={buttonClass("seal", "lg", "mt-5 w-full")}>
                {issuing ? <Spinner /> : null}
                {issuing ? E.issuing : E.issue[kind]}
              </button>
            </>
          )}
        </div>
      </Sheet>

      <Sheet
        open={customerSheet !== null}
        onClose={() => setCustomerSheet(null)}
        label={customerSheet === "edit" ? t.customers.edit : t.customers.new}
        closeLabel={t.common.close}
        header={<h2 className="px-5 pt-6 pb-1 text-[20px] font-extrabold text-ink">{customerSheet === "edit" ? t.customers.edit : t.customers.new}</h2>}
      >
        <div className="px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
          {customerSheet ? (
            <CustomerForm
              lang={lang}
              initial={customerSheet === "edit" ? customer : null}
              submitLabel={customerSheet === "edit" ? t.common.save : t.customers.saveNew}
              onSaved={(c) => {
                setCustomers((cs) => (cs.some((x) => x.id === c.id) ? cs.map((x) => (x.id === c.id ? c : x)) : [...cs, c]));
                setCustomerId(c.id);
                touch();
                setCustomerSheet(null);
              }}
            />
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}

function TotalLine({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-muted" : "text-ink-2"}>{label}</dt>
      <dd className={cn("tnum font-semibold", muted ? "text-muted" : "text-ink")} dir="ltr">
        {value}
      </dd>
    </div>
  );
}

/* --------------------------------- a line --------------------------------- */

function LineEditor({
  lang,
  index,
  line,
  parsed,
  error,
  onChange,
  onRemove,
}: {
  lang: Lang;
  index: number;
  line: LineState;
  parsed: ReturnType<typeof parseLine>;
  error: boolean;
  onChange: (patch: Partial<LineState>) => void;
  onRemove?: () => void;
}) {
  const t = dict(lang);
  const E = t.editor;
  const total = parsed.ok ? documentTotals([{ qtyMilli: parsed.qtyMilli!, unitPrice: parsed.unitPrice!, discountBps: parsed.discountBps!, vat: line.vat }]).total : null;
  const bad = (cond: boolean) => (!parsed.blank && cond ? true : undefined);
  return (
    <li className={cn("rounded-panel border bg-paper p-4", error ? "border-late" : "border-rule")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="tnum text-[13px] font-bold text-muted">{E.item(index + 1)}</span>
        {onRemove ? (
          <button type="button" onClick={onRemove} className="-me-1.5 inline-flex h-8 items-center gap-1 rounded-control px-2 text-[13px] font-semibold text-muted hover:bg-late-soft hover:text-late">
            <Icon.trash size={16} />
            <span className="sr-only sm:not-sr-only">{E.removeItem}</span>
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={E.nameAr}>
          <input value={line.nameAr} onChange={(e) => onChange({ nameAr: e.target.value })} dir="rtl" className={inputClass} aria-invalid={bad(!parsed.named)} maxLength={300} />
        </Field>
        <Field label={E.nameEn}>
          <input value={line.nameEn} onChange={(e) => onChange({ nameEn: e.target.value })} dir="ltr" className={inputClass} aria-invalid={bad(!parsed.named)} maxLength={300} />
        </Field>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[84px_minmax(0,1fr)_96px_minmax(0,1fr)]">
        <Field label={E.qty}>
          <input value={line.qty} onChange={(e) => onChange({ qty: e.target.value })} inputMode="decimal" dir="ltr" className={cn(inputClass, "tnum")} aria-invalid={bad(parsed.qtyMilli == null)} />
        </Field>
        <Field label={E.price}>
          <input
            value={line.price}
            onChange={(e) => onChange({ price: e.target.value })}
            inputMode="decimal"
            dir="ltr"
            placeholder="0.00"
            className={cn(inputClass, "tnum")}
            aria-invalid={bad(line.price.trim() === "" || parsed.unitPrice == null)}
          />
        </Field>
        <Field label={E.discount}>
          <input
            value={line.discount}
            onChange={(e) => onChange({ discount: e.target.value })}
            inputMode="decimal"
            dir="ltr"
            placeholder="0"
            className={cn(inputClass, "tnum")}
            aria-invalid={bad(parsed.discountBps == null)}
          />
        </Field>
        <Field label={E.vat}>
          <select value={line.vat} onChange={(e) => onChange({ vat: e.target.value as VatCategory })} className={selectClass} title={t.vatCats[line.vat]}>
            {(Object.keys(VAT_RATES) as VatCategory[]).map((c) => (
              <option key={c} value={c}>
                {t.vatShort[c]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-rule-2 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-muted">{E.unit}</span>
          <input
            value={line.unitEn}
            onChange={(e) => onChange({ unitEn: e.target.value })}
            dir="ltr"
            placeholder="hour"
            aria-label={E.unitEn}
            className={cn(inputClass, "h-9 w-[92px] px-2.5 text-[14px]")}
            maxLength={40}
          />
          <input
            value={line.unitAr}
            onChange={(e) => onChange({ unitAr: e.target.value })}
            dir="rtl"
            placeholder="ساعة"
            aria-label={E.unitAr}
            className={cn(inputClass, "h-9 w-[92px] px-2.5 text-[14px]")}
            maxLength={40}
          />
        </div>
        <p className="flex items-baseline gap-2 text-[14px]">
          <span className="text-muted">{E.lineTotal}</span>
          <span className="tnum font-bold text-ink" dir="ltr">
            {total != null ? `SAR ${sar(total)}` : "—"}
          </span>
        </p>
      </div>
    </li>
  );
}

/* ------------------------------ choosing a customer ------------------------------ */

function CustomerPicker({
  lang,
  customers,
  value,
  allowNone,
  onChange,
  onNew,
  onEdit,
}: {
  lang: Lang;
  customers: CustomerData[];
  value: string | null;
  allowNone: boolean;
  onChange: (id: string | null) => void;
  onNew: () => void;
  onEdit: () => void;
}) {
  const t = dict(lang);
  const E = t.editor;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const selected = customers.find((c) => c.id === value) ?? null;
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const needle = q.trim().toLowerCase();
  const matches = customers.filter((c) => !needle || `${c.nameAr} ${c.nameEn} ${c.vatNumber ?? ""} ${c.cityEn ?? ""} ${c.cityAr ?? ""}`.toLowerCase().includes(needle));
  return (
    <div ref={box} className="relative">
      <span className="mb-1.5 block text-[14px] font-semibold text-ink-2">{E.customer}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            "flex min-h-12 flex-1 items-center justify-between gap-3 rounded-control border bg-paper px-3.5 py-2 text-start transition-colors",
            open ? "border-seal ring-3 ring-seal/15" : "border-rule hover:border-faint",
          )}
        >
          {selected ? (
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold text-ink">{nameIn(selected, lang)}</span>
              <span className="tnum block truncate text-[12.5px] text-muted">
                {[selected.vatNumber, lang === "ar" ? selected.cityAr || selected.cityEn : selected.cityEn || selected.cityAr].filter(Boolean).join("  ") || t.customers.kinds[selected.kind]}
              </span>
            </span>
          ) : (
            <span className="text-[15px] text-muted">{allowNone ? E.noCustomer : E.chooseCustomer}</span>
          )}
          <Icon.chevronDown size={18} className="shrink-0 text-muted" />
        </button>
        {selected ? (
          <button type="button" onClick={onEdit} className={buttonClass("ghost", "md", "min-h-12 px-3")} aria-label={t.customers.edit}>
            <Icon.edit size={18} />
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-[12px] border border-rule bg-paper shadow-[0_16px_40px_-10px_rgb(23_26_44/0.3)]">
          <div className="border-b border-rule-2 p-2">
            <div className="relative">
              <Icon.search size={17} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={E.searchCustomers} aria-label={E.searchCustomers} className={cn(inputClass, "h-10 ps-9")} autoFocus />
            </div>
          </div>
          <ul role="listbox" className="max-h-[300px] overflow-y-auto p-1.5">
            {allowNone ? (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === null}
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="w-full rounded-[8px] px-3 py-2.5 text-start text-[14.5px] font-semibold text-ink-2 hover:bg-well"
                >
                  {E.noCustomer}
                </button>
              </li>
            ) : null}
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.id === value}
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                    setQ("");
                  }}
                  className={cn("flex w-full items-center justify-between gap-3 rounded-[8px] px-3 py-2.5 text-start hover:bg-well", c.id === value && "bg-well")}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-semibold text-ink">{nameIn(c, lang)}</span>
                    <span className="block truncate text-[12.5px] text-muted">{nameIn(c, lang === "ar" ? "en" : "ar")}</span>
                  </span>
                  {c.id === value ? <Icon.check size={18} className="shrink-0 text-seal" strokeWidth={2.4} /> : null}
                </button>
              </li>
            ))}
            {matches.length === 0 ? <li className="px-3 py-3 text-[14px] text-muted">{E.noMatches}</li> : null}
          </ul>
          <div className="border-t border-rule-2 p-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNew();
              }}
              className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2.5 text-[14.5px] font-semibold text-seal hover:bg-seal-soft"
            >
              <Icon.plus size={18} />
              {E.newCustomer}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ adding an item ------------------------------ */

function ProductMenu({ lang, products, onPick }: { lang: Lang; products: ProductOption[]; onPick: (p: ProductOption | null) => void }) {
  const t = dict(lang);
  const E = t.editor;
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={box} className="relative mt-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={buttonClass("outline", "md", "w-full border-dashed sm:w-auto")}>
        <Icon.plus size={18} />
        {E.addItem}
      </button>
      {open ? (
        <div className="absolute start-0 bottom-full z-30 mb-2 w-full overflow-hidden rounded-[12px] border border-rule bg-paper shadow-[0_16px_40px_-10px_rgb(23_26_44/0.3)] sm:w-[420px]">
          <p className="border-b border-rule-2 px-4 py-2 text-[12.5px] font-semibold text-muted">{E.fromCatalogue}</p>
          <ul className="max-h-[320px] overflow-y-auto p-1.5">
            {products.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(p);
                    setOpen(false);
                  }}
                  className="flex w-full items-baseline justify-between gap-3 rounded-[8px] px-3 py-2.5 text-start hover:bg-well"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-semibold text-ink">{lang === "ar" ? p.nameAr || p.nameEn : p.nameEn || p.nameAr}</span>
                    <span className="block truncate text-[12.5px] text-muted">{lang === "ar" ? p.unitAr : p.unitEn}</span>
                  </span>
                  <span className="tnum shrink-0 text-[14px] font-semibold text-ink-2" dir="ltr">
                    {sar(p.price)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-rule-2 p-1.5">
            <button
              type="button"
              onClick={() => {
                onPick(null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2.5 text-[14.5px] font-semibold text-ink-2 hover:bg-well"
            >
              <Icon.plus size={18} />
              {E.blank}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
