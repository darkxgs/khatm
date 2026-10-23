"use client";

import { buttonClass, Icon } from "../ui";

/** Builds a CSV in the browser and saves it: no round trip, nothing stored. */
export function CsvButton({ rows, filename, label }: { rows: (string | number)[][]; filename: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const esc = (v: string | number) => (typeof v === "number" ? String(v) : /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
        // A BOM so Excel opens the Arabic correctly.
        const blob = new Blob(["\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }}
      className={buttonClass("outline", "md")}
    >
      <Icon.download size={18} />
      {label}
    </button>
  );
}
