import type { ChallengeView } from "@/lib/server/evaluate";
import { formatMoney } from "@/lib/formatting";

function Metric({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="bg-surface px-4 py-4">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1.5 text-xl font-semibold leading-tight sm:text-2xl">{children}</dd>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

export function SummaryStrip({ views, locale }: { views: ChallengeView[]; locale: string }) {
  const active = views.filter((v) => v.status === "active");
  const passed = views.filter((v) => v.status === "passed").length;
  const attention = active.filter((v) => v.attention.some((a) => a.severity !== "info")).length;
  // Money in different currencies is never added together.
  const byCurrency = new Map<string, { sum: number; known: number; total: number }>();
  for (const v of active) {
    const e = byCurrency.get(v.currency) ?? { sum: 0, known: 0, total: 0 };
    e.total += 1;
    if (v.profitCents !== null) { e.sum += v.profitCents; e.known += 1; }
    byCurrency.set(v.currency, e);
  }
  const entries = [...byCurrency.entries()];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line lg:grid-cols-4" aria-label="Summary">
      <Metric label="Active challenges" note={views.length === 0 ? undefined : `${views.length} tracked`}><span className="num">{active.length}</span></Metric>
      <Metric label="Recorded profit / loss" note={entries.some(([, e]) => e.known < e.total) ? "Excludes accounts without records" : "Trading results, excluding deposits and withdrawals"}>
        {entries.length === 0 || entries.every(([, e]) => e.known === 0)
          ? <span className="text-base font-medium text-muted">No data yet</span>
          : <span className="flex flex-col">{entries.filter(([, e]) => e.known > 0).map(([cur, e]) => (
              <span key={cur} className={`num ${e.sum < 0 ? "text-critical" : e.sum > 0 ? "text-positive" : ""}`}>
                {e.sum > 0 ? "+" : ""}{formatMoney(e.sum, cur, locale)}
              </span>
            ))}</span>}
      </Metric>
      <Metric label="Needing attention" note={attention > 0 ? "See the attention panel" : "No warnings on recorded data"}><span className={`num ${attention > 0 ? "text-warning" : ""}`}>{attention}</span></Metric>
      <Metric label="Passed"><span className="num">{passed}</span></Metric>
    </dl>
  );
}
