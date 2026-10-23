import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell, AppSkeleton } from "@/components/app/shell";
import { Editor } from "@/components/editor/editor";
import { dict, isLang } from "@/lib/i18n";
import type { DocKind } from "@/lib/types";
import { serverNow } from "@/server/auth";
import { editorData } from "@/server/editor-data";
import { appPage } from "@/server/page";

export async function generateMetadata({ params }: PageProps<"/[lang]/app/documents/new">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dict(lang).nav.newInvoice, robots: { index: false } } : {};
}

export default function NewDocument(props: PageProps<"/[lang]/app/documents/new">) {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <NewRoute {...props} />
    </Suspense>
  );
}

async function NewRoute({ params, searchParams }: PageProps<"/[lang]/app/documents/new">) {
  const p = await appPage(params);
  const { lang, business, today } = p;
  const sp = await searchParams;
  const kind: DocKind = sp.kind === "simplified" || sp.kind === "quote" ? sp.kind : "tax";
  const data = await editorData(p.db, business);
  const customerId = typeof sp.customer === "string" && data.customers.some((c) => c.id === sp.customer) ? sp.customer : null;
  return (
    <AppShell lang={lang} user={p.account.user} business={business} section="documents" altPath={`/${lang}/app/documents/new?kind=${kind}`} now={serverNow()} wide hideMobileNav>
      <Editor
        lang={lang}
        today={today}
        reference={null}
        initial={{
          id: null,
          kind,
          customerId,
          issueDate: null,
          supplyDate: null,
          dueDate: null,
          notesAr: kind === "quote" ? null : business.notesAr,
          notesEn: kind === "quote" ? null : business.notesEn,
          reasonAr: null,
          reasonEn: null,
          referenceId: null,
          lines: [],
        }}
        {...data}
      />
    </AppShell>
  );
}
