import { ChallengeStatusBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatMoney } from "@/lib/formatting";

// Illustrative values only. Nothing here comes from a real account.
const CUR = "USD";
const m = (cents: number) => formatMoney(cents, CUR, "en-US");

const METRICS = [
  { label: "Starting balance", value: m(5000000), note: "Configured baseline" },
  { label: "Current balance", value: m(5185000), note: "Latest observation" },
  { label: "Net recorded P/L", value: `+${m(185000)}`, note: "Excludes fees & adjustments" },
  { label: "Profit target", value: m(300000), note: "6.0% ($3,000.00)" },
] as const;

const DAILY_ROWS = [
  ["Allowance (2.5%)", m(125000)],
  ["Reset reference (17:00 ET)", m(5285000)],
  ["Daily threshold", m(5160000)],
  ["Latest recorded equity", m(5185000)],
  ["Allowance used", `${m(100000)} (80.0%)`],
] as const;

const OVERALL_ROWS = [
  ["Allowance (5.0%)", m(250000)],
  ["EOD peak reference", m(5220000)],
  ["Trailing threshold", m(4970000)],
  ["Latest recorded balance", m(5185000)],
  ["Allowance used", `${m(35000)} (14.0%)`],
] as const;

export function ProductPreview() {
  return (
    <figure className="mx-auto w-full" aria-labelledby="preview-caption">
      <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-[0_1px_2px_rgba(23,25,22,0.05),0_16px_36px_-20px_rgba(23,25,22,0.14)]">
        {/* Institutional ledger top bar — replaces generic browser window dots */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sunken/70 px-3.5 py-2 sm:px-5">
          <div className="flex items-center gap-2 text-xs">
            <span className="num font-medium uppercase tracking-wider text-ink">Challenge Ledger</span>
            <span className="text-line" aria-hidden="true">
              /
            </span>
            <span className="text-muted">Rule Evaluation View</span>
          </div>
          <span className="rounded-control border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
            Illustrative sample data · Not a live feed
          </span>
        </div>

        <div className="p-3.5 sm:p-5 lg:p-6">
          {/* Account header & provenance banner matching src/app/app/challenges/[id]/page.tsx */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold sm:text-lg">50K Futures Evaluation</h2>
                <ChallengeStatusBadge status="active" />
              </div>
              <p className="mt-0.5 text-xs text-muted sm:text-sm">
                Sample Prop Firm · Phase 1 · USD · Reset 17:00 America/New_York
              </p>
            </div>
            <div className="rounded-control border border-line bg-paper px-2.5 py-1.5 text-xs text-muted">
              Last observation: <strong className="num font-medium text-ink">Oct 14, 16:40 UTC</strong> (2 h ago)
            </div>
          </div>

          {/* 4-column summary strip */}
          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line lg:grid-cols-4">
            {METRICS.map((item) => (
              <div key={item.label} className="bg-surface px-3 py-2.5 sm:px-3.5 sm:py-3">
                <dt className="text-xs font-medium text-muted">{item.label}</dt>
                <dd className="num mt-1 text-base font-semibold sm:text-lg">{item.value}</dd>
                <p className="mt-0.5 text-[11px] text-muted">{item.note}</p>
              </div>
            ))}
          </dl>

          {/* Target progress */}
          <div className="mt-4 rounded-control border border-line bg-paper/50 p-3 sm:p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs sm:text-sm">
              <span className="font-semibold text-ink">Progress toward profit target</span>
              <span className="num font-medium text-ink">61.7% of target recorded</span>
            </div>
            <div className="mt-2">
              <ProgressBar value={61.7} label="Sample progress toward profit target" />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Formula: recorded trading profit ({m(185000)}) ÷ target profit ({m(300000)}) × 100. Deposits, withdrawals
              and fees are excluded.
            </p>
          </div>

          {/* Loss panels matching src/components/challenges/LossPanel.tsx */}
          <div className="mt-4 grid gap-3.5 md:grid-cols-2 sm:gap-4">
            <div className="rounded-control border border-line bg-surface p-3.5 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Daily loss</h3>
                  <p className="text-xs text-muted">Higher of balance / equity at reset</p>
                </div>
                <StatusBadge status="warning" />
              </div>
              <p className="num mt-2.5 text-lg font-semibold sm:text-xl">{m(25000)} remaining</p>
              <div className="mt-2">
                <ProgressBar value={80} label="Sample daily loss allowance used" tone="warning" />
              </div>
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-line pt-2.5 text-xs">
                {DAILY_ROWS.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="num text-right font-medium text-ink">{v}</dd>
                  </div>
                ))}
                <dt className="text-muted">Data completeness</dt>
                <dd className="text-right font-medium text-ink">Complete</dd>
              </dl>
            </div>

            <div className="rounded-control border border-line bg-surface p-3.5 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Overall loss</h3>
                  <p className="text-xs text-muted">End-of-day trailing drawdown</p>
                </div>
                <StatusBadge status="normal" />
              </div>
              <p className="num mt-2.5 text-lg font-semibold sm:text-xl">{m(215000)} remaining</p>
              <div className="mt-2">
                <ProgressBar value={14} label="Sample overall loss allowance used" tone="accent" />
              </div>
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-line pt-2.5 text-xs">
                {OVERALL_ROWS.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="num text-right font-medium text-ink">{v}</dd>
                  </div>
                ))}
                <dt className="text-muted">Data completeness</dt>
                <dd className="text-right font-medium text-ink">Complete</dd>
              </dl>
            </div>
          </div>

          {/* Requirements & verification strip */}
          <dl className="mt-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 border-t border-line pt-3 text-xs text-muted">
            <div className="flex items-center gap-1.5">
              <dt>Minimum trading days:</dt>
              <dd className="num font-medium text-ink">4 of 5 recorded</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt>Warning threshold:</dt>
              <dd className="num font-medium text-ink">80% of allowance</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt>Freshness window:</dt>
              <dd className="num font-medium text-ink">48 h max age</dd>
            </div>
          </dl>
        </div>
      </div>
      <figcaption id="preview-caption" className="mt-2.5 text-center text-xs text-muted">
        Sample challenge ledger showing how Limitline displays recorded observations, explicit formulas, and rule
        thresholds.
      </figcaption>
    </figure>
  );
}
