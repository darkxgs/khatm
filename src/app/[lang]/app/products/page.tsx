import type { Metadata } from "next";
import { Suspense } from "react";
import { archiveProductAction } from "@/app/[lang]/app/actions";
import { ProductSheetButton } from "@/components/app/record-sheets";
import { AppShell, AppSkeleton, PageHead } from "@/components/app/shell";
import { RunButton } from "@/components/doc/doc-actions";
import { Money } from "@/components/money";
import { Icon } from "@/components/ui";
import { dict, isLang } from "@/lib/i18n";
import { serverNow } from "@/server/auth";
import { appPage } from "@/server/page";
import { productsOf } from "@/server/queries";

export async function generateMetadata({ params }: PageProps<"/[lang]/app/products">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dict(lang).products.title, robots: { index: false } } : {};
}

export default function Products(props: PageProps<"/[lang]/app/products">) {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <ProductsRoute {...props} />
    </Suspense>
  );
}

async function ProductsRoute({ params }: PageProps<"/[lang]/app/products">) {
  const p = await appPage(params);
  const { lang, t, business } = p;
  const P = t.products;
  const list = await productsOf(p.db, business.id);
  return (
    <AppShell lang={lang} user={p.account.user} business={business} section="products" altPath={`/${lang}/app/products`} now={serverNow()}>
      <PageHead title={P.title} actions={<ProductSheetButton lang={lang} label={P.new} icon={<Icon.plus size={18} strokeWidth={2.2} />} />} />
      {list.length === 0 ? (
        <p className="rounded-panel border border-dashed border-faint px-5 py-10 text-center text-[15px] text-muted">{P.empty}</p>
      ) : (
        <div className="overflow-hidden rounded-panel border border-rule bg-paper">
          <div aria-hidden className="hidden grid-cols-[minmax(0,1fr)_120px_150px_130px_112px] gap-4 border-b border-rule bg-well px-5 py-2.5 text-[12.5px] font-semibold text-muted md:grid">
            <span>{P.cols.name}</span>
            <span>{P.cols.unit}</span>
            <span className="text-end">{P.cols.price}</span>
            <span>{P.cols.vat}</span>
            <span />
          </div>
          <ul className="divide-y divide-rule-2">
            {list.map((x) => (
              <li key={x.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5 md:grid-cols-[minmax(0,1fr)_120px_150px_130px_112px]">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold text-ink">{lang === "ar" ? x.nameAr || x.nameEn : x.nameEn || x.nameAr}</span>
                  <span className="block truncate text-[12.5px] text-muted">{lang === "ar" ? x.nameEn : x.nameAr}</span>
                </span>
                <span className="hidden truncate text-[14px] text-ink-2 md:block">{(lang === "ar" ? x.unitAr || x.unitEn : x.unitEn || x.unitAr) ?? "—"}</span>
                <span className="text-end text-[14.5px] font-semibold text-ink">
                  <Money value={x.price} lang={lang} />
                </span>
                <span className="hidden text-[14px] text-ink-2 md:block">{t.vatShort[x.vat]}</span>
                <span className="col-span-2 flex justify-end gap-1 md:col-span-1">
                  <ProductSheetButton lang={lang} product={x} label={<span className="sr-only">{t.common.edit}</span>} variant="ghost" className="h-9 px-2.5" icon={<Icon.edit size={17} />} />
                  <RunButton action={archiveProductAction.bind(null, x.id)} variant="ghost" className="h-9 px-2.5" confirm={{ text: P.archiveConfirm, cancel: t.common.cancel }}>
                    <Icon.trash size={17} />
                    <span className="sr-only">{P.archive}</span>
                  </RunButton>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
