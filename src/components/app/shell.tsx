import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/[lang]/actions";
import type { Business, User } from "@/db/schema";
import { dict, otherLang } from "@/lib/i18n";
import { nameIn } from "@/lib/party";
import type { Lang } from "@/lib/types";
import { Mark } from "../brand";
import { LangLink } from "../lang-link";
import { Seal } from "../seal";
import { cn, Icon } from "../ui";
import { MobileNav, type NavItem } from "./mobile-nav";
import { NewMenu } from "./new-menu";

export type Section = "overview" | "documents" | "customers" | "products" | "vat" | "settings";

/**
 * The signed-in frame: a rail on wide screens (the business's seal at the
 * top, the places, then the account), a tab bar on phones. `altPath` is this
 * page in the other language.
 */
export function AppShell({
  lang,
  user,
  business,
  section,
  altPath,
  now,
  children,
  wide,
  hideMobileNav,
}: {
  lang: Lang;
  user: User;
  business: Business;
  section: Section | null;
  altPath: string;
  now: number;
  children: ReactNode;
  wide?: boolean;
  /** For full-screen tasks (the editor) that bring their own bottom bar. */
  hideMobileNav?: boolean;
}) {
  const t = dict(lang);
  const base = `/${lang}/app`;
  const items: (NavItem & { key: Section })[] = [
    { key: "overview", href: base, label: t.nav.overview, icon: "overview", active: section === "overview" },
    { key: "documents", href: `${base}/documents`, label: t.nav.documents, icon: "documents", active: section === "documents" },
    { key: "customers", href: `${base}/customers`, label: t.nav.customers, icon: "customers", active: section === "customers" },
    { key: "products", href: `${base}/products`, label: t.nav.products, icon: "products", active: section === "products" },
    { key: "vat", href: `${base}/vat`, label: t.nav.vat, icon: "vat", active: section === "vat" },
    { key: "settings", href: `${base}/settings`, label: t.nav.settings, icon: "settings", active: section === "settings" },
  ];
  const hoursLeft = user.isDemo && user.expiresAt ? Math.max(1, Math.ceil((user.expiresAt.getTime() - now) / 3_600_000)) : null;
  const name = nameIn(business, lang) || t.settings.business;
  const newItems = (["tax", "simplified", "quote"] as const).map((kind) => ({ kind, label: t.kinds[kind], hint: t.kindHint[kind] }));
  const other = otherLang(lang);

  const accountBits = (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <LangLink to={other} href={altPath.replace(/^\/(ar|en)/, `/${other}`)} label={t.otherLangName} className="px-2.5" />
        <form action={signOutAction}>
          <input type="hidden" name="lang" value={lang} />
          <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-control px-2.5 text-[14px] font-semibold text-ink-2 hover:bg-rule-2 hover:text-ink">
            <Icon.signOut size={18} />
            {t.nav.signOut}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      {/* The rail. */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-e border-rule bg-[#f4f5f8] lg:flex">
        <div className="px-4 pt-5">
          <Link href={`${base}/settings`} className="flex items-center gap-3 rounded-[12px] p-1.5 hover:bg-paper">
            <Seal nameAr={business.nameAr} nameEn={business.nameEn} crNumber={business.crNumber} className="size-11 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] leading-snug font-bold text-ink">{name}</span>
              <span className="tnum block truncate text-[12.5px] text-muted">{business.vatNumber ?? t.problems.seller_vat.replace(/\.$/, "")}</span>
            </span>
          </Link>
          <NewMenu lang={lang} label={t.nav.newInvoice} items={newItems} className="mt-4" full />
        </div>
        <nav className="mt-5 flex-1 overflow-y-auto px-3" aria-label={t.nav.main}>
          <ul className="grid gap-0.5">
            {items.map((it) => {
              const I = Icon[it.icon];
              return (
                <li key={it.key}>
                  <Link
                    href={it.href}
                    aria-current={it.active ? "page" : undefined}
                    className={cn(
                      "relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14.5px] font-semibold transition-colors",
                      it.active ? "bg-paper text-ink shadow-[0_1px_2px_rgb(23_26_44/0.06)]" : "text-ink-2 hover:bg-paper/70 hover:text-ink",
                    )}
                  >
                    {it.active ? <span aria-hidden className="absolute inset-y-2.5 start-0 w-[3px] rounded-e-full bg-seal" /> : null}
                    <I size={19} strokeWidth={it.active ? 2.1 : 1.8} />
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-rule px-3 py-3">
          {hoursLeft ? (
            <div className="mb-2 rounded-[10px] bg-seal-soft px-3 py-2.5">
              <p className="text-[13px] font-bold text-seal">{t.demo.badge}</p>
              <p className="text-[12.5px] text-seal/80">{t.demo.resets(hoursLeft)}</p>
              <Link href={`/${lang}/signup`} className="mt-1 inline-block text-[12.5px] font-semibold text-seal underline decoration-seal/30 underline-offset-2 hover:decoration-seal">
                {t.demo.own}
              </Link>
            </div>
          ) : (
            <p className="truncate px-2.5 pb-1 text-[12.5px] text-muted">{user.email}</p>
          )}
          {accountBits}
        </div>
      </aside>

      {/* Phones: a slim top bar. */}
      <div className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-rule bg-desk/95 px-4 backdrop-blur lg:hidden">
        <Link href={base} className="flex min-w-0 items-center gap-2.5">
          <Seal nameAr={business.nameAr} nameEn={business.nameEn} crNumber={business.crNumber} className="size-8 shrink-0" />
          <span className="truncate text-[15px] font-bold text-ink">{name}</span>
        </Link>
        {hoursLeft ? (
          <span className="ms-auto shrink-0 rounded-full bg-seal-soft px-2.5 py-1 text-[12px] font-bold text-seal">{t.demo.badge}</span>
        ) : (
          <Mark className="ms-auto size-6 shrink-0 text-seal" />
        )}
      </div>

      <div className="min-w-0">
        <main className={cn("print-bare mx-auto px-4 pt-5 sm:px-6 lg:px-10 lg:pt-9 lg:pb-16", hideMobileNav ? "pb-0" : "pb-28", wide ? "max-w-[1320px]" : "max-w-[1120px]")}>{children}</main>
      </div>

      {hideMobileNav ? null : (
        <MobileNav
          main={items.slice(0, 3)}
          more={items.slice(3)}
          newHref={`${base}/documents/new?kind=tax`}
          newLabel={t.nav.newInvoice}
          moreLabel={t.nav.more}
          closeLabel={t.common.close}
          footer={accountBits}
        />
      )}
    </div>
  );
}

/** What a signed-in page shows while it loads: the frame, empty. */
export function AppSkeleton() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="hidden h-dvh border-e border-rule bg-[#f4f5f8] lg:block" />
      <div className="mx-auto w-full max-w-[1120px] px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <div className="h-8 w-48 animate-pulse rounded-[8px] bg-rule-2" />
        <div className="mt-6 h-40 animate-pulse rounded-panel bg-rule-2/70" />
      </div>
    </div>
  );
}

/** A page's heading row: the title, an optional line under it, and actions at the end. */
export function PageHead({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 lg:mb-8">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 rounded-control text-[14px] font-semibold text-muted hover:text-ink">
            <Icon.back size={17} />
            {back.label}
          </Link>
        ) : null}
        <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.015em] text-ink sm:text-[30px]">{title}</h1>
        {sub ? <div className="mt-1.5 text-[15px] text-ink-2">{sub}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
