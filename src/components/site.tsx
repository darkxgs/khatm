import Link from "next/link";
import { dict, otherLang } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { Logo } from "./brand";
import { DemoButton } from "./demo-button";
import { LangLink } from "./lang-link";
import { buttonClass } from "./ui";

/** The header on public pages: the brand, the other language, sign in, and the demo. */
export function SiteHeader({ lang, altHref, demo = true }: { lang: Lang; altHref: string; demo?: boolean }) {
  const t = dict(lang);
  const other = otherLang(lang);
  return (
    <header className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6">
      <Logo lang={lang} href={`/${lang}`} />
      <nav className="flex items-center gap-1 sm:gap-2" aria-label={t.nav.main}>
        <LangLink to={other} href={altHref} label={t.otherLangName} />
        <Link href={`/${lang}/signin`} className={buttonClass("ghost", "sm", "hidden sm:inline-flex")}>
          {t.landing.signIn}
        </Link>
        {demo ? <DemoButton lang={lang} label={t.landing.openDemo} size="sm" variant="seal" errors={t.auth.demoErrors} compact /> : null}
      </nav>
    </header>
  );
}

export function SiteFooter({ lang }: { lang: Lang }) {
  const t = dict(lang);
  return (
    <footer className="mx-auto mt-20 flex max-w-[1200px] flex-col gap-3 border-t border-rule px-4 py-8 text-[14px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p>{t.landing.footer}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href={`/${lang}/verify`} className="hover:text-ink">
          {t.verify.title}
        </Link>
        <a href="https://github.com/darkxgs/khatm" className="hover:text-ink">
          {t.landing.source}
        </a>
        <a href="https://seifashraf.dev" className="hover:text-ink">
          seifashraf.dev
        </a>
      </div>
    </footer>
  );
}
