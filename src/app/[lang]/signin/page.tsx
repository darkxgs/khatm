import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { DemoButton } from "@/components/demo-button";
import { SiteHeader } from "@/components/site";
import { dict, isLang, otherLang } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/signin">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dict(lang).auth.signInTitle } : {};
}

export default async function SignIn({ params }: PageProps<"/[lang]/signin">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dict(lang);
  return (
    <>
      <SiteHeader lang={lang} altHref={`/${otherLang(lang)}/signin`} demo={false} signIn={false} />
      <main className="mx-auto max-w-[420px] px-4 pt-8 pb-16 sm:pt-16">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">{t.auth.signInTitle}</h1>
        <div className="mt-6 rounded-panel border border-rule bg-paper p-5 sm:p-6">
          <AuthForm lang={lang} mode="signin" />
        </div>
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <p className="text-[14px] text-muted">{t.auth.orDemo}</p>
          <DemoButton lang={lang} label={t.landing.openDemo} variant="outline" errors={t.auth.demoErrors} />
        </div>
      </main>
    </>
  );
}
