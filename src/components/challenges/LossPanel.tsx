import type { LossResult } from "@/lib/calculations/engine";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatDateTime, formatMoney, formatPercent, type FormatPrefs } from "@/lib/formatting";

const COMPLETENESS = { complete: "Complete", partial: "Partial", missing: "Missing inputs" } as const;

export function LossPanel({ title, result, currency, prefs, notConfigured }: { title: string; result: LossResult | null; currency: string; prefs: FormatPrefs; notConfigured: string }) {
  const m = (c: number | null) => formatMoney(c, currency, prefs.locale);
  if (!result) {
    return (
      <section className="panel p-5" aria-label={title}>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted">{notConfigured}</p>
      </section>
    );
  }
  const tone = result.status === "limit_reached" || result.status === "breach_recorded" ? "critical" : result.status === "warning" ? "warning" : "accent";
  const rows: [string, string][] = [
    ["Allowance", m(result.allowanceCents)],
    ["Reference", m(result.referenceCents)],
    ["Threshold", m(result.thresholdCents)],
    ["Latest recorded value", m(result.currentValueCents)],
    ["Used", result.usedCents === null ? "-" : `${m(result.usedCents)} (${formatPercent(result.usedPercent, prefs.locale)})`],
  ];
  return (
    <section className="panel p-5" aria-label={title}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <StatusBadge status={result.status} />
      </div>
      <p className="num mt-3 text-2xl font-semibold">
        {result.remainingCents === null ? <span className="text-base font-medium text-muted">Not available</span> : result.remainingCents <= 0 ? "No room remaining" : `${m(result.remainingCents)} remaining`}
      </p>
      <div className="mt-3"><ProgressBar value={result.usedPercent} label={`${title} used`} tone={tone} /></div>
      {result.reasons.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-control border border-warning/40 bg-warning/10 p-3 text-sm">
          {result.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="num text-right">{v}</dd></div>))}
        <dt className="text-muted">Data completeness</dt><dd className="text-right">{COMPLETENESS[result.completeness]}</dd>
        <dt className="text-muted">Last observation</dt><dd className="text-right">{result.observedAt ? formatDateTime(result.observedAt, prefs) : "None"}</dd>
        <dt className="text-muted">Calculated</dt><dd className="text-right">{formatDateTime(result.calculatedAt, prefs)}</dd>
      </dl>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-accent">How this is calculated</summary>
        <p className="mt-2 text-muted">{result.explanation} This uses only values you recorded. It does not reflect anything that happened after the last observation.</p>
      </details>
    </section>
  );
}
