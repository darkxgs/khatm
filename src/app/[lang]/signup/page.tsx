import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site";
import { dict, isLang, otherLang } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/signup">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dict(lang).auth.signUpTitle } : {};
}

export default async function SignUp({ params }: PageProps<"/[lang]/signup">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dict(lang);
  return (
    <>
      <SiteHeader lang={lang} altHref={`/${otherLang(lang)}/signup`} />
      <main className="mx-auto max-w-[420px] px-4 pt-8 pb-16 sm:pt-16">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">{t.auth.signUpTitle}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t.auth.signUpBody}</p>
        <div className="mt-6 rounded-panel border border-rule bg-paper p-5 sm:p-6">
          <AuthForm lang={lang} mode="signup" />
        </div>
      </main>
    </>
  );
}
