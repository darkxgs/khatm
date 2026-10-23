import Link from "next/link";
import { notFound } from "next/navigation";
import { AgingBars } from "@/components/charts/aging-bars";
import { DemoButton } from "@/components/demo-button";
import { Money } from "@/components/money";
import { InvoiceDocument } from "@/components/doc/invoice-document";
import { Fit } from "@/components/fit";
import { AmountWords } from "@/components/landing/amount-words";
import { QrAnatomy } from "@/components/landing/qr-anatomy";
import { SiteFooter, SiteHeader } from "@/components/site";
import { buttonClass, cn, StateChip } from "@/components/ui";
import { dict, isLang, otherLang } from "@/lib/i18n";
import { money } from "@/lib/money";
import { SAMPLE_INVOICE, SAMPLE_QR } from "@/lib/sample";
import type { Lang } from "@/lib/types";

export default async function Landing({ params }: PageProps<"/[lang]">) {
  const { lang: l } = await params;
  if (!isLang(l)) notFound();
  const lang: Lang = l;
  const t = dict(lang);
  const L = t.landing;
  const ar = lang === "ar";

  return (
    <>
      <SiteHeader lang={lang} altHref={`/${otherLang(lang)}`} />
      <main>
        {/* The hero: what it is, and an invoice on the desk getting its stamp. */}
        <section className="mx-auto grid max-w-[1200px] items-start gap-10 px-4 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:gap-14 lg:pt-14">
          <div className="max-w-[560px] lg:pt-12">
            <h1 className={cn("font-extrabold text-ink text-balance", ar ? "text-[34px] leading-[1.45] sm:text-[44px]" : "text-[38px] leading-[1.06] tracking-[-0.03em] sm:text-[52px]")}>
              {L.heroTitle}
            </h1>
            <p className="mt-5 max-w-[500px] text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">{L.heroBody}</p>
            <div className="mt-8 flex flex-wrap items-start gap-3">
              <DemoButton lang={lang} label={L.openDemo} size="lg" variant="seal" errors={t.auth.demoErrors} />
              <Link href={`/${lang}/signup`} className={buttonClass("outline", "lg")}>
                {L.createAccount}
              </Link>
            </div>
            <p className="mt-4 max-w-[440px] text-[14px] leading-relaxed text-muted">{L.demoNote}</p>
          </div>

          <div className="relative mx-auto w-full max-w-[600px] pb-6" aria-label={L.stampAlt} role="img">
            {/* The sheet underneath, a little askew, so this one reads as the top of a pile. */}
            <div
              aria-hidden
              className="absolute inset-x-[3%] top-[18px] bottom-[10px] rotate-[-2.2deg] rounded-[3px] bg-white shadow-[0_1px_2px_rgb(23_26_44/0.08),0_14px_40px_-16px_rgb(23_26_44/0.3)]"
            />
            <div className="relative rotate-[1.1deg]" aria-hidden>
              <Fit pageClassName="rounded-[3px] shadow-[0_1px_2px_rgb(23_26_44/0.08),0_30px_70px_-24px_rgb(23_26_44/0.42)]">
                <InvoiceDocument data={SAMPLE_INVOICE} />
              </Fit>
            </div>
          </div>
        </section>

        {/* Amounts in words. */}
        <section className="mx-auto mt-16 grid max-w-[1200px] gap-8 px-4 sm:px-6 lg:mt-24 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-14">
          <div className="lg:pt-4">
            <h2 className={cn("text-[26px] font-extrabold text-ink sm:text-[30px]", ar ? "leading-snug" : "leading-tight tracking-[-0.02em]")}>{L.wordsTitle}</h2>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{L.wordsBody}</p>
            <dl className="mt-5 grid max-w-[320px] grid-cols-[48px_minmax(0,1fr)] gap-y-2 border-t border-rule pt-4">
              {(
                [
                  ["2", "ريالان"],
                  ["3", "ثلاثة ريالات"],
                  ["11", "أحد عشر ريالًا"],
                  ["100", "مئة ريال"],
                ] as const
              ).map(([n, w]) => (
                <div key={n} className="contents">
                  <dt className="tnum text-[15px] font-bold text-muted">{n}</dt>
                  <dd lang="ar" dir="rtl" className="text-start text-[17px] font-bold text-ink">
                    {w}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <AmountWords label={L.wordsLabel} hint={L.wordsTry} />
        </section>

        {/* The QR code, byte by byte. */}
        <section className="mx-auto mt-16 grid max-w-[1200px] gap-8 px-4 sm:px-6 lg:mt-24 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-14">
          <div className="lg:pt-4">
            <h2 className={cn("text-[26px] font-extrabold text-ink sm:text-[30px]", ar ? "leading-snug" : "leading-tight tracking-[-0.02em]")}>{L.qrTitle}</h2>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{L.qrBody}</p>
            <Link href={`/${lang}/verify`} className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-seal underline decoration-seal/30 underline-offset-4 hover:decoration-seal">
              {L.qrVerify}
            </Link>
          </div>
          <QrAnatomy value={SAMPLE_QR} names={L.qrFields} tagLabel={L.qrTag} bytesLabel={L.qrBytes} />
        </section>

        {/* Corrections and collections: the ledger side. */}
        <section className="mx-auto mt-16 grid max-w-[1200px] gap-10 px-4 sm:px-6 lg:mt-24 lg:grid-cols-2 lg:gap-14">
          <div>
            <h2 className={cn("text-[24px] font-extrabold text-ink sm:text-[26px]", ar ? "leading-snug" : "leading-tight tracking-[-0.02em]")}>{L.creditTitle}</h2>
            <p className="mt-3 max-w-[520px] text-[16px] leading-relaxed text-ink-2">{L.creditBody}</p>
            <CreditChain lang={lang} />
          </div>
          <div>
            <h2 className={cn("text-[24px] font-extrabold text-ink sm:text-[26px]", ar ? "leading-snug" : "leading-tight tracking-[-0.02em]")}>{L.owesTitle}</h2>
            <p className="mt-3 max-w-[520px] text-[16px] leading-relaxed text-ink-2">{L.owesBody}</p>
            <div className="mt-6 border-t-2 border-ink pt-5">
              <p className="sr-only">{L.aging}</p>
              <AgingBars
                format={(v) => money(v, lang)}
                countLabel={t.dashboard.invoicesCount}
                rows={[
                  { key: "current", label: t.dashboard.buckets.current, amount: 1_265_000, count: 2, late: false },
                  { key: "1-30", label: t.dashboard.buckets["1-30"], amount: 2_081_500, count: 2, late: true },
                  { key: "31-60", label: t.dashboard.buckets["31-60"], amount: 605_475, count: 1, late: true },
                  { key: "61-90", label: t.dashboard.buckets["61-90"], amount: 0, count: 0, late: true },
                  { key: "90+", label: t.dashboard.buckets["90+"], amount: 0, count: 0, late: true },
                ]}
              />
            </div>
          </div>
        </section>

        {/* Share links, and the honest limits. */}
        <section className="mx-auto mt-16 grid max-w-[1200px] gap-8 px-4 sm:px-6 lg:mt-24 lg:grid-cols-2 lg:gap-14">
          <div>
            <h2 className={cn("text-[22px] font-extrabold text-ink", ar ? "leading-snug" : "leading-tight tracking-[-0.02em]")}>{L.shareTitle}</h2>
            <p className="mt-3 max-w-[520px] text-[16px] leading-relaxed text-ink-2">{L.shareBody}</p>
          </div>
          <div className="rounded-panel border border-dashed border-faint p-5 sm:p-6">
            <h2 className="text-[18px] font-bold text-ink">{L.scopeTitle}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{L.scopeBody}</p>
          </div>
        </section>

        <section className="mx-auto mt-16 flex max-w-[1200px] flex-wrap items-center gap-3 px-4 sm:px-6">
          <DemoButton lang={lang} label={L.openDemo} size="lg" variant="seal" errors={t.auth.demoErrors} />
          <Link href={`/${lang}/signup`} className={buttonClass("outline", "lg")}>
            {L.createAccount}
          </Link>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}

/** Rewaq's invoice from the demo: two months paid, the third cancelled by credit note. */
function CreditChain({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const rows = [
    { n: "INV-00006", label: t.kinds.tax, amount: 2_242_500, sign: false },
    { n: "CRN-00001", label: t.kinds.credit, amount: 747_500, sign: true },
    { n: "", label: t.methods.transfer, amount: 1_495_000, sign: true },
  ];
  return (
    <div className="mt-6 border-t-2 border-ink pt-5">
      <ol className="relative grid gap-4 before:absolute before:inset-y-3 before:start-[7px] before:w-px before:bg-rule">
        {rows.map((r, i) => (
          <li key={i} className="relative flex items-baseline justify-between gap-3 ps-7">
            <span className={cn("absolute start-0 top-1.5 size-[15px] rounded-full border-2 bg-paper", i === 0 ? "border-ink" : i === 1 ? "border-seal" : "border-paid")} aria-hidden />
            <span className="min-w-0">
              <span className="block text-[15px] font-bold text-ink">{r.n ? <bdi dir="ltr">{r.n}</bdi> : r.label}</span>
              {r.n ? <span className="block text-[13px] text-muted">{r.label}</span> : null}
            </span>
            <Money value={r.amount} lang={lang} sign={r.sign ? "−" : undefined} className="text-[15px] font-semibold text-ink" />
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-rule pt-4">
        <span className="text-[14px] font-semibold text-ink-2">{t.landing.chain.balance}</span>
        <span className="flex items-center gap-3">
          <Money value={0} lang={lang} className="text-[15px] font-bold text-ink" />
          <StateChip state="paid" label={t.states.paid} />
        </span>
      </div>
    </div>
  );
}
