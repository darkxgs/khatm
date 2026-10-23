import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell, AppSkeleton, PageHead } from "@/components/app/shell";
import { SettingsForm } from "@/components/forms/settings-form";
import { dict, isLang } from "@/lib/i18n";
import { serverNow } from "@/server/auth";
import { appPage } from "@/server/page";

export async function generateMetadata({ params }: PageProps<"/[lang]/app/settings">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dict(lang).settings.title, robots: { index: false } } : {};
}

export default function Settings(props: PageProps<"/[lang]/app/settings">) {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <SettingsRoute {...props} />
    </Suspense>
  );
}

async function SettingsRoute({ params, searchParams }: PageProps<"/[lang]/app/settings">) {
  const p = await appPage(params);
  const { lang, t, business: b } = p;
  const sp = await searchParams;
  const s = (v: string | null) => v ?? "";
  return (
    <AppShell lang={lang} user={p.account.user} business={b} section="settings" altPath={`/${lang}/app/settings`} now={serverNow()}>
      <PageHead title={t.settings.title} />
      <SettingsForm
        key={b.id}
        lang={lang}
        welcome={sp.welcome === "1"}
        initial={{
          nameAr: b.nameAr,
          nameEn: b.nameEn,
          vatNumber: s(b.vatNumber),
          crNumber: s(b.crNumber),
          buildingNo: s(b.buildingNo),
          streetAr: s(b.streetAr),
          streetEn: s(b.streetEn),
          districtAr: s(b.districtAr),
          districtEn: s(b.districtEn),
          cityAr: s(b.cityAr),
          cityEn: s(b.cityEn),
          postalCode: s(b.postalCode),
          additionalNo: s(b.additionalNo),
          phone: s(b.phone),
          email: s(b.email),
          iban: b.iban ? b.iban.replace(/(.{4})/g, "$1 ").trim() : "",
          bankAr: s(b.bankAr),
          bankEn: s(b.bankEn),
          invoicePrefix: b.invoicePrefix,
          creditPrefix: b.creditPrefix,
          quotePrefix: b.quotePrefix,
          nextInvoice: String(b.nextInvoice),
          termsDays: String(b.termsDays),
          notesAr: s(b.notesAr),
          notesEn: s(b.notesEn),
          stamp: b.stamp,
        }}
      />
    </AppShell>
  );
}
