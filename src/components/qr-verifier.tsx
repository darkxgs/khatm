"use client";

import { useEffect, useRef, useState } from "react";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { decodeQr, isVatNumber, type DecodedTag } from "@/lib/zatca";
import { buttonClass, cn, Icon, textareaClass } from "./ui";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/** Reads a ZATCA QR payload, pasted or scanned, and checks what it can without ZATCA's systems. */
export function QrVerifier({ lang, sample }: { lang: Lang; sample: string }) {
  const t = dict(lang).verify;
  const [text, setText] = useState("");
  const [fields, setFields] = useState<DecodedTag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const read = (value: string) => {
    const v = value.trim();
    try {
      const out = decodeQr(v);
      if (!v || out.length === 0 || out[0].tag !== 1) throw new Error("not tlv");
      setFields(out);
      setError(null);
    } catch {
      setFields(null);
      setError(t.invalid);
    }
  };

  const stop = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    setScanning(false);
  };
  useEffect(() => () => stream.current?.getTracks().forEach((tr) => tr.stop()), []);

  useEffect(() => {
    if (!scanning) return;
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor || !video.current) return;
    const detector = new Ctor({ formats: ["qr_code"] });
    let alive = true;
    const tick = async () => {
      if (!alive || !video.current) return;
      try {
        const found = await detector.detect(video.current);
        if (found[0]?.rawValue) {
          setText(found[0].rawValue);
          read(found[0].rawValue);
          stop();
          return;
        }
      } catch {
        /* the next frame may do better */
      }
      window.setTimeout(tick, 250);
    };
    tick();
    return () => {
      alive = false;
    };
    // read() and stop() only touch state setters and refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const scan = async () => {
    setCameraNote(null);
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) return setCameraNote(t.noCamera);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.current = s;
      setScanning(true);
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
      });
    } catch {
      setCameraNote(t.cameraBlocked);
    }
  };

  const get = (tag: number) => fields?.find((f) => f.tag === tag)?.value ?? null;
  const vatNo = get(2);
  const time = get(3);
  const total = get(4) != null ? Number(get(4)) : NaN;
  const vat = get(5) != null ? Number(get(5)) : NaN;
  const checks = fields
    ? [
        { ok: !!vatNo && isVatNumber(vatNo), yes: t.vatOk, no: t.vatBad },
        { ok: !!time && !Number.isNaN(Date.parse(time)), yes: t.timeOk, no: t.timeBad },
        { ok: Number.isFinite(total) && Number.isFinite(vat) && vat <= total, yes: t.sumOk, no: t.sumBad },
      ]
    : [];
  const rate = Number.isFinite(total) && Number.isFinite(vat) && total - vat > 0 ? ((vat / (total - vat)) * 100).toFixed(2) : null;
  const phase2 = fields?.some((f) => f.tag > 5);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
      <div>
        <label htmlFor="qr-text" className="text-[14px] font-semibold text-ink-2">
          {t.paste}
        </label>
        <textarea
          id="qr-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          dir="ltr"
          rows={5}
          spellCheck={false}
          placeholder="AQ…"
          aria-describedby="qr-hint"
          className={cn(textareaClass, "mt-1.5 text-[13.5px] break-all")}
        />
        <p id="qr-hint" className="mt-1.5 text-[13px] text-muted">
          {t.pasteHint}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => read(text)} className={buttonClass("primary", "md")}>
            {t.read}
          </button>
          {scanning ? (
            <button type="button" onClick={stop} className={buttonClass("outline", "md")}>
              <Icon.close size={18} />
              {t.stopScan}
            </button>
          ) : (
            <button type="button" onClick={scan} className={buttonClass("outline", "md")}>
              <Icon.camera size={18} />
              {t.scan}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setText(sample);
              read(sample);
            }}
            className={buttonClass("ghost", "md")}
          >
            {t.sample}
          </button>
        </div>
        {cameraNote ? <p className="mt-3 text-[14px] text-late">{cameraNote}</p> : null}
        {scanning ? (
          <div className="mt-4 overflow-hidden rounded-panel border border-rule bg-ink">
            <video ref={video} playsInline muted className="aspect-[4/3] w-full object-cover" />
          </div>
        ) : null}
      </div>

      <div aria-live="polite">
        {error ? <p className="rounded-panel bg-late-soft px-4 py-3 text-[15px] font-medium text-late">{error}</p> : null}
        {fields ? (
          <div className="rounded-panel border border-rule bg-paper">
            <ol className="divide-y divide-rule-2">
              {fields.map((f) => (
                <li key={f.tag} className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 px-4 py-3">
                  <span className="tnum mt-0.5 grid size-7 place-items-center rounded-full bg-seal-soft text-[13px] font-bold text-seal">{f.tag}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-muted">{t.fields[f.tag - 1] ?? t.unknownTag(f.tag)}</p>
                    <p className={cn("text-[15px] font-bold break-all text-ink", f.tag > 5 && "text-[12.5px] font-medium text-ink-2")}>
                      <bdi>{f.value}</bdi>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="border-t border-rule px-4 py-3.5">
              <p className="mb-2 text-[13px] font-semibold text-muted">{t.checks}</p>
              <ul className="grid gap-1.5 text-[14px]">
                {checks.map((c, i) => (
                  <li key={i} className={cn("flex items-start gap-2", c.ok ? "text-paid" : "text-late")}>
                    {c.ok ? <Icon.check size={17} strokeWidth={2.4} className="mt-0.5 shrink-0" /> : <Icon.alert size={17} className="mt-0.5 shrink-0" />}
                    {c.ok ? c.yes : c.no}
                  </li>
                ))}
                {rate ? (
                  <li className="flex items-start gap-2 text-ink-2">
                    <Icon.vat size={17} className="mt-0.5 shrink-0" />
                    {t.rate(`${rate}%`)}
                  </li>
                ) : null}
              </ul>
              {phase2 ? <p className="mt-3 text-[13px] text-muted">{t.phase2}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
