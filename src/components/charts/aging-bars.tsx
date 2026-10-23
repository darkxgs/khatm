import { cn } from "../ui";

export type AgingRow = { key: string; label: string; amount: number; count: number; late: boolean };

/**
 * What's owed, by how late it is: one row per bucket, the amount written out
 * and drawn as a bar against the largest bucket. Late buckets are in the
 * overdue ink; their labels say "late" too, so colour is never the only cue.
 */
export function AgingBars({ rows, format, countLabel, className }: { rows: AgingRow[]; format: (minor: number) => string; countLabel: (n: number) => string; className?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <ul className={cn("grid gap-3.5", className)}>
      {rows.map((r) => (
        <li key={r.key} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className={cn("font-semibold", r.amount ? "text-ink-2" : "text-muted")}>{r.label}</span>
            <span className="flex items-baseline gap-2">
              {r.count ? <span className="text-[12.5px] text-muted">{countLabel(r.count)}</span> : null}
              <span className={cn("tnum font-bold", r.amount ? "text-ink" : "text-faint")}>{format(r.amount)}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-rule-2" aria-hidden>
            {r.amount ? <div className={cn("h-full rounded-e-[4px]", r.late ? "bg-late" : "bg-chart")} style={{ width: `${Math.max(1.5, (r.amount / max) * 100)}%` }} /> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
