import type { Metadata } from "next";
import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/noto-kufi-arabic/wght.css";
import "./globals.css";
import Link from "next/link";
import { Mark } from "@/components/brand";

export const metadata: Metadata = { title: "Not found | Khatm" };

export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-dvh bg-desk text-ink">
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
          <Link href="/" className="self-start" aria-label="ختم / Khatm">
            <Mark className="size-10 text-seal" />
          </Link>
          <h1 className="mt-8 text-[28px] leading-tight font-bold">لا شيء بهذا الرابط</h1>
          <p className="mt-2 text-[16px] text-ink-2">ربما كُتب الرابط خطأً، أو حُذف المستند.</p>
          <p lang="en" dir="ltr" className="mt-6 text-right text-[16px] text-ink-2">
            Nothing at this address. The link may be mistyped, or the document was deleted.
          </p>
          <Link href="/" className="mt-8 inline-flex h-11 items-center self-start rounded-control bg-ink px-5 text-[15px] font-semibold text-white">
            ختم / Khatm
          </Link>
        </main>
      </body>
    </html>
  );
}
