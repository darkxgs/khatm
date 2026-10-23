import { decodeQr } from "@/lib/zatca";
import { Qr } from "../qr";

/** A ZATCA QR code taken apart: each field's tag, length and value, and the bytes behind them. */
export function QrAnatomy({ value, names, tagLabel, bytesLabel }: { value: string; names: string[]; tagLabel: string; bytesLabel: (n: number) => string }) {
  const fields = decodeQr(value);
  const bin = atob(value);
  const bytes = Array.from(bin, (c) => c.charCodeAt(0));
  // Each field's bytes start where the ones before it end.
  const starts = fields.map((_, i) => fields.slice(0, i).reduce((a, f) => a + 2 + f.bytes, 0));
  const rows = fields.map((f, i) => ({ ...f, raw: bytes.slice(starts[i], starts[i] + 2 + f.bytes) }));
  const hex = (n: number) => n.toString(16).padStart(2, "0");

  return (
    <div className="grid gap-6 rounded-panel border border-rule bg-paper p-5 shadow-[0_1px_2px_rgb(23_26_44/0.05)] sm:p-7 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8">
      <div className="mx-auto w-[180px] md:mx-0 md:w-full">
        <Qr value={value} label="ZATCA QR code, INV-00007" className="w-full" quiet={1} />
        <p dir="ltr" className="tnum mt-3 text-center text-[13px] font-semibold text-muted">
          INV-00007
        </p>
      </div>
      <div className="min-w-0">
        <ol className="divide-y divide-rule-2">
          {rows.map((r, i) => (
            <li key={r.tag} className="grid grid-cols-[34px_minmax(0,1fr)] gap-x-3 py-3 first:pt-0">
              <span className="tnum mt-0.5 grid size-7 place-items-center rounded-full bg-seal-soft text-[13px] font-bold text-seal" title={`${tagLabel} ${r.tag}`}>
                {r.tag}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[14px] font-semibold text-ink-2">{names[i]}</span>
                  <span className="tnum text-[12.5px] text-muted">{bytesLabel(r.bytes)}</span>
                </div>
                <p className="mt-0.5 text-[16px] font-bold break-words text-ink">
                  <bdi>{r.value}</bdi>
                </p>
                <p dir="ltr" className="tnum mt-1 truncate text-left text-[12px] tracking-[0.04em] text-muted" aria-hidden>
                  <span className="font-bold text-seal">{hex(r.raw[0])}</span> <span className="font-bold text-ink-2">{hex(r.raw[1])}</span> {r.raw.slice(2, 26).map(hex).join(" ")}
                  {r.raw.length > 26 ? " …" : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p dir="ltr" className="mt-4 rounded-control bg-well px-3 py-2.5 text-left text-[12.5px] leading-relaxed break-all text-ink-2">
          {value}
        </p>
      </div>
    </div>
  );
}
