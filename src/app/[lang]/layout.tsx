import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/noto-kufi-arabic/wght.css";
import "../globals.css";
import { dict, dirOf, isLang } from "@/lib/i18n";
import { staticOrigin } from "@/server/origin";

export async function generateStaticParams() {
  return [{ lang: "ar" }, { lang: "en" }];
}

export const viewport: Viewport = { themeColor: "#eceef3" };

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return {
    metadataBase: new URL(staticOrigin()),
    title: { default: t.meta.title, template: `%s | ${t.brand}` },
    description: t.meta.description,
    alternates: { languages: { ar: "/ar", en: "/en" } },
    openGraph: { title: t.meta.title, description: t.meta.description, type: "website", locale: lang === "ar" ? "ar_SA" : "en_US" },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} dir={dirOf(lang)}>
      <body className="min-h-dvh bg-desk text-ink">{children}</body>
    </html>
  );
}
