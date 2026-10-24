import type { LossResult } from "@/lib/calculations/engine";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatDateTime, formatDateTimeInZone, formatMoney, formatPercent, type FormatPrefs } from "@/lib/formatting";

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
  const profitBufferCents =
    result.remainingCents !== null &&
    result.allowanceCents !== null &&
    result.remainingCents > result.allowanceCents
      ? result.remainingCents - result.allowanceCents
      : null;
  const rows: [string, string][] = [
    ["Allowance", m(result.allowanceCents)],
    [`Reference (${result.referenceLabel})`, m(result.referenceCents)],
    ["Threshold", m(result.thresholdCents)],
    [`Latest recorded ${result.measure}`, m(result.currentValueCents)],
    ["Used", result.usedCents === null ? "-" : `${m(result.usedCents)} (${formatPercent(result.usedPercent, prefs.locale)})`],
  ];
  const resetDisplay = result.resetAt
    ? result.resetTimezone && result.resetTimezone !== prefs.timeZone
      ? `${formatDateTimeInZone(result.resetAt, prefs.locale, result.resetTimezone)} (${result.resetTimezone}) · ${formatDateTime(result.resetAt, prefs)}`
      : `${formatDateTime(result.resetAt, prefs)}${result.resetTimezone ? ` (${result.resetTimezone})` : ""}`
    : null;
  return (
    <section className="panel p-5" aria-label={title}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-0.5 text-xs text-muted">Evaluated on recorded {result.measure}</p>
        </div>
        <StatusBadge status={result.status} />
      </div>
      <p className="num mt-3 text-2xl font-semibold">
        {result.remainingCents === null ? <span className="text-base font-medium text-muted">Not available</span> : result.remainingCents <= 0 ? "No room remaining" : `${m(result.remainingCents)} remaining`}
      </p>
      {profitBufferCents !== null && (
        <p className="mt-1 text-xs text-muted">
          Includes +{m(profitBufferCents)} recorded gain above the {m(result.referenceCents)} reference plus your {m(result.allowanceCents)} allowance down to the {m(result.thresholdCents)} threshold.
        </p>
      )}
      <div className="mt-3"><ProgressBar value={result.usedPercent} label={`${title} used`} tone={tone} /></div>
      {result.reasons.length > 0 && (
        <div className="mt-3 rounded-control border border-warning/40 bg-warning/10 p-3 text-sm" role="status">
          <p className="font-medium text-ink">
            {result.completeness === "missing"
              ? "Calculation unavailable — missing required inputs"
              : "Incomplete or outdated observation"}
          </p>
          <ul className="mt-1 space-y-1 text-muted">
            {result.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="num text-right">{v}</dd></div>))}
        <dt className="text-muted">Data completeness</dt><dd className={`text-right ${result.completeness !== "complete" ? "font-medium text-warning" : ""}`}>{COMPLETENESS[result.completeness]}</dd>
        {resetDisplay && (
          <>
            <dt className="text-muted">Last daily reset</dt>
            <dd className="text-right">{resetDisplay}</dd>
          </>
        )}
        <dt className="text-muted">Last {result.measure} observation</dt><dd className="text-right">{result.observedAt ? formatDateTime(result.observedAt, prefs) : "None"}</dd>
        <dt className="text-muted">Calculated</dt><dd className="text-right">{formatDateTime(result.calculatedAt, prefs)}</dd>
      </dl>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-accent">How this is calculated</summary>
        <p className="mt-2 text-muted">{result.explanation} This uses only values you recorded. It does not reflect anything that happened after the last {result.measure} observation.</p>
      </details>
    </section>
  );
}
