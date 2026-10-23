import Link from "next/link";
import { lang as rootLang } from "next/root-params";
import { SiteFooter, SiteHeader } from "@/components/site";
import { buttonClass } from "@/components/ui";
import { dict, isLang, otherLang } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export default async function NotFound() {
  const l = await rootLang();
  const lang: Lang = isLang(l) ? l : "ar";
  const t = dict(lang).notFound;
  return (
    <>
      <SiteHeader lang={lang} altHref={`/${otherLang(lang)}`} />
      <main className="mx-auto max-w-2xl px-4 pt-10 sm:pt-20">
        <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.02em]">{t.title}</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{t.body}</p>
        <Link href={`/${lang}`} className={buttonClass("primary", "md", "mt-7")}>
          {t.home}
        </Link>
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
