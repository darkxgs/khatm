import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { DocList } from "@/components/app/doc-list";
import { AppShell, AppSkeleton } from "@/components/app/shell";
import { AgingBars } from "@/components/charts/aging-bars";
import { SalesChart } from "@/components/charts/sales-chart";
import { Money } from "@/components/money";
import { buttonClass, cn, Icon } from "@/components/ui";
import { addDays, formatDay, monthLabel, quarterOf } from "@/lib/dates";
import { dict, isLang, monthName } from "@/lib/i18n";
import { money } from "@/lib/money";
import { serverNow } from "@/server/auth";
import { appPage } from "@/server/page";
import { customersOf, dashboard } from "@/server/queries";

export async function generateMetadata({ params }: PageProps<"/[lang]/app">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dict(lang).dashboard.title, robots: { index: false } } : {};
}

export default function Overview(props: PageProps<"/[lang]/app">) {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <OverviewRoute {...props} />
    </Suspense>
  );
}

async function OverviewRoute({ params }: PageProps<"/[lang]/app">) {
  const p = await appPage(params);
  const { lang, t, business, today } = p;
  const D = t.dashboard;
  const [d, customers] = await Promise.all([dashboard(p.db, business.id, today), customersOf(p.db, business.id)]);
  const q = quarterOf(today);
  // A quarterly return is due by the end of the month after the quarter.
  const returnDue = addDays(`${addDays(q.end, 32).slice(0, 7)}-01`, -1);
  const openCount = d.aging.reduce((a, b) => a + b.count, 0);
  const fresh = d.recent.length === 0;

  return (
    <AppShell lang={lang} user={p.account.user} business={business} section="overview" altPath={`/${lang}/app`} now={serverNow()}>
      {p.account.user.isDemo ? <p className="mb-6 rounded-[10px] bg-seal-soft px-4 py-2.5 text-[14px] text-seal">{t.demo.banner}</p> : null}
      {fresh ? (
        <Start lang={lang} hasVat={!!business.vatNumber} hasAddress={!!(business.cityAr || business.cityEn)} hasCustomer={customers.length > 0} />
      ) : (
        <>
          {/* What's owed, as a sentence. */}
          <section className="max-w-[760px]">
            <h1 className={cn("text-[28px] font-extrabold text-ink sm:text-[36px]", lang === "ar" ? "leading-[1.45]" : "leading-[1.12] tracking-[-0.025em]")}>
              {d.outstanding ? D.owed(money(d.outstanding, lang)) : D.owedNone}
            </h1>
            {d.outstanding ? (
              <p className="mt-2 text-[16px] text-ink-2 sm:text-[17px]">
                {D.across(openCount)} <span className={cn(d.overdueCount && "font-semibold text-late")}>{D.lateLine(d.overdueCount, money(d.overdue, lang))}</span>
              </p>
            ) : null}
          </section>

          <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12">
            <section aria-labelledby="aging">
              <h2 id="aging" className="text-[15px] font-bold text-ink-2">
                {D.aging}
              </h2>
              <AgingBars
                className="mt-4 border-t-2 border-ink pt-4"
                format={(v) => money(v, lang)}
                countLabel={D.invoicesCount}
                rows={d.aging.map((a) => ({ key: a.bucket, label: D.buckets[a.bucket], amount: a.amount, count: a.count, late: a.bucket !== "current" }))}
              />
            </section>
            <section className="grid content-start gap-6">
              <Figure label={D.received(monthName(today, lang))} value={<Money value={d.paidThisMonth} lang={lang} />} />
              <Figure
                label={D.vatQuarter(d.quarter.quarter)}
                value={<Money value={d.vatThisQuarter} lang={lang} />}
                note={
                  <>
                    {D.returnDue(formatDay(returnDue, lang, "long"))}{" "}
                    <Link href={`/${lang}/app/vat`} className="font-semibold text-seal underline decoration-seal/30 underline-offset-2 hover:decoration-seal">
                      {D.seeVat}
                    </Link>
                  </>
                }
              />
            </section>
          </div>

          <section className="mt-10 lg:mt-12" aria-labelledby="sales">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h2 id="sales" className="text-[15px] font-bold text-ink-2">
                {D.sales}
              </h2>
              <p className="text-[13px] text-muted">{D.salesSub}</p>
            </div>
            <div className="mt-4 border-t-2 border-ink pt-6">
              <SalesChart
                caption={D.salesTable}
                monthHeader={D.month}
                valueHeader={D.sales}
                lang={lang}
                points={d.months.map((m) => ({
                  key: m.key,
                  label: monthLabel(m.key, lang),
                  long: `${monthName(`${m.key}-01`, lang)} ${m.key.slice(0, 4)}`,
                  value: Math.max(0, m.sales),
                  display: money(m.sales, lang),
                }))}
              />
            </div>
          </section>

          <section className="mt-10 lg:mt-12" aria-labelledby="recent">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 id="recent" className="text-[15px] font-bold text-ink-2">
                {D.recent}
              </h2>
              <Link href={`/${lang}/app/documents`} className="text-[14px] font-semibold text-seal hover:underline">
                {D.allDocs}
              </Link>
            </div>
            <DocList docs={d.recent} lang={lang} today={today} />
          </section>
        </>
      )}
    </AppShell>
  );
}

function Figure({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="border-t-2 border-ink pt-4">
      <p className="text-[15px] font-bold text-ink-2">{label}</p>
      <p className="mt-1 text-[26px] font-extrabold tracking-[-0.01em] text-ink">{value}</p>
      {note ? <p className="mt-1 text-[14px] text-muted">{note}</p> : null}
    </div>
  );
}

/** A new business: the four things between it and its first invoice, in order. */
function Start({ lang, hasVat, hasAddress, hasCustomer }: { lang: "ar" | "en"; hasVat: boolean; hasAddress: boolean; hasCustomer: boolean }) {
  const t = dict(lang).dashboard.start;
  const steps = [
    { label: t.steps[0], done: hasVat, href: `/${lang}/app/settings` },
    { label: t.steps[1], done: hasAddress, href: `/${lang}/app/settings#address` },
    { label: t.steps[2], done: hasCustomer, href: `/${lang}/app/customers?new=1` },
    { label: t.steps[3], done: false, href: `/${lang}/app/documents/new?kind=tax` },
  ];
  const next = steps.findIndex((s) => !s.done);
  return (
    <section className="max-w-[620px]">
      <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ink sm:text-[34px]">{t.title}</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{t.body}</p>
      <ol className="mt-7 grid gap-2.5">
        {steps.map((s, i) => (
          <li key={i}>
            <Link
              href={s.href}
              className={cn(
                "flex items-center gap-4 rounded-[12px] border px-4 py-3.5 transition-colors",
                i === next ? "border-ink bg-paper shadow-[0_1px_2px_rgb(23_26_44/0.06)]" : "border-rule bg-paper/60 hover:bg-paper",
              )}
            >
              <span
                className={cn(
                  "tnum grid size-8 shrink-0 place-items-center rounded-full text-[14px] font-bold",
                  s.done ? "bg-paid text-white" : i === next ? "bg-ink text-white" : "bg-rule-2 text-muted",
                )}
              >
                {s.done ? <Icon.check size={16} strokeWidth={2.6} /> : i + 1}
              </span>
              <span className={cn("flex-1 text-[16px] font-semibold", s.done ? "text-muted line-through decoration-1" : "text-ink")}>{s.label}</span>
              {i === next ? <span className={buttonClass("primary", "sm", "pointer-events-none")}>{t.go}</span> : null}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
