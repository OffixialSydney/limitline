"use client";
import { useRouter } from "next/navigation";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ChartPoint { t: number; value: number | null }
interface Option { id: string; name: string }

export function PerformanceChart({ points, options, selected, measure, range, currency, locale, timeZone, startingBalance, truncated, rangeLabel }: {
  points: ChartPoint[]; options: Option[]; selected: string; measure: "balance" | "equity"; range: string; currency: string;
  locale: string; timeZone: string; startingBalance: number | null; truncated: boolean; rangeLabel: string;
}) {
  const router = useRouter();
  const go = (next: Partial<{ c: string; measure: string; range: string }>) => {
    const q = new URLSearchParams({ c: selected, measure, range, ...next });
    router.replace(`/app/overview?${q.toString()}`, { scroll: false });
  };
  const money = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0, currencyDisplay: "narrowSymbol" }).format(v);
  const moneyFull = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(v);
  const day = (t: number) => new Intl.DateTimeFormat(locale, { timeZone, month: "short", day: "numeric" }).format(new Date(t));
  const full = (t: number) => new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(t));
  const known = points.filter((p) => p.value !== null);
  const first = known[0], last = known[known.length - 1];
  const hasData = known.length > 0;
  return (
    <section aria-labelledby="chart-h" className="panel">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="chart-h" className="text-sm font-semibold">Recorded {measure}</h2>
          <p className="text-xs text-muted">{rangeLabel}. Points are your manual observations, not a continuous feed.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="chart-account">Account</label>
          <select id="chart-account" className="input !min-h-[36px] w-auto max-w-[200px] py-1 text-[13px]" value={selected} onChange={(e) => go({ c: e.target.value })}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <label className="sr-only" htmlFor="chart-measure">Measure</label>
          <select id="chart-measure" className="input !min-h-[36px] w-auto py-1 text-[13px]" value={measure} onChange={(e) => go({ measure: e.target.value })}>
            <option value="balance">Balance</option><option value="equity">Equity</option>
          </select>
          <label className="sr-only" htmlFor="chart-range">Date range</label>
          <select id="chart-range" className="input !min-h-[36px] w-auto py-1 text-[13px]" value={range} onChange={(e) => go({ range: e.target.value })}>
            <option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All time</option>
          </select>
        </div>
      </div>
      {!hasData ? (
        <p className="px-4 py-10 text-center text-sm text-muted">No {measure} observations in this range. Record an observation on the Records page to see this account&apos;s line.</p>
      ) : (
        <div className="px-2 pb-3 pt-4">
          <p className="sr-only">
            {known.length} recorded {measure} observations. First {moneyFull(first!.value!)} on {full(first!.t)}; latest {moneyFull(last!.value!)} on {full(last!.t)}.
          </p>
          <div className="h-[240px] w-full sm:h-[280px]" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid stroke="#E8E7E0" vertical={false} />
                <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={day} tick={{ fontSize: 12, fill: "#5F625B" }} stroke="#DCDDD5" minTickGap={32} />
                <YAxis domain={["auto", "auto"]} tickFormatter={money} tick={{ fontSize: 12, fill: "#5F625B" }} stroke="#DCDDD5" width={72} />
                {startingBalance !== null && <ReferenceLine y={startingBalance} stroke="#73766F" strokeDasharray="4 4" label={{ value: "Starting balance", fontSize: 11, fill: "#5F625B", position: "insideBottomRight" }} />}
                <Tooltip formatter={(v) => [moneyFull(Number(v)), measure]} labelFormatter={(t) => full(Number(t))} contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #DCDDD5" }} />
                <Line type="linear" dataKey="value" stroke="#245C45" strokeWidth={2} dot={{ r: 3, fill: "#245C45" }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {truncated && <p className="px-2 pt-2 text-xs text-muted">Showing the most recent 1,000 observations in this range.</p>}
          <details className="px-2 pt-2 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-accent">View the data as a table</summary>
            <div className="mt-2 max-h-56 overflow-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Recorded {measure} observations</caption>
                <thead><tr><th scope="col" className="th">Observed</th><th scope="col" className="th text-right">{measure === "balance" ? "Balance" : "Equity"}</th></tr></thead>
                <tbody>{[...known].reverse().map((p) => <tr key={p.t} className="border-t border-line"><td className="px-3 py-1.5">{full(p.t)}</td><td className="num px-3 py-1.5 text-right">{moneyFull(p.value!)}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
