import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchBox } from "@/components/app/list-controls";
import { CustomerSheetButton } from "@/components/app/record-sheets";
import { AppShell, AppSkeleton, PageHead } from "@/components/app/shell";
import { Money } from "@/components/money";
import { cn, Icon } from "@/components/ui";
import { dict, isLang } from "@/lib/i18n";
import { countryName, nameIn } from "@/lib/party";
import { serverNow } from "@/server/auth";
import { appPage } from "@/server/page";
import { customerBalances, customersOf } from "@/server/queries";

export async function generateMetadata({ params }: PageProps<"/[lang]/app/customers">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dict(lang).customers.title, robots: { index: false } } : {};
}

export default function Customers(props: PageProps<"/[lang]/app/customers">) {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <CustomersRoute {...props} />
    </Suspense>
  );
}

async function CustomersRoute({ params, searchParams }: PageProps<"/[lang]/app/customers">) {
  const p = await appPage(params);
  const { lang, t, business, today } = p;
  const C = t.customers;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const [all, balances] = await Promise.all([customersOf(p.db, business.id), customerBalances(p.db, business.id, today)]);
  const list = all
    .filter((c) => !q || `${c.nameAr} ${c.nameEn} ${c.vatNumber ?? ""} ${c.cityAr ?? ""} ${c.cityEn ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => (balances.get(b.id)?.balance ?? 0) - (balances.get(a.id)?.balance ?? 0) || nameIn(a, lang).localeCompare(nameIn(b, lang), lang));
  return (
    <AppShell lang={lang} user={p.account.user} business={business} section="customers" altPath={`/${lang}/app/customers`} now={serverNow()}>
      <PageHead title={C.title} actions={<CustomerSheetButton lang={lang} label={C.new} icon={<Icon.plus size={18} strokeWidth={2.2} />} startOpen={sp.new === "1"} />} />
      <div className="mb-5">
        <SearchBox placeholder={C.search} />
      </div>
      {list.length === 0 ? (
        <p className="rounded-panel border border-dashed border-faint px-5 py-10 text-center text-[15px] text-muted">{q ? C.noMatch : C.empty}</p>
      ) : (
        <div className="overflow-hidden rounded-panel border border-rule bg-paper">
          <div aria-hidden className="hidden grid-cols-[minmax(0,1fr)_170px_150px_160px] gap-4 border-b border-rule bg-well px-5 py-2.5 text-[12.5px] font-semibold text-muted md:grid">
            <span>{C.cols.name}</span>
            <span>{C.cols.vat}</span>
            <span>{C.cols.city}</span>
            <span className="text-end">{C.cols.balance}</span>
          </div>
          <ul className="divide-y divide-rule-2">
            {list.map((c) => {
              const b = balances.get(c.id);
              const city = lang === "ar" ? c.cityAr || c.cityEn : c.cityEn || c.cityAr;
              return (
                <li key={c.id}>
                  <Link
                    href={`/${lang}/app/customers/${c.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-well sm:px-5 md:grid-cols-[minmax(0,1fr)_170px_150px_160px]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold text-ink">{nameIn(c, lang)}</span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {nameIn(c, lang === "ar" ? "en" : "ar")} {c.kind === "person" ? `(${C.kinds.person})` : ""}
                      </span>
                    </span>
                    <span className="tnum hidden truncate text-[14px] text-ink-2 md:block">{c.vatNumber ?? "—"}</span>
                    <span className="hidden truncate text-[14px] text-ink-2 md:block">
                      {city ?? "—"}
                      {c.country !== "SA" ? <span className="text-muted">, {countryName(c.country, lang)}</span> : null}
                    </span>
                    <span className={cn("text-end text-[14.5px]", b?.balance ? "font-bold text-ink" : "text-muted")}>
                      {b?.balance ? <Money value={b.balance} lang={lang} /> : "—"}
                      {b?.overdue ? <span className="block text-[12px] font-semibold text-late">{t.states.overdue}</span> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
