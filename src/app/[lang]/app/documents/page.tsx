import type { Metadata } from "next";
import { Suspense } from "react";
import { DocList } from "@/components/app/doc-list";
import { FilterTabs, SearchBox } from "@/components/app/list-controls";
import { NewMenu } from "@/components/app/new-menu";
import { AppShell, AppSkeleton, PageHead } from "@/components/app/shell";
import { dict, isLang } from "@/lib/i18n";
import { serverNow } from "@/server/auth";
import { appPage } from "@/server/page";
import { listDocuments, type ListFilter } from "@/server/queries";

const FILTERS: ListFilter[] = ["all", "invoices", "unpaid", "overdue", "paid", "quotes", "credits", "drafts"];

export async function generateMetadata({ params }: PageProps<"/[lang]/app/documents">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dict(lang).docs.title, robots: { index: false } } : {};
}

export default function Documents(props: PageProps<"/[lang]/app/documents">) {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <DocumentsRoute {...props} />
    </Suspense>
  );
}

async function DocumentsRoute({ params, searchParams }: PageProps<"/[lang]/app/documents">) {
  const p = await appPage(params);
  const { lang, t, business, today } = p;
  const sp = await searchParams;
  const filter = FILTERS.includes(sp.filter as ListFilter) ? (sp.filter as ListFilter) : "all";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const docs = await listDocuments(p.db, business.id, today, filter, q);
  const href = (f: ListFilter) => `/${lang}/app/documents${f === "all" ? "" : `?filter=${f}`}`;
  const newItems = (["tax", "simplified", "quote"] as const).map((kind) => ({ kind, label: t.kinds[kind], hint: t.kindHint[kind] }));
  return (
    <AppShell lang={lang} user={p.account.user} business={business} section="documents" altPath={`/${lang}/app/documents`} now={serverNow()}>
      <PageHead title={t.docs.title} sub={t.docs.count(docs.length)} actions={<NewMenu lang={lang} label={t.nav.newInvoice} items={newItems} align="end" className="hidden lg:block" />} />
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <FilterTabs label={t.docs.title} active={filter} tabs={FILTERS.map((f) => ({ key: f, label: t.docs.filters[f], href: href(f) }))} />
        <SearchBox placeholder={t.docs.search} />
      </div>
      <DocList docs={docs} lang={lang} today={today} empty={q ? t.docs.empty : t.docs.emptyFilter[filter]} />
    </AppShell>
  );
}
