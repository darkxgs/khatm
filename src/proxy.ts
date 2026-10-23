import { NextResponse, type NextRequest } from "next/server";

/**
 * Links without a language go to the visitor's: their earlier choice, else
 * their browser's. Arabic for everyone else. Share links (/i/...) keep working
 * when a customer types them without a language too.
 */
export function proxy(req: NextRequest) {
  const saved = req.cookies.get("khatm_lang")?.value;
  const first = (req.headers.get("accept-language") ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  const lang = saved === "ar" || saved === "en" ? saved : first.startsWith("en") ? "en" : "ar";
  const path = req.nextUrl.pathname === "/" ? "" : req.nextUrl.pathname;
  return NextResponse.redirect(new URL(`/${lang}${path}${req.nextUrl.search}`, req.url));
}

export const config = { matcher: ["/", "/i/:path*", "/app/:path*", "/verify", "/signin", "/signup"] };
