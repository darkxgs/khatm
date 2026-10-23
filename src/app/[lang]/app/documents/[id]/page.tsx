import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { convertQuoteAction, creditNoteAction, deleteDraftAction, deletePaymentAction, duplicateAction, voidQuoteAction } from "@/app/[lang]/app/actions";
import { AppShell, AppSkeleton } from "@/components/app/shell";
import { PaymentButton, PrintButton, RunButton, ShareRow } from "@/components/doc/doc-actions";
import { InvoiceDocument } from "@/components/doc/invoice-document";
import { Fit } from "@/components/fit";
import { Money } from "@/components/money";
import { buttonClass, cn, Icon, StateChip } from "@/components/ui";
import { daysBetween, formatDay } from "@/lib/dates";
import { clockTime } from "@/lib/format";
import { dict, isLang } from "@/lib/i18n";
import { money } from "@/lib/money";
import { nameIn } from "@/lib/party";
import { serverNow } from "@/server/auth";
import { docData, stampFor } from "@/server/doc-view";
import { publicOrigin } from "@/server/origin";
import { appPage } from "@/server/page";
import { documentDetail, summaryOf } from "@/server/queries";

export async function generateMetadata({ params }: PageProps<"/[lang]/app/documents/[id]">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dict(lang).docs.title, robots: { index: false } } : {};
}

export default function DocumentPage(props: PageProps<"/[lang]/app/documents/[id]">) {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <DocumentRoute {...props} />
    </Suspense>
  );
}

type Event = { at: string; time?: Date | null; text: string; tone?: "paid" | "seal" | "muted" };

async function DocumentRoute({ params, searchParams }: PageProps<"/[lang]/app/documents/[id]">) {
  const p = await appPage(params);
  const { lang, t, business, today } = p;
  const { id } = await params;
  const sp = await searchParams;
  const [det, sum] = await Promise.all([documentDetail(p.db, business.id, id), summaryOf(p.db, business.id, id, today)]);
  if (!det || !sum) notFound();
  const { doc, payments, related } = det;
  const V = t.view;
  const draft = doc.status === "draft";
  const invoice = doc.kind === "tax" || doc.kind === "simplified";
  const reference = related.find((r) => r.id === doc.referenceId) ?? null;
  const credits = related.filter((r) => r.kind === "credit" && r.status === "issued" && r.id !== doc.referenceId);
  const conversions = related.filter((r) => (r.kind === "tax" || r.kind === "simplified") && r.id !== doc.referenceId);
  const lastPaid = payments.reduce<string | null>((a, x) => (!a || x.paidOn > a ? x.paidOn : a), null);
  const lastCredit = credits.reduce<string | null>((a, x) => (x.issueDate && (!a || x.issueDate > a) ? x.issueDate : a), null);
  const just = typeof sp.just === "string" ? sp.just : null;
  const data = docData({
    doc,
    lines: det.lines,
    business,
    customer: det.customer,
    reference: reference ? { number: reference.number, issueDate: reference.issueDate } : null,
    stamp: stampFor(sum.state, lastPaid, lastCredit, just === "paid"),
  });
  const origin = await publicOrigin();
  const link = doc.shareToken ? `${origin}/${lang}/i/${doc.shareToken}` : null;
  const title = doc.number ?? t.draftKind[doc.kind];
  const customerName = data.buyer ? nameIn(data.buyer, lang) : invoice ? t.docs.noCustomer : null;
  const late = sum.state === "overdue" && doc.dueDate ? daysBetween(doc.dueDate, today) : 0;

  // The document's life, oldest first.
  const events: Event[] = [{ at: doc.createdAt.toISOString().slice(0, 10), time: doc.createdAt, text: V.events.created, tone: "muted" }];
  if (doc.issuedAt && doc.number) events.push({ at: doc.issueDate ?? doc.issuedAt.toISOString().slice(0, 10), time: doc.issuedAt, text: V.events.issued(doc.number), tone: "seal" });
  if (doc.viewedAt) events.push({ at: doc.viewedAt.toISOString().slice(0, 10), time: doc.viewedAt, text: V.events.viewed });
  for (const pay of payments) events.push({ at: pay.paidOn, text: V.events.payment(money(pay.amount, lang), t.methods[pay.method]) });
  for (const c of credits) events.push({ at: c.issueDate ?? "", text: V.events.credit(c.number ?? "", money(c.total, lang)) });
  for (const c of conversions) events.push({ at: c.issueDate ?? today, text: c.number ? V.events.converted(c.number) : V.events.convertedDraft });
  if (sum.state === "paid" && lastPaid) events.push({ at: lastPaid, text: V.events.settled, tone: "paid" });
  if (doc.status === "void") events.push({ at: doc.updatedAt.toISOString().slice(0, 10), text: V.events.withdrawn, tone: "muted" });
  events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const kindLabel = t.kinds[doc.kind];
  const message = link ? V.messageText(kindLabel, doc.number ?? "", link) : "";

  return (
    <AppShell lang={lang} user={p.account.user} business={business} section="documents" altPath={`/${lang}/app/documents/${id}`} now={serverNow()} wide>
      <div className="no-print mb-5 lg:mb-7">
        <Link href={`/${lang}/app/documents`} className="mb-2 inline-flex items-center gap-1 rounded-control text-[14px] font-semibold text-muted hover:text-ink">
          <Icon.back size={17} />
          {t.docs.title}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.015em] text-ink sm:text-[30px]">
            <bdi dir={doc.number ? "ltr" : undefined}>{title}</bdi>
          </h1>
          <StateChip state={sum.state} label={t.states[sum.state]} />
          {late ? <span className="text-[14px] font-semibold text-late">{t.late(late)}</span> : null}
        </div>
        <p className="mt-1 text-[15px] text-ink-2">
          {kindLabel}
          {customerName ? (
            <>
              {" "}
              {lang === "ar" ? "إلى" : "for"} <span className="font-semibold text-ink">{customerName}</span>
            </>
          ) : null}
        </p>
      </div>

      {/* On a phone: what's owed, then the page, then everything else. On a wide screen the page sits on the left. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:grid-rows-[auto_1fr] lg:gap-x-8 print:block">
        <div className="no-print lg:col-start-2 lg:row-start-1">
          {invoice && !draft ? (
            <section className="rounded-panel border border-rule bg-paper p-5">
              {sum.balance > 0 ? (
                <>
                  <p className="text-[14px] font-semibold text-ink-2">{V.balance}</p>
                  <p className="mt-0.5 text-[28px] font-extrabold tracking-[-0.01em] text-ink">
                    <Money value={sum.balance} lang={lang} />
                  </p>
                </>
              ) : (
                <p className="flex items-center gap-2 text-[18px] font-extrabold text-paid">
                  <Icon.check size={22} strokeWidth={2.4} />
                  {sum.state === "credited" ? t.states.credited : V.paidInFull}
                </p>
              )}
              <dl className="mt-3 grid gap-1.5 border-t border-rule-2 pt-3 text-[14px]">
                <Row label={V.total} value={<Money value={sum.total} lang={lang} />} />
                {sum.paid ? <Row label={V.paid} value={<Money value={sum.paid} lang={lang} sign="−" />} /> : null}
                {sum.credited ? <Row label={V.credited} value={<Money value={sum.credited} lang={lang} sign="−" />} /> : null}
              </dl>
              {sum.balance > 0 ? <PaymentButton lang={lang} docId={doc.id} balance={sum.balance} today={today} className="mt-4" /> : null}
            </section>
          ) : draft ? (
            <section className="grid gap-2 rounded-panel border border-rule bg-paper p-5">
              <p className="mb-1 text-[14px] text-muted">{V.draftNote}</p>
              <Link href={`/${lang}/app/documents/${doc.id}/edit`} className={buttonClass("primary", "lg", "w-full")}>
                <Icon.edit size={18} />
                {V.editDraft}
              </Link>
              <RunButton action={deleteDraftAction.bind(null, lang, doc.id)} variant="quiet-danger" confirm={{ text: V.deleteConfirm, cancel: t.common.cancel }}>
                <Icon.trash size={18} />
                {V.deleteDraft}
              </RunButton>
            </section>
          ) : (
            <section className="grid gap-2 rounded-panel border border-rule bg-paper p-5">
              {link ? <ShareRow lang={lang} link={link} message={message} subject={V.emailSubject(kindLabel, doc.number ?? "", nameIn(business, lang))} /> : null}
              <PrintButton label={V.print} className="w-full" />
              {link ? <p className="mt-1 text-[12.5px] leading-snug text-muted">{V.shareHelp}</p> : null}
            </section>
          )}
        </div>

        <aside className="no-print grid content-start gap-5 lg:col-start-2 lg:row-start-2">
          {invoice && !draft ? (
            <section className="grid gap-2 rounded-panel border border-rule bg-paper p-5">
              {link ? <ShareRow lang={lang} link={link} message={message} subject={V.emailSubject(kindLabel, doc.number ?? "", nameIn(business, lang))} /> : null}
              <PrintButton label={V.print} className="w-full" />
              {link ? <p className="mt-1 text-[12.5px] leading-snug text-muted">{V.shareHelp}</p> : null}
            </section>
          ) : null}

          {!draft ? (
            <section className="grid gap-2">
              {invoice && sum.state !== "credited" ? (
                <RunButton action={creditNoteAction.bind(null, lang, doc.id)} variant="ghost" className="w-full">
                  <Icon.credit size={18} />
                  {V.credit}
                </RunButton>
              ) : null}
              {doc.kind === "quote" && doc.status === "issued" && conversions.length === 0 ? (
                <>
                  <RunButton action={convertQuoteAction.bind(null, lang, doc.id, "tax")} variant="primary" className="w-full">
                    <Icon.convert size={18} />
                    {V.convert}
                  </RunButton>
                  <RunButton action={convertQuoteAction.bind(null, lang, doc.id, "simplified")} variant="ghost" className="w-full">
                    <Icon.convert size={18} />
                    {V.convertSimple}
                  </RunButton>
                </>
              ) : null}
              {doc.kind !== "credit" ? (
                <RunButton action={duplicateAction.bind(null, lang, doc.id)} variant="ghost" className="w-full">
                  <Icon.duplicate size={18} />
                  {V.duplicate}
                </RunButton>
              ) : null}
              {doc.kind === "quote" && doc.status === "issued" && conversions.length === 0 ? (
                <RunButton action={voidQuoteAction.bind(null, doc.id)} variant="quiet-danger" className="w-full" confirm={{ text: V.withdrawConfirm, cancel: t.common.cancel }}>
                  <Icon.close size={18} />
                  {V.withdraw}
                </RunButton>
              ) : null}
            </section>
          ) : null}

          {invoice && !draft ? (
            <section>
              <h2 className="mb-2 text-[15px] font-bold text-ink-2">{V.payments}</h2>
              {payments.length ? (
                <ul className="divide-y divide-rule-2 rounded-panel border border-rule bg-paper">
                  {payments.map((pay) => (
                    <li key={pay.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-ink">
                          <Money value={pay.amount} lang={lang} />
                        </p>
                        <p className="text-[13px] text-muted">
                          {formatDay(pay.paidOn, lang)}, {t.methods[pay.method]}
                        </p>
                        {pay.note ? <p className="mt-0.5 text-[13px] text-ink-2">{pay.note}</p> : null}
                      </div>
                      <RunButton action={deletePaymentAction.bind(null, pay.id)} variant="ghost" className="h-8 px-2 text-[13px]" confirm={{ text: V.removePayment, cancel: t.common.cancel }}>
                        <Icon.trash size={16} />
                        <span className="sr-only">{V.removePayment}</span>
                      </RunButton>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-panel border border-dashed border-faint px-4 py-3 text-[14px] text-muted">{V.noPayments}</p>
              )}
            </section>
          ) : null}

          {related.length ? (
            <section>
              <h2 className="mb-2 text-[15px] font-bold text-ink-2">{V.related}</h2>
              <ul className="divide-y divide-rule-2 rounded-panel border border-rule bg-paper">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/${lang}/app/documents/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-well">
                      <span>
                        <span className="tnum block text-[14.5px] font-bold text-ink">
                          <bdi dir="ltr">{r.number ?? t.docs.unnumbered}</bdi>
                        </span>
                        <span className="block text-[12.5px] text-muted">{t.kinds[r.kind]}</span>
                      </span>
                      <Money value={r.kind === "credit" ? -r.total : r.total} lang={lang} className="text-[14px] text-ink-2" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="mb-2 text-[15px] font-bold text-ink-2">{V.history}</h2>
            <ol className="relative grid gap-3 ps-6 before:absolute before:inset-y-2 before:start-[5px] before:w-px before:bg-rule">
              {events.map((e, i) => (
                <li key={i} className="relative">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -start-6 top-[7px] size-[11px] rounded-full border-2 bg-desk",
                      e.tone === "paid" ? "border-paid bg-paid" : e.tone === "seal" ? "border-seal" : e.tone === "muted" ? "border-faint" : "border-ink-2",
                    )}
                  />
                  <p className={cn("text-[14px] font-semibold", e.tone === "paid" ? "text-paid" : "text-ink")}>{e.text}</p>
                  <p className="tnum text-[12.5px] text-muted">
                    {e.at ? formatDay(e.at, lang) : ""}
                    {e.time ? `, ${clockTime(e.time, lang, business.timezone)}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </aside>

        <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <Fit pageClassName="rounded-[4px] shadow-[0_1px_2px_rgb(23_26_44/0.08),0_18px_48px_-18px_rgb(23_26_44/0.35)]">
            <InvoiceDocument data={{ ...data, sealDrop: just === "issued" }} />
          </Fit>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
