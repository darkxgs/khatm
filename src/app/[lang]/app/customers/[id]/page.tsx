import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { archiveCustomerAction } from "@/app/[lang]/app/actions";
import { DocList } from "@/components/app/doc-list";
import { CustomerSheetButton } from "@/components/app/record-sheets";
import { AppShell, AppSkeleton } from "@/components/app/shell";
import { RunButton } from "@/components/doc/doc-actions";
import { Money } from "@/components/money";
import { buttonClass, Icon } from "@/components/ui";
import { and, eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { dict, isLang } from "@/lib/i18n";
import { addressAr, addressEn, countryName, nameIn } from "@/lib/party";
import { serverNow } from "@/server/auth";
import { customerBalance } from "@/server/business";
import { partyOf } from "@/server/docs";
import { appPage } from "@/server/page";
import { listDocuments } from "@/server/queries";

export async function generateMetadata({ params }: PageProps<"/[lang]/app/customers/[id]">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dict(lang).customers.title, robots: { index: false } } : {};
}

export default function CustomerPage(props: PageProps<"/[lang]/app/customers/[id]">) {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <CustomerRoute {...props} />
    </Suspense>
  );
}

async function CustomerRoute({ params }: PageProps<"/[lang]/app/customers/[id]">) {
  const p = await appPage(params);
  const { lang, t, business, today } = p;
  const C = t.customers;
  const { id } = await params;
  const [c] = await p.db
    .select()
    .from(s.customers)
    .where(and(eq(s.customers.id, id), eq(s.customers.businessId, business.id)));
  if (!c) notFound();
  const [bal, docs] = await Promise.all([customerBalance(p.db, business.id, id), listDocuments(p.db, business.id, today, "all", "", id)]);
  const party = partyOf(c);
  const address = lang === "ar" ? addressAr(party) : addressEn(party);
  const data = { ...c, kind: c.kind };
  return (
    <AppShell lang={lang} user={p.account.user} business={business} section="customers" altPath={`/${lang}/app/customers/${id}`} now={serverNow()}>
      <Link href={`/${lang}/app/customers`} className="mb-2 inline-flex items-center gap-1 text-[14px] font-semibold text-muted hover:text-ink">
        <Icon.back size={17} />
        {C.title}
      </Link>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-[620px]">
          <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.015em] text-ink sm:text-[30px]">{nameIn(c, lang)}</h1>
          <p className="mt-0.5 text-[15px] text-muted">{nameIn(c, lang === "ar" ? "en" : "ar")}</p>
          <dl className="mt-4 grid gap-1 text-[14px] text-ink-2">
            {c.vatNumber ? (
              <div className="flex gap-2">
                <dt className="text-muted">{C.vatNumber}</dt>
                <dd className="tnum font-semibold text-ink">{c.vatNumber}</dd>
              </div>
            ) : null}
            {c.crNumber ? (
              <div className="flex gap-2">
                <dt className="text-muted">{C.crNumber}</dt>
                <dd className="tnum">{c.crNumber}</dd>
              </div>
            ) : null}
            {address.length ? <dd>{address.join(lang === "ar" ? "، " : ", ")}</dd> : null}
            {c.country !== "SA" ? <dd>{countryName(c.country, lang)}</dd> : null}
            {c.email || c.phone ? (
              <dd className="flex flex-wrap gap-x-4">
                {c.email ? <bdi dir="ltr">{c.email}</bdi> : null}
                {c.phone ? <bdi dir="ltr">{c.phone}</bdi> : null}
              </dd>
            ) : null}
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${lang}/app/documents/new?kind=${c.kind === "person" ? "simplified" : "tax"}&customer=${c.id}`} className={buttonClass("primary", "md")}>
            <Icon.plus size={18} strokeWidth={2.2} />
            {C.invoiceThem}
          </Link>
          <CustomerSheetButton lang={lang} customer={data} label={t.common.edit} variant="outline" icon={<Icon.edit size={18} />} />
        </div>
      </div>

      <section className="mb-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t-2 border-ink pt-5 sm:grid-cols-4">
        <Fig label={C.billed} value={<Money value={bal.invoiced} lang={lang} />} />
        <Fig label={C.paid} value={<Money value={bal.paid} lang={lang} />} />
        <Fig label={C.credited} value={<Money value={bal.credited} lang={lang} />} />
        <Fig label={C.balance} value={<Money value={bal.balance} lang={lang} />} strong />
      </section>

      <h2 className="mb-4 text-[15px] font-bold text-ink-2">{C.documents}</h2>
      <DocList docs={docs} lang={lang} today={today} hideCustomer empty={C.noDocs} />

      <div className="mt-10 max-w-[360px]">
        <RunButton action={archiveCustomerAction.bind(null, lang, c.id)} variant="quiet-danger" confirm={{ text: C.archiveConfirm, cancel: t.common.cancel }}>
          <Icon.trash size={18} />
          {C.archive}
        </RunButton>
      </div>
    </AppShell>
  );
}

function Fig({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div>
      <p className="text-[13.5px] font-semibold text-muted">{label}</p>
      <p className={strong ? "mt-0.5 text-[22px] font-extrabold text-ink" : "mt-0.5 text-[18px] font-bold text-ink-2"}>{value}</p>
    </div>
  );
}
