import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Mark } from "@/components/brand";
import { CopyButton } from "@/components/copy-button";
import { PrintButton } from "@/components/doc/doc-actions";
import { InvoiceDocument } from "@/components/doc/invoice-document";
import { Fit } from "@/components/fit";
import { LangLink } from "@/components/lang-link";
import { Money } from "@/components/money";
import { Seal } from "@/components/seal";
import { cn, Icon } from "@/components/ui";
import { getConnection } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatDay, todayIn } from "@/lib/dates";
import { dict, isLang, otherLang } from "@/lib/i18n";
import { money } from "@/lib/money";
import { nameIn } from "@/lib/party";
import { formatIban } from "@/lib/zatca";
import { currentAccount } from "@/server/auth";
import { docData, stampFor } from "@/server/doc-view";
import { markViewed } from "@/server/docs";
import { docState, documentByToken } from "@/server/queries";

export async function generateMetadata({ params }: PageProps<"/[lang]/i/[token]">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLang(lang) ? dict(lang).kinds.tax : "Invoice", robots: { index: false, follow: false } };
}

export default function SharedDocument(props: PageProps<"/[lang]/i/[token]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-desk" />}>
      <SharedRoute {...props} />
    </Suspense>
  );
}

async function SharedRoute({ params }: PageProps<"/[lang]/i/[token]">) {
  await connection();
  const { lang, token } = await params;
  if (!isLang(lang)) notFound();
  const t = dict(lang);
  const conn = await getConnection();
  const found = await documentByToken(conn.db, token);
  if (!found) notFound();
  const { doc, lines, paid, credited, timezone, reference } = found;
  const today = todayIn(timezone);
  const state = docState({ kind: doc.kind, status: doc.status, total: doc.total, paid, credited, due_date: doc.dueDate }, today);
  const [biz] = await conn.db.select().from(s.businesses).where(eq(s.businesses.id, doc.businessId));
  // The business looking at its own link isn't the customer opening it.
  const viewer = await currentAccount(conn);
  if (viewer?.business.id !== doc.businessId) await markViewed(conn.db, doc.id);
  const lastPaid = paid
    ? ((await conn.db.select({ d: s.payments.paidOn }).from(s.payments).where(eq(s.payments.documentId, doc.id)))
        .map((x) => x.d)
        .sort()
        .at(-1) ?? null)
    : null;
  const data = docData({ doc, lines, business: biz, customer: null, reference, stamp: stampFor(state, lastPaid, null) });
  const seller = doc.seller!;
  const invoice = doc.kind === "tax" || doc.kind === "simplified";
  const balance = invoice ? Math.max(0, doc.total - paid - credited) : 0;
  const S = t.share;

  return (
    <div className="min-h-dvh">
      <header className="no-print border-b border-rule bg-paper">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-3 px-4 sm:px-6">
          <Seal nameAr={seller.nameAr} nameEn={seller.nameEn} crNumber={seller.crNumber} className="size-9 shrink-0" />
          <p className="min-w-0 truncate text-[16px] font-bold text-ink">{nameIn(seller, lang)}</p>
          <div className="ms-auto flex items-center gap-1">
            <LangLink to={otherLang(lang)} href={`/${otherLang(lang)}/i/${token}`} label={t.otherLangName} />
          </div>
        </div>
      </header>

      <main className="print-bare mx-auto grid max-w-[1180px] items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8 lg:py-10 print:block">
        <aside className="no-print grid gap-4 lg:sticky lg:top-6 lg:order-2">
          <section className="rounded-panel border border-rule bg-paper p-5">
            <p className="text-[13px] font-semibold text-muted">{t.kinds[doc.kind]}</p>
            <p className="tnum text-[22px] font-extrabold text-ink">
              <bdi dir="ltr">{doc.number}</bdi>
            </p>
            <div
              className={cn(
                "mt-3 rounded-[10px] px-3.5 py-3 text-[15px] font-semibold",
                state === "paid" ? "bg-paid-soft text-paid" : state === "overdue" ? "bg-late-soft text-late" : state === "credited" || state === "void" ? "bg-well text-ink-2" : "bg-well text-ink",
              )}
            >
              {state === "paid" ? (
                <span className="flex items-center gap-2">
                  <Icon.check size={18} strokeWidth={2.4} />
                  {lastPaid ? S.paidOn(formatDay(lastPaid, lang, "long")) : S.paidNote}
                </span>
              ) : state === "credited" ? (
                S.creditedNote
              ) : state === "void" ? (
                S.withdrawnNote
              ) : invoice && balance > 0 ? (
                state === "overdue" ? (
                  S.balanceLate(money(balance, lang))
                ) : (
                  S.balanceDue(money(balance, lang), doc.dueDate ? formatDay(doc.dueDate, lang, "long") : "")
                )
              ) : (
                <Money value={doc.total} lang={lang} />
              )}
            </div>
            <PrintButton label={t.view.print} className="mt-3 w-full" />
          </section>

          {invoice && balance > 0 && seller.iban ? (
            <section className="rounded-panel border border-rule bg-paper p-5">
              <h2 className="text-[15px] font-bold text-ink">{S.payBy}</h2>
              <dl className="mt-3 grid gap-3 text-[14px]">
                <div>
                  <dt className="text-muted">{S.bank}</dt>
                  <dd className="font-semibold text-ink">{lang === "ar" ? seller.bankAr || seller.bankEn : seller.bankEn || seller.bankAr}</dd>
                </div>
                <div>
                  <dt className="flex items-center justify-between gap-2 text-muted">
                    {S.iban}
                    <CopyButton value={seller.iban} label={t.common.copy} done={t.common.copied} className="-me-2" />
                  </dt>
                  <dd dir="ltr" className="tnum text-start text-[15px] font-bold tracking-[0.03em] text-ink">
                    {formatIban(seller.iban)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{S.reference}</dt>
                  <dd className="tnum font-semibold text-ink">
                    <bdi dir="ltr">{doc.number}</bdi>
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}
        </aside>

        <div className="lg:order-1">
          <Fit pageClassName="rounded-[4px] shadow-[0_1px_2px_rgb(23_26_44/0.08),0_18px_48px_-18px_rgb(23_26_44/0.35)]">
            <InvoiceDocument data={data} />
          </Fit>
        </div>
      </main>

      <footer className="no-print mx-auto flex max-w-[1180px] items-center gap-2 px-4 pb-10 text-[13px] text-muted sm:px-6">
        <Mark className="size-5 text-seal" />
        <Link href={`/${lang}`} className="hover:text-ink">
          {S.issuedWith}
        </Link>
      </footer>
    </div>
  );
}
