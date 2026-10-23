import Link from "next/link";
import { daysBetween, formatDay } from "@/lib/dates";
import { dict } from "@/lib/i18n";
import type { DocSummary, Lang } from "@/lib/types";
import { Money } from "../money";
import { cn, StateChip } from "../ui";

/**
 * Documents as a ledger: one row per document, each row a link. On a phone
 * the columns fold into two lines.
 */
export function DocList({ docs, lang, today, hideCustomer, empty }: { docs: DocSummary[]; lang: Lang; today: string; hideCustomer?: boolean; empty?: string }) {
  const t = dict(lang);
  if (docs.length === 0) return <p className="rounded-panel border border-dashed border-faint px-5 py-10 text-center text-[15px] text-muted">{empty ?? t.docs.empty}</p>;
  const cols = hideCustomer ? "md:grid-cols-[150px_110px_minmax(0,1fr)_130px_130px_136px]" : "md:grid-cols-[124px_minmax(0,1fr)_98px_minmax(0,124px)_118px_118px_128px]";
  return (
    <div className="overflow-hidden rounded-panel border border-rule bg-paper">
      <div aria-hidden className={cn("hidden gap-4 border-b border-rule bg-well px-5 py-2.5 text-[12.5px] font-semibold text-muted md:grid", cols)}>
        <span>{t.docs.cols.number}</span>
        {hideCustomer ? null : <span>{t.docs.cols.customer}</span>}
        <span>{t.docs.cols.date}</span>
        <span>{t.docs.cols.due}</span>
        <span className="text-end">{t.docs.cols.total}</span>
        <span className="text-end">{t.docs.cols.balance}</span>
        <span>{t.docs.cols.state}</span>
      </div>
      <ul className="divide-y divide-rule-2">
        {docs.map((d) => {
          const customer = d.customerName ? (lang === "ar" ? d.customerName.ar || d.customerName.en : d.customerName.en || d.customerName.ar) : t.docs.noCustomer;
          const late = d.state === "overdue" && d.dueDate ? daysBetween(d.dueDate, today) : 0;
          const dueIn = (d.state === "unpaid" || d.state === "partial") && d.dueDate ? daysBetween(today, d.dueDate) : null;
          const invoice = d.kind === "tax" || d.kind === "simplified";
          return (
            <li key={d.id}>
              <Link
                href={`/${lang}/app/documents/${d.id}`}
                className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 transition-colors hover:bg-well focus-visible:bg-well sm:px-5", cols)}
              >
                <span className="min-w-0">
                  <span className={cn("tnum block truncate text-[15px] font-bold", d.number ? "text-ink" : "text-muted")}>
                    <bdi dir="ltr">{d.number ?? t.docs.unnumbered}</bdi>
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">{t.kindsShort[d.kind]}</span>
                </span>
                {/* On a phone the status sits beside the number. */}
                <span className="justify-self-end md:hidden">
                  <StateChip state={d.state} label={t.states[d.state]} />
                </span>
                {hideCustomer ? null : <span className="col-span-2 line-clamp-2 text-[14.5px] leading-snug font-semibold text-ink-2 md:col-span-1">{customer}</span>}
                <span className="tnum hidden text-[14px] text-ink-2 md:block">{d.issueDate ? formatDay(d.issueDate, lang) : "—"}</span>
                <span className={cn("hidden text-[14px] md:block", late ? "font-semibold text-late" : "text-ink-2")}>
                  {late
                    ? t.late(late)
                    : dueIn != null && dueIn >= 0 && dueIn <= 14
                      ? t.dueIn(dueIn)
                      : d.dueDate && invoice && d.status === "issued" && d.state !== "paid" && d.state !== "credited"
                        ? formatDay(d.dueDate, lang)
                        : "—"}
                </span>
                <span className="text-[14px] text-ink-2 md:text-end">
                  <Money value={d.kind === "credit" ? -d.total : d.total} lang={lang} />
                </span>
                <span className={cn("justify-self-end text-[14.5px] md:text-end", d.balance ? "font-bold text-ink" : "text-muted")}>
                  {invoice && d.status === "issued" ? <Money value={d.balance} lang={lang} /> : "—"}
                </span>
                <span className="hidden md:block">
                  <StateChip state={d.state} label={t.states[d.state]} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
