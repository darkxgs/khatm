import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QrVerifier } from "@/components/qr-verifier";
import { SiteFooter, SiteHeader } from "@/components/site";
import { dict, isLang, otherLang } from "@/lib/i18n";
import { SAMPLE_QR } from "@/lib/sample";

export async function generateMetadata({ params }: PageProps<"/[lang]/verify">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dict(lang).verify.title, description: dict(lang).verify.body } : {};
}

export default async function Verify({ params }: PageProps<"/[lang]/verify">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dict(lang).verify;
  return (
    <>
      <SiteHeader lang={lang} altHref={`/${otherLang(lang)}/verify`} />
      <main className="mx-auto max-w-[1200px] px-4 pt-6 sm:px-6 lg:pt-12">
        <h1 className="max-w-[640px] text-[30px] leading-tight font-extrabold tracking-[-0.02em] text-ink sm:text-[38px]">{t.title}</h1>
        <p className="mt-3 max-w-[620px] text-[16px] leading-relaxed text-ink-2">{t.body}</p>
        <div className="mt-8">
          <QrVerifier lang={lang} sample={SAMPLE_QR} />
        </div>
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
