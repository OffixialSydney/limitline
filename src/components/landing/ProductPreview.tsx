import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatMoney } from "@/lib/formatting";

// Illustrative values only. Nothing here comes from a real account.
const CUR = "USD";
const m = (cents: number) => formatMoney(cents, CUR, "en-US");

export function ProductPreview() {
  return (
    <figure className="mx-auto w-full max-w-5xl" aria-labelledby="preview-caption">
      <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-[0_1px_0_rgba(23,25,22,0.04),0_24px_48px_-24px_rgba(23,25,22,0.18)]">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-sunken/60 px-4 py-2.5">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-line" /><span className="h-2.5 w-2.5 rounded-full bg-line" /><span className="h-2.5 w-2.5 rounded-full bg-line" />
          </div>
          <p className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted">Illustrative sample data</p>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-lg font-semibold">Sample evaluation account</p>
              <p className="text-sm text-muted">Example Firm · Phase 1</p>
            </div>
            <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Active</span>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line sm:grid-cols-4">
            {[
              ["Starting balance", m(1000000)],
              ["Recorded balance", m(1040000)],
              ["Recorded profit", `+${m(40000)}`],
              ["Target", m(100000)],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface px-3 py-3"><dt className="text-xs text-muted">{k}</dt><dd className="num mt-1 text-base font-semibold sm:text-lg">{v}</dd></div>
            ))}
          </dl>

          <div className="mt-5">
            <div className="flex items-baseline justify-between text-sm"><span className="font-medium">Progress toward target</span><span className="num text-muted">40%</span></div>
            <div className="mt-2"><ProgressBar value={40} label="Sample progress toward target" /></div>
            <p className="mt-1.5 text-xs text-muted">(10,400 − 10,000) ÷ (11,000 − 10,000) × 100</p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-control border border-line p-4">
              <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold">Daily loss</h3><StatusBadge status="normal" /></div>
              <p className="num mt-2 text-xl font-semibold">{m(20000)} remaining</p>
              <div className="mt-2"><ProgressBar value={60} label="Sample daily loss allowance used" /></div>
              <p className="mt-1.5 text-xs text-muted">{m(30000)} of a {m(50000)} configured allowance used</p>
            </div>
            <div className="rounded-control border border-line p-4">
              <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold">Overall loss</h3><StatusBadge status="normal" /></div>
              <p className="num mt-2 text-xl font-semibold">{m(140000)} remaining</p>
              <div className="mt-2"><ProgressBar value={0} label="Sample overall loss allowance used" /></div>
              <p className="mt-1.5 text-xs text-muted">Static model · threshold {m(900000)}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted">Last recorded update shown with every figure, so you can see how current it is.</p>
        </div>
      </div>
      <figcaption id="preview-caption" className="mt-3 text-center text-xs text-muted">
        A preview of the account view using made-up sample values. It is not live data and not a real account.
      </figcaption>
    </figure>
  );
}
