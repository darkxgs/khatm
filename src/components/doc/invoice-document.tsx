import type { ReactNode } from "react";
import { documentTotals, lineAmounts, qtyText, sar } from "@/lib/amounts";
import { formatDay, hijriDay } from "@/lib/dates";
import { addressAr, addressEn, nameIn } from "@/lib/party";
import { amountInArabic, amountInEnglish } from "@/lib/tafqeet";
import type { DocKind, DocStatus, Party, VatCategory } from "@/lib/types";
import { formatIban } from "@/lib/zatca";
import { Qr } from "../qr";
import { Seal } from "../seal";
import { Stamp, type StampKind } from "../stamp";
import { StampDrop } from "../stamp-drop";
import { cn } from "../ui";

// The document itself: an A4 page in both languages, English from the left
// edge and Arabic from the right, as Saudi bilingual invoices are printed. It
// is a pure component, so the editor can draw a draft live in the browser and
// the server can draw issued ones, from the same code.

export type DocLine = {
  nameAr: string;
  nameEn: string;
  unitAr: string | null;
  unitEn: string | null;
  qtyMilli: number;
  unitPrice: number;
  discountBps: number;
  vat: VatCategory;
};

export type DocData = {
  kind: DocKind;
  status: DocStatus;
  number: string | null;
  issueDate: string | null;
  supplyDate: string | null;
  dueDate: string | null;
  seller: Party;
  buyer: Party | null;
  lines: DocLine[];
  qr: string | null;
  reference: { number: string | null; issueDate: string | null } | null;
  reasonAr: string | null;
  reasonEn: string | null;
  notesAr: string | null;
  notesEn: string | null;
  seal: boolean;
  stamp: { kind: StampKind; date?: string | null; animate?: boolean } | null;
  /** Bring the seal down as the page appears (just after issuing). */
  sealDrop?: boolean;
};

type Pair = readonly [en: string, ar: string];

const TITLE: Record<DocKind, Pair> = {
  tax: ["Tax Invoice", "فاتورة ضريبية"],
  simplified: ["Simplified Tax Invoice", "فاتورة ضريبية مبسطة"],
  credit: ["Credit Note", "إشعار دائن"],
  quote: ["Quotation", "عرض سعر"],
};
const NUMBER: Record<DocKind, Pair> = {
  tax: ["Invoice number", "رقم الفاتورة"],
  simplified: ["Invoice number", "رقم الفاتورة"],
  credit: ["Credit note number", "رقم الإشعار"],
  quote: ["Quotation number", "رقم العرض"],
};
const L = {
  issueDate: ["Issue date", "تاريخ الإصدار"],
  supplyDate: ["Supply date", "تاريخ التوريد"],
  dueDate: ["Due date", "تاريخ الاستحقاق"],
  validUntil: ["Valid until", "صالح حتى"],
  billTo: ["Bill to", "العميل"],
  preparedFor: ["Prepared for", "مقدَّم إلى"],
  vatNo: ["VAT No.", "الرقم الضريبي"],
  crNo: ["CR No.", "السجل التجاري"],
  original: ["Original invoice", "الفاتورة الأصلية"],
  dated: ["dated", "بتاريخ"],
  reason: ["Reason", "السبب"],
  n: ["#", "م"],
  desc: ["Description", "الوصف"],
  qty: ["Qty", "الكمية"],
  price: ["Unit price", "سعر الوحدة"],
  disc: ["Discount", "الخصم"],
  taxable: ["Taxable", "الخاضع للضريبة"],
  vat: ["VAT", "الضريبة"],
  total: ["Total", "الإجمالي"],
  gross: ["Total excl. VAT", "الإجمالي غير شامل الضريبة"],
  discount: ["Discount", "الخصم"],
  taxableTotal: ["Total taxable amount", "إجمالي المبلغ الخاضع للضريبة"],
  grand: ["Total incl. VAT", "الإجمالي شامل الضريبة"],
  words: ["Amount in words", "المبلغ كتابةً"],
  bank: ["Payment by bank transfer", "الدفع بالتحويل البنكي"],
  iban: ["IBAN", "الآيبان"],
  notes: ["Notes", "ملاحظات"],
  stamp: ["Stamp and signature", "الختم والتوقيع"],
  notTax: ["This quotation is not a tax invoice.", "عرض السعر هذا ليس فاتورة ضريبية."],
  qrSoon: ["QR code added on issue", "يُضاف رمز QR عند الإصدار"],
  footer: ["Issued electronically with Khatm", "صدر إلكترونيًا عبر ختم"],
  sar: ["SAR", "ر.س"],
} as const satisfies Record<string, Pair>;

const CATEGORY: Record<VatCategory, Pair> = {
  S: ["VAT 15%", "ضريبة القيمة المضافة 15%"],
  Z: ["Zero-rated supplies 0%", "توريدات خاضعة لنسبة الصفر"],
  E: ["Exempt supplies", "توريدات معفاة"],
  O: ["Outside the scope of VAT", "توريدات خارج نطاق الضريبة"],
};

/** A label in both languages: English on the left, Arabic on the right. */
function Bi({ pair, className }: { pair: Pair; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 text-[10.5px] font-semibold text-[#5b6075]", className)}>
      <span>{pair[0]}</span>
      <span lang="ar" dir="rtl">
        {pair[1]}
      </span>
    </div>
  );
}

function PartyColumn({ party, lang, emphasis }: { party: Party; lang: "en" | "ar"; emphasis?: boolean }) {
  const ar = lang === "ar";
  const lines = ar ? addressAr(party) : addressEn(party);
  return (
    <div lang={lang} dir={ar ? "rtl" : "ltr"} className={cn("min-w-0 text-[11.5px] leading-[1.55] text-[#3c4157]", ar ? "text-right" : "text-left")}>
      <p className={cn("leading-snug font-bold text-[#14172a]", emphasis ? "text-[16px]" : "text-[13px]")}>{nameIn(party, lang)}</p>
      {party.vatNumber ? (
        <p className="mt-1">
          <span className="text-[#6b7086]">{ar ? L.vatNo[1] : L.vatNo[0]} </span>
          <bdi className="font-semibold text-[#14172a]">{party.vatNumber}</bdi>
        </p>
      ) : null}
      {party.crNumber ? (
        <p>
          <span className="text-[#6b7086]">{ar ? L.crNo[1] : L.crNo[0]} </span>
          <bdi>{party.crNumber}</bdi>
        </p>
      ) : null}
      {lines.length ? <p className="mt-1">{lines.join(ar ? "، " : ", ")}</p> : null}
      {party.phone || party.email ? (
        <p className={cn("mt-0.5 flex flex-wrap gap-x-3", ar && "justify-end")}>
          {party.phone ? <bdi dir="ltr">{party.phone}</bdi> : null}
          {party.email ? <bdi dir="ltr">{party.email}</bdi> : null}
        </p>
      ) : null}
    </div>
  );
}

function MetaCell({ pair, children, wide }: { pair: Pair; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0 px-3 py-2.5", wide && "col-span-2")}>
      <Bi pair={pair} />
      <div className="mt-1 text-center text-[13.5px] font-bold text-[#14172a]">{children}</div>
    </div>
  );
}

function DateValue({ day }: { day: string | null }) {
  if (!day) return <span className="text-[#9a9eb0]">—</span>;
  return (
    <>
      <span>{formatDay(day, "en")}</span>
      <span lang="ar" dir="rtl" className="block text-[10px] font-medium text-[#6b7086]">
        {hijriDay(day)}
      </span>
    </>
  );
}

export function InvoiceDocument({ data, className }: { data: DocData; className?: string }) {
  const { kind } = data;
  const totals = documentTotals(data.lines);
  const draft = data.status === "draft";
  const quote = kind === "quote";
  const seller = data.seller;
  const hasDiscount = totals.discount > 0;
  const supplyDiffers = data.supplyDate && data.supplyDate !== data.issueDate;
  const words = { ar: amountInArabic(totals.total), en: amountInEnglish(totals.total) };

  return (
    <article
      data-paper
      dir="ltr"
      lang="en"
      className={cn("doc relative isolate flex min-h-[1123px] w-[794px] flex-col overflow-hidden bg-white px-[46px] pt-[42px] pb-[30px]", className)}
      aria-label={`${TITLE[kind][0]} ${data.number ?? ""}`.trim()}
    >
      {draft ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 grid place-items-center">
          <div className="flex -rotate-[28deg] items-center gap-10 text-[118px] font-extrabold tracking-[0.06em] text-[#14172a]/[0.045] select-none">
            <span>DRAFT</span>
            <span lang="ar">مسودة</span>
          </div>
        </div>
      ) : null}

      {/* Seller, in both languages, with the document's name between them. */}
      <header className="grid grid-cols-[1fr_168px_1fr] items-start gap-5">
        <PartyColumn party={seller} lang="en" emphasis />
        <div className="pt-0.5 text-center">
          <p lang="ar" dir="rtl" className="text-[21px] leading-tight font-extrabold text-[#14172a]">
            {TITLE[kind][1]}
          </p>
          <p className="mt-1 text-[14px] font-bold text-[#3c4157]">{TITLE[kind][0]}</p>
        </div>
        <PartyColumn party={seller} lang="ar" emphasis />
      </header>

      {/* Number and dates. */}
      <section className="mt-6 grid grid-cols-4 divide-x divide-[#dfe2ea] rounded-[6px] border border-[#dfe2ea] bg-[#f7f8fb]">
        <MetaCell pair={NUMBER[kind]}>{data.number ? <span className="tracking-[0.02em]">{data.number}</span> : <span className="font-semibold text-[#9a9eb0]">—</span>}</MetaCell>
        <MetaCell pair={L.issueDate}>
          <DateValue day={data.issueDate} />
        </MetaCell>
        {quote ? (
          <MetaCell pair={L.validUntil} wide>
            <DateValue day={data.dueDate} />
          </MetaCell>
        ) : (
          <>
            <MetaCell pair={L.supplyDate}>{supplyDiffers ? <DateValue day={data.supplyDate} /> : <DateValue day={data.issueDate} />}</MetaCell>
            <MetaCell pair={L.dueDate}>{kind === "credit" ? <span className="text-[#9a9eb0]">—</span> : <DateValue day={data.dueDate} />}</MetaCell>
          </>
        )}
      </section>

      {/* The buyer. A simplified invoice may have none. */}
      {data.buyer ? (
        <section className="mt-5 rounded-[6px] border border-[#dfe2ea]">
          <Bi pair={quote ? L.preparedFor : L.billTo} className="border-b border-[#dfe2ea] px-3.5 py-1.5" />
          <div className="grid grid-cols-2 gap-8 px-3.5 py-3">
            <PartyColumn party={data.buyer} lang="en" />
            <PartyColumn party={data.buyer} lang="ar" />
          </div>
        </section>
      ) : null}

      {/* A credit note names the invoice it corrects, and why. */}
      {kind === "credit" ? (
        <section className="mt-4 grid grid-cols-2 gap-8 rounded-[6px] border border-[#cfcdea] bg-[#f6f5fc] px-3.5 py-3 text-[11.5px] text-[#3c4157]">
          <div>
            <p>
              <span className="text-[#6b7086]">{L.original[0]}: </span>
              <b className="text-[#14172a]">{data.reference?.number ?? "—"}</b>
              {data.reference?.issueDate ? ` ${L.dated[0]} ${formatDay(data.reference.issueDate, "en")}` : ""}
            </p>
            <p className="mt-1">
              <span className="text-[#6b7086]">{L.reason[0]}: </span>
              {data.reasonEn || data.reasonAr || "—"}
            </p>
          </div>
          <div lang="ar" dir="rtl" className="text-right">
            <p>
              <span className="text-[#6b7086]">{L.original[1]}: </span>
              <b className="text-[#14172a]">
                <bdi>{data.reference?.number ?? "—"}</bdi>
              </b>
              {data.reference?.issueDate ? ` ${L.dated[1]} ${formatDay(data.reference.issueDate, "ar")}` : ""}
            </p>
            <p className="mt-1">
              <span className="text-[#6b7086]">{L.reason[1]}: </span>
              {data.reasonAr || data.reasonEn || "—"}
            </p>
          </div>
        </section>
      ) : null}

      {/* Items. */}
      <table className="mt-5 w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="border-y-[1.5px] border-[#14172a] bg-[#f3f4f8] text-[10.5px] font-semibold text-[#3c4157]">
            {(
              [
                [L.n, "w-[26px] text-center"],
                [L.desc, "text-left"],
                [L.qty, "w-[58px] text-right"],
                [L.price, "w-[78px] text-right"],
                ...(hasDiscount ? ([[L.disc, "w-[64px] text-right"]] as const) : []),
                [L.taxable, "w-[92px] text-right"],
                [L.vat, "w-[70px] text-right"],
                [L.total, "w-[88px] text-right"],
              ] as const
            ).map(([pair, cls], i) => (
              <th key={i} scope="col" className={cn("px-1.5 py-1.5 align-bottom font-semibold", cls)}>
                <span className="block leading-tight">{pair[0]}</span>
                <span lang="ar" dir="rtl" className="block leading-tight font-semibold">
                  {pair[1]}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.lines.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-8 text-center text-[#9a9eb0]">
                —
              </td>
            </tr>
          ) : (
            data.lines.map((l, i) => {
              const { discount: disc, net, vat } = lineAmounts(l);
              return (
                <tr key={i} className="border-b border-[#e3e5ec] align-top">
                  <td className="px-1.5 py-2 text-center text-[#6b7086]">{i + 1}</td>
                  <td className="px-1.5 py-2">
                    <span className="block font-semibold text-[#14172a]">{l.nameEn || l.nameAr}</span>
                    {l.nameAr && l.nameAr !== l.nameEn ? (
                      <span lang="ar" dir="rtl" className="block text-right text-[11.5px] text-[#3c4157]">
                        {l.nameAr}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-1.5 py-2 text-right">
                    <span className="block font-semibold text-[#14172a]">{qtyText(l.qtyMilli)}</span>
                    {l.unitEn ? <span className="block text-[9.5px] leading-tight text-[#6b7086]">{l.unitEn}</span> : null}
                    {l.unitAr ? (
                      <span lang="ar" className="block text-[9.5px] leading-tight text-[#6b7086]">
                        {l.unitAr}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-1.5 py-2 text-right">{sar(l.unitPrice)}</td>
                  {hasDiscount ? (
                    <td className="px-1.5 py-2 text-right">
                      {disc ? (
                        <>
                          <span className="block">−{sar(disc)}</span>
                          <span className="block text-[9.5px] text-[#6b7086]">{l.discountBps / 100}%</span>
                        </>
                      ) : (
                        <span className="text-[#9a9eb0]">—</span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-1.5 py-2 text-right">{sar(net)}</td>
                  <td className="px-1.5 py-2 text-right">
                    <span className="block">{sar(vat)}</span>
                    <span className="block text-[9.5px] text-[#6b7086]">{l.vat === "S" ? "15%" : l.vat === "Z" ? "0%" : l.vat === "E" ? "Exempt" : "O/S"}</span>
                  </td>
                  <td className="px-1.5 py-2 text-right font-semibold text-[#14172a]">{sar(net + vat)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Totals, the amount in words, and the QR code. */}
      <section className="mt-5 grid grid-cols-[1fr_292px] gap-6">
        <div className="flex min-w-0 gap-4">
          {quote ? null : data.qr ? (
            <Qr value={data.qr} label="ZATCA QR code" className="size-[112px] shrink-0" quiet={1} />
          ) : (
            <div className="grid size-[112px] shrink-0 place-items-center rounded-[4px] border border-dashed border-[#c9ccd8] p-2 text-center text-[9.5px] leading-snug text-[#6b7086]">
              <span>
                {L.qrSoon[0]}
                <span lang="ar" className="mt-1 block">
                  {L.qrSoon[1]}
                </span>
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="rounded-[6px] border border-[#dfe2ea] px-3 py-2.5">
              <Bi pair={L.words} />
              <p lang="ar" dir="rtl" className="mt-1.5 text-right text-[12px] font-semibold text-[#14172a]">
                {words.ar}
              </p>
              <p className="mt-1 text-[11px] text-[#3c4157]">{words.en}</p>
            </div>
            {/* A settled document's stamp gets its own space under the words, so it never covers them (or the QR code). */}
            {data.stamp ? (
              <div className="pointer-events-none relative h-[86px]">
                <div className="absolute start-[22px] -top-[6px] w-[218px] mix-blend-multiply">
                  <StampDrop play={!!data.stamp.animate} angle={-9}>
                    <Stamp kind={data.stamp.kind} date={data.stamp.date} />
                  </StampDrop>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="text-[11.5px]">
          <TotalRow pair={L.gross} value={totals.gross} />
          {hasDiscount ? <TotalRow pair={L.discount} value={-totals.discount} /> : null}
          {hasDiscount ? <TotalRow pair={L.taxableTotal} value={totals.taxable} /> : null}
          {totals.breakdown.map((b) =>
            b.category === "S" ? <TotalRow key={b.category} pair={CATEGORY.S} value={b.vat} /> : <TotalRow key={b.category} pair={CATEGORY[b.category]} value={b.taxable} note />,
          )}
          <div className="mt-1.5 flex items-center justify-between gap-3 rounded-[6px] bg-[#14172a] px-3 py-2.5 text-white">
            <div className="leading-tight">
              <span className="block text-[11px] font-semibold">{L.grand[0]}</span>
              <span lang="ar" dir="rtl" className="block text-left text-[11px] font-semibold">
                {L.grand[1]}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold opacity-75">SAR </span>
              <span className="text-[18px] font-extrabold tracking-[-0.01em]">{sar(totals.total)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bank details, notes, and the stamp. */}
      <section className="mt-6 grid grid-cols-[1fr_210px] gap-6">
        <div className="grid content-start gap-3 text-[11px] text-[#3c4157]">
          {seller.iban && (kind === "tax" || kind === "simplified") ? (
            <div className="rounded-[6px] border border-[#dfe2ea] px-3 py-2.5">
              <Bi pair={L.bank} />
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <span>{seller.bankEn || seller.bankAr}</span>
                <span lang="ar" dir="rtl">
                  {seller.bankAr || seller.bankEn}
                </span>
              </div>
              <p className="mt-1 text-[13px] font-bold tracking-[0.04em] text-[#14172a]">{formatIban(seller.iban)}</p>
            </div>
          ) : null}
          {data.notesEn || data.notesAr ? (
            <div className="px-0.5">
              <Bi pair={L.notes} />
              <div className="mt-1 grid grid-cols-2 gap-6">
                <p>{data.notesEn}</p>
                <p lang="ar" dir="rtl" className="text-right">
                  {data.notesAr}
                </p>
              </div>
            </div>
          ) : null}
          {quote ? (
            <p className="flex justify-between gap-3 px-0.5 font-semibold text-[#3c4157]">
              <span>{L.notTax[0]}</span>
              <span lang="ar" dir="rtl">
                {L.notTax[1]}
              </span>
            </p>
          ) : null}
        </div>
        <div className="relative flex flex-col items-center">
          {data.seal && !draft ? (
            <StampDrop play={!!data.sealDrop} angle={-9} delay={350} className="mix-blend-multiply">
              <Seal nameAr={seller.nameAr} nameEn={seller.nameEn} crNumber={seller.crNumber} cityAr={seller.cityAr} inked className="size-[132px] opacity-90" />
            </StampDrop>
          ) : (
            <div className="h-[132px]" />
          )}
          <div className="mt-1 w-full border-t border-[#c9ccd8] pt-1">
            <Bi pair={L.stamp} />
          </div>
        </div>
      </section>

      <footer className="mt-auto flex items-baseline justify-between gap-4 border-t border-[#e3e5ec] pt-2.5 text-[9.5px] text-[#8a8ea1]">
        <span>{L.footer[0]}</span>
        <span>{data.number ?? ""}</span>
        <span lang="ar" dir="rtl">
          {L.footer[1]}
        </span>
      </footer>
    </article>
  );
}

function TotalRow({ pair, value, note }: { pair: Pair; value: number; note?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#e3e5ec] px-1 py-1.5">
      <div className="leading-tight">
        <span className="block text-[11px] font-semibold text-[#3c4157]">{pair[0]}</span>
        <span lang="ar" dir="rtl" className="block text-left text-[10.5px] text-[#5b6075]">
          {pair[1]}
        </span>
      </div>
      <span className={cn("font-semibold text-[#14172a]", note && "font-medium text-[#3c4157]")}>{value < 0 ? `−${sar(-value)}` : sar(value)}</span>
    </div>
  );
}
