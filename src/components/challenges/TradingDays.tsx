"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { setTradingDay } from "@/features/trading/actions";

export function TradingDays({ challengeId, dates, today, labels }: { challengeId: string; dates: string[]; today: string; labels: Record<string, string> }) {
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (d: string, present: boolean) => start(async () => {
    setError(null);
    const r = await setTradingDay(challengeId, d, present);
    if (r.ok) router.refresh(); else setError(r.message);
  });
  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <div><label htmlFor="td-date" className="label">Add a trading day</label><input id="td-date" type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></div>
        <button type="button" className="btn-secondary" disabled={pending || !date} onClick={() => run(date, true)}>Add day</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-critical">{error}</p>}
      {dates.length === 0 ? <p className="mt-3 text-sm text-muted">No trading days recorded. Recording a trade adds its day automatically.</p> : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {dates.map((d) => (
            <li key={d} className="flex items-center gap-1 rounded-full border border-line bg-sunken py-1 pl-3 pr-1 text-xs">
              <span className="num">{labels[d] ?? d}</span>
              <button type="button" onClick={() => run(d, false)} disabled={pending} className="rounded-full p-1.5 hover:bg-line" aria-label={`Remove trading day ${labels[d] ?? d}`}><X size={12} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
