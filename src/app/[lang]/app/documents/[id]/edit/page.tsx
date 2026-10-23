import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell, AppSkeleton } from "@/components/app/shell";
import { Editor } from "@/components/editor/editor";
import { dict, isLang } from "@/lib/i18n";
import { serverNow } from "@/server/auth";
import { editorData, referenceOf } from "@/server/editor-data";
import { appPage } from "@/server/page";
import { documentDetail } from "@/server/queries";

export async function generateMetadata({ params }: PageProps<"/[lang]/app/documents/[id]/edit">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dict(lang).docs.title, robots: { index: false } } : {};
}

export default function EditDocument(props: PageProps<"/[lang]/app/documents/[id]/edit">) {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <EditRoute {...props} />
    </Suspense>
  );
}

async function EditRoute({ params }: PageProps<"/[lang]/app/documents/[id]/edit">) {
  const p = await appPage(params);
  const { lang, business, today } = p;
  const { id } = await params;
  const det = await documentDetail(p.db, business.id, id);
  if (!det) notFound();
  // Issued documents are final.
  if (det.doc.status !== "draft") redirect(`/${lang}/app/documents/${id}`);
  const [data, reference] = await Promise.all([editorData(p.db, business), referenceOf(p.db, business.id, det.doc.referenceId)]);
  const { doc } = det;
  return (
    <AppShell lang={lang} user={p.account.user} business={business} section="documents" altPath={`/${lang}/app/documents/${id}/edit`} now={serverNow()} wide hideMobileNav>
      <Editor
        key={doc.id}
        lang={lang}
        today={today}
        reference={reference}
        initial={{
          id: doc.id,
          kind: doc.kind,
          customerId: doc.customerId,
          issueDate: doc.issueDate,
          supplyDate: doc.supplyDate,
          dueDate: doc.dueDate,
          notesAr: doc.notesAr,
          notesEn: doc.notesEn,
          reasonAr: doc.reasonAr,
          reasonEn: doc.reasonEn,
          referenceId: doc.referenceId,
          lines: det.lines.map((l) => ({
            productId: l.productId,
            nameAr: l.nameAr,
            nameEn: l.nameEn,
            unitAr: l.unitAr,
            unitEn: l.unitEn,
            qtyMilli: l.qtyMilli,
            unitPrice: l.unitPrice,
            discountBps: l.discountBps,
            vat: l.vat,
          })),
        }}
        {...data}
      />
    </AppShell>
  );
}
