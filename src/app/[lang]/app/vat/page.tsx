import type { Metadata } from "next";
import { Suspense } from "react";
import { CsvButton } from "@/components/app/csv-button";
import { FilterTabs } from "@/components/app/list-controls";
import { AppShell, AppSkeleton, PageHead } from "@/components/app/shell";
import { Money } from "@/components/money";
import { cn } from "@/components/ui";
import { addDays, formatDay, quarterOf } from "@/lib/dates";
import { dict, isLang } from "@/lib/i18n";
import { serverNow } from "@/server/auth";
import { appPage } from "@/server/page";
import { vatReturn } from "@/server/queries";

export async function generateMetadata({ params }: PageProps<"/[lang]/app/vat">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dict(lang).vatPage.title, robots: { index: false } } : {};
}

export default function Vat(props: PageProps<"/[lang]/app/vat">) {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <VatRoute {...props} />
    </Suspense>
  );
}

async function VatRoute({ params, searchParams }: PageProps<"/[lang]/app/vat">) {
  const p = await appPage(params);
  const { lang, t, business, today } = p;
  const V = t.vatPage;
  const sp = await searchParams;
  // This quarter and the five before it.
  const quarters: ReturnType<typeof quarterOf>[] = [];
  let day = today;
  for (let i = 0; i < 6; i++) {
    const q = quarterOf(day);
    quarters.push(q);
    day = addDays(q.start, -1);
  }
  const key = (q: { year: number; quarter: number }) => `${q.year}-Q${q.quarter}`;
  const q = quarters.find((x) => key(x) === sp.q) ?? quarters[0];
  const r = await vatReturn(p.db, business.id, q.start, q.end);
  const due = addDays(`${addDays(q.end, 32).slice(0, 7)}-01`, -1);
  const csv: (string | number)[][] = [
    [V.cols.category, V.cols.sales, V.cols.credits, V.cols.net, V.cols.vat],
    ...r.rows.map((x) => [V.rows[x.key], x.sales / 100, x.credits / 100, x.net / 100, x.vat / 100]),
    [V.total, r.totals.sales / 100, r.totals.credits / 100, r.totals.net / 100, r.totals.vat / 100],
  ];
  return (
    <AppShell lang={lang} user={p.account.user} business={business} section="vat" altPath={`/${lang}/app/vat${sp.q ? `?q=${sp.q}` : ""}`} now={serverNow()}>
      <PageHead title={V.title} sub={V.body} actions={<CsvButton rows={csv} filename={`vat-${key(q)}.csv`} label={V.download} />} />
      <FilterTabs label={V.pick} active={key(q)} tabs={quarters.map((x, i) => ({ key: key(x), label: V.quarter(x.quarter, x.year), href: `/${lang}/app/vat${i === 0 ? "" : `?q=${key(x)}`}` }))} />

      <div className="mt-7 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-[15px] font-semibold text-ink-2">{V.period(formatDay(q.start, lang, "long"), formatDay(q.end, lang, "long"))}</p>
        <p className="text-[14px] text-muted">
          {V.due(formatDay(due, lang, "long"))}. {V.docs(r.documents)}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto rounded-panel border border-rule bg-paper">
        <table className="w-full min-w-[620px] border-collapse text-[14.5px]">
          <thead>
            <tr className="border-b border-rule bg-well text-[12.5px] font-semibold text-muted">
              <th scope="col" className="px-5 py-2.5 text-start font-semibold">
                {V.cols.category}
              </th>
              <th scope="col" className="px-4 py-2.5 text-end font-semibold">
                {V.cols.sales}
              </th>
              <th scope="col" className="px-4 py-2.5 text-end font-semibold">
                {V.cols.credits}
              </th>
              <th scope="col" className="px-4 py-2.5 text-end font-semibold">
                {V.cols.net}
              </th>
              <th scope="col" className="px-5 py-2.5 text-end font-semibold">
                {V.cols.vat}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule-2">
            {r.rows.map((x) => {
              const empty = !x.sales && !x.credits;
              return (
                <tr key={x.key} className={cn(empty && "text-muted")}>
                  <th scope="row" className={cn("px-5 py-3.5 text-start font-semibold", empty ? "text-muted" : "text-ink")}>
                    {V.rows[x.key]}
                  </th>
                  <td className="px-4 py-3.5 text-end">
                    <Money value={x.sales} lang={lang} />
                  </td>
                  <td className="px-4 py-3.5 text-end">{x.credits ? <Money value={x.credits} lang={lang} sign="−" /> : "—"}</td>
                  <td className={cn("px-4 py-3.5 text-end", !empty && "font-semibold text-ink")}>
                    <Money value={x.net} lang={lang} />
                  </td>
                  <td className={cn("px-5 py-3.5 text-end", x.vat ? "font-bold text-ink" : "")}>{x.key === "S" ? <Money value={x.vat} lang={lang} /> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink">
              <th scope="row" className="px-5 py-4 text-start text-[15px] font-extrabold text-ink">
                {V.total}
              </th>
              <td className="px-4 py-4 text-end font-semibold text-ink">
                <Money value={r.totals.sales} lang={lang} />
              </td>
              <td className="px-4 py-4 text-end font-semibold text-ink">{r.totals.credits ? <Money value={r.totals.credits} lang={lang} sign="−" /> : "—"}</td>
              <td className="px-4 py-4 text-end font-bold text-ink">
                <Money value={r.totals.net} lang={lang} />
              </td>
              <td className="px-5 py-4 text-end text-[17px] font-extrabold text-ink">
                <Money value={r.totals.vat} lang={lang} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {r.documents === 0 ? <p className="mt-4 text-[14px] text-muted">{V.empty}</p> : null}
      <p className="mt-5 max-w-[620px] text-[14px] leading-relaxed text-muted">{V.purchases}</p>
    </AppShell>
  );
}
