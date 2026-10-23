import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/brand/Logo";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LandingNav } from "@/components/landing/LandingNav";
import { ProductPreview } from "@/components/landing/ProductPreview";
import type { RuleStatus } from "@/lib/calculations/engine";

export const metadata: Metadata = {
  title: { absolute: "Limitline · Prop Firm Challenge & Drawdown Ledger" },
  description:
    "Record account observations, configure prop firm drawdown rules, and verify remaining daily and overall loss room with transparent calculations.",
};

const HERO_SPECS = [
  { label: "Calculation basis", value: "Integer cents · explicit formulas" },
  { label: "Reset handling", value: "IANA timezones · DST-aware" },
  { label: "Stale or contradicted data", value: "Flagged, never masked" },
] as const;

const RULE_MODELS = [
  {
    model: "Static overall loss",
    reference: "Starting balance",
    formula: "Threshold = starting balance − allowance",
    detail: "Floor stays fixed regardless of subsequent high-water marks.",
  },
  {
    model: "Intraday trailing drawdown",
    reference: "Highest recorded observation",
    formula: "Threshold = peak recorded value − allowance",
    detail: "Optional lock at starting balance once the trailing floor reaches baseline.",
  },
  {
    model: "End-of-day trailing drawdown",
    reference: "Completed daily close peak",
    formula: "Threshold = highest completed EOD observation − allowance",
    detail: "Intraday spikes before the configured reset time do not ratchet the floor.",
  },
  {
    model: "Daily loss reset",
    reference: "Balance, equity, or higher of both",
    formula: "Remaining = allowance − max(reference − latest, 0)",
    detail: "Anchored to the latest observation at or before the firm's daily reset time.",
  },
] as const;

const STATUS_SPEC: { status: RuleStatus; condition: string }[] = [
  {
    status: "normal",
    condition: "Fresh, uncontradicted observations show remaining room below your warning threshold.",
  },
  {
    status: "warning",
    condition: "Used share of the daily or overall allowance is at or above your warning threshold (default 80%).",
  },
  {
    status: "limit_reached",
    condition: "The latest recorded balance or equity observation is at or beyond the configured threshold.",
  },
  {
    status: "breach_recorded",
    condition: "An earlier observation in the evaluated window crossed the threshold before later recovery.",
  },
  {
    status: "data_incomplete",
    condition: "Observations are missing, older than your freshness window, or contradicted by newer trades.",
  },
  {
    status: "unknown",
    condition: "The rule uses a custom model outside standard static, trailing, or EOD definitions.",
  },
];

const WORKFLOW = [
  {
    step: "01",
    title: "Enter challenge baseline & firm rules",
    summary: "Set starting balance, currency, phase, target, daily reset timezone/time, and drawdown model.",
    artifact: "Stores versioned rule definitions and optional rule-source verification date.",
  },
  {
    step: "02",
    title: "Log account observations, trades & balance events",
    summary: "Record balance/equity snapshots alongside closed trades, fees, credits, or adjustments.",
    artifact: "Separates non-trading balance events so profit progress reflects trading performance only.",
  },
  {
    step: "03",
    title: "Inspect remaining room & pre-trade risk",
    summary: "Review exact distance to daily and overall thresholds or test a proposed stop-loss in the calculator.",
    artifact: "Displays every reference value, threshold, timestamp, and completeness check.",
  },
] as const;

const INCLUDED_SCOPE = [
  "Multi-account evaluation tracking across Phase 1, Phase 2, Phase 3, and Funded stages",
  "Static, trailing, and end-of-day trailing overall drawdown calculations",
  "Timezone- and DST-aware daily loss tracking from balance, equity, or the higher of both",
  "Position size & pre-trade risk calculator checked against remaining daily and overall room",
  "Audit trail and CSV export for challenges, trades, balance events, and observations",
] as const;

const EXCLUDED_SCOPE = [
  "No broker, trading platform, or prop-firm API connection",
  "No live market data, tick streaming, or automated trade execution",
  "No detection of intraday drawdown breaches that occur between your recorded observations",
  "No silent estimation when required observations or reset references are missing",
  "No financial advice, trading signals, or performance guarantees",
] as const;

export default async function Home() {
  // Signed-in users go straight to their workspace. Visitors see the public page.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app/overview");

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      <LandingNav />

      <main id="main">
        {/* Hero section — tightened mobile spacing, strong typographic hierarchy, institutional framing */}
        <section
          aria-labelledby="hero-h"
          className="px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-12 lg:px-8 lg:pb-16 lg:pt-16"
        >
          <div className="mx-auto max-w-6xl">
            <div className="grid items-end gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
              <div>
                <p className="num text-xs font-medium uppercase tracking-wider text-accent">
                  Prop Firm Challenge &amp; Risk Ledger
                </p>
                <h1
                  id="hero-h"
                  className="mt-2.5 text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[52px]"
                >
                  Know where you stand before a rule becomes a breach.
                </h1>
              </div>

              <div className="lg:pb-1">
                <p className="text-pretty text-sm leading-relaxed text-muted sm:text-base">
                  Limitline is a structured ledger for prop firm evaluations. Enter your firm&apos;s exact drawdown
                  rules and record account observations to see remaining daily and overall loss room—with every formula,
                  reference value, and data-freshness check shown in full.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <Link href="/signup" className="btn-primary px-5">
                    Create account
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  <a href="#features" className="btn-secondary px-4">
                    Inspect rule engine
                  </a>
                </div>
              </div>
            </div>

            {/* Compact specification strip */}
            <dl className="mt-7 grid grid-cols-1 gap-px overflow-hidden rounded-control border border-line bg-line sm:mt-8 sm:grid-cols-3">
              {HERO_SPECS.map((s) => (
                <div key={s.label} className="bg-surface/80 px-3.5 py-2.5 sm:px-4">
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">{s.label}</dt>
                  <dd className="num mt-0.5 text-xs font-medium text-ink sm:text-sm">{s.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 sm:mt-8">
              <ProductPreview />
            </div>
          </div>
        </section>

        {/* Rule Engine & Status Architecture — replaces repetitive 4-icon template grid */}
        <section
          id="features"
          aria-labelledby="features-h"
          className="scroll-mt-16 border-t border-line px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20"
        >
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="num text-xs font-medium uppercase tracking-wider text-accent">01 / Rule Evaluation</p>
              <h2 id="features-h" className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
                Built around the exact mechanics firms enforce
              </h2>
              <p className="mt-2 text-sm text-muted sm:text-base">
                Prop firms define daily resets, trailing peaks, and balance versus equity rules differently. Limitline
                evaluates the specific model you configure and never substitutes a guess when inputs are missing.
              </p>
            </div>

            <div className="mt-7 grid gap-5 lg:mt-9 lg:grid-cols-12">
              {/* Left panel: Drawdown & reset specification table (7 cols) */}
              <div className="panel flex flex-col justify-between p-4 sm:p-5 lg:col-span-7">
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
                    <h3 className="text-base font-semibold">Supported drawdown &amp; daily loss models</h3>
                    <span className="num text-xs text-muted">src/lib/calculations/engine.ts</span>
                  </div>
                  <div className="mt-3 divide-y divide-line">
                    {RULE_MODELS.map((r) => (
                      <div key={r.model} className="py-3 first:pt-1 last:pb-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h4 className="text-sm font-semibold text-ink">{r.model}</h4>
                          <span className="rounded-control bg-sunken px-2 py-0.5 text-[11px] font-medium text-muted">
                            Ref: {r.reference}
                          </span>
                        </div>
                        <p className="num mt-1 text-xs font-medium text-accent">{r.formula}</p>
                        <p className="mt-1 text-xs text-muted">{r.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                  All monetary inputs are parsed with exact string decimal arithmetic into integer cents before
                  evaluation.
                </p>
              </div>

              {/* Right panel: Explicit status & data integrity states (5 cols) */}
              <div className="panel flex flex-col justify-between p-4 sm:p-5 lg:col-span-5">
                <div>
                  <div className="border-b border-line pb-3">
                    <h3 className="text-base font-semibold">Explicit status &amp; freshness states</h3>
                    <p className="mt-0.5 text-xs text-muted">
                      Every status uses both an icon and a text label—never colour alone.
                    </p>
                  </div>
                  <ul className="mt-3 divide-y divide-line">
                    {STATUS_SPEC.map((item) => (
                      <li key={item.status} className="py-2.5 first:pt-1 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <StatusBadge status={item.status} />
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted">{item.condition}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                  A healthy status is never shown when the latest observation is older than your freshness window or
                  contradicted by newer trade records.
                </p>
              </div>
            </div>

            {/* Secondary pair: Profit isolation + Pre-trade risk calculator */}
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div className="panel p-4 sm:p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold sm:text-base">Trading profit isolated from balance events</h3>
                  <span className="num text-xs font-medium text-accent">Profit target</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
                  Deposits, withdrawals, payouts, fees, and manual credits are logged separately from trades. When
                  computing progress toward a profit target, Limitline subtracts non-trading balance events so your
                  target percentage reflects trading results alone.
                </p>
                <p className="num mt-3 rounded-control border border-line bg-paper px-3 py-2 text-xs text-ink">
                  trading_profit = latest_balance − starting_balance − net_balance_events
                </p>
              </div>

              <div className="panel p-4 sm:p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold sm:text-base">Pre-trade risk checked against remaining room</h3>
                  <span className="num text-xs font-medium text-accent">Risk calculator</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
                  Before placing a trade, enter entry price, stop-loss, value per price unit, and risk budget. When
                  linked to a challenge, the calculator compares the one-unit loss against both your remaining daily
                  loss allowance and remaining overall drawdown room.
                </p>
                <p className="num mt-3 rounded-control border border-line bg-paper px-3 py-2 text-xs text-ink">
                  effective_budget = min(risk_budget, daily_remaining, overall_remaining)
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow section — compact horizontal ledger rows */}
        <section
          id="how-it-works"
          aria-labelledby="how-h"
          className="scroll-mt-16 border-t border-line bg-sunken/45 px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16"
        >
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="num text-xs font-medium uppercase tracking-wider text-accent">02 / Operational Workflow</p>
              <h2 id="how-h" className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
                How a challenge is tracked
              </h2>
            </div>

            <ol className="mt-6 divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface sm:mt-8">
              {WORKFLOW.map((w) => (
                <li
                  key={w.step}
                  className="grid gap-2 p-4 sm:p-5 md:grid-cols-[56px_1.1fr_1fr] md:items-baseline md:gap-6"
                >
                  <span className="num text-xs font-semibold uppercase tracking-wider text-accent">Step {w.step}</span>
                  <div>
                    <h3 className="text-sm font-semibold sm:text-base">{w.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">{w.summary}</p>
                  </div>
                  <p className="rounded-control border border-line bg-paper/70 px-3 py-2 text-xs text-muted">
                    <strong className="font-medium text-ink">Output: </strong>
                    {w.artifact}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Scope & Operational Boundaries — factual positioning + calm institutional CTA */}
        <section
          id="about"
          aria-labelledby="about-h"
          className="scroll-mt-16 border-t border-line px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20"
        >
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="num text-xs font-medium uppercase tracking-wider text-accent">03 / Scope &amp; Limits</p>
              <h2 id="about-h" className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
                Transparent by design: what Limitline does and does not do
              </h2>
              <p className="mt-2 text-sm text-muted sm:text-base">
                Limitline is a manual recording and rule-evaluation workspace. Keeping its boundaries explicit ensures
                you always know what a displayed figure means.
              </p>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2 sm:mt-8">
              <div className="panel p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-ink sm:text-base">What Limitline provides</h3>
                <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted sm:text-sm">
                  {INCLUDED_SCOPE.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check size={16} className="mt-0.5 shrink-0 text-positive" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="panel p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-ink sm:text-base">Operational boundaries</h3>
                <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted sm:text-sm">
                  {EXCLUDED_SCOPE.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Minus size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Restrained institutional CTA panel */}
            <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-panel border border-line bg-surface p-5 sm:mt-10 sm:flex-row sm:items-center sm:p-6">
              <div>
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                  Ready to set up your evaluation ledger?
                </h2>
                <p className="mt-1 text-xs text-muted sm:text-sm">
                  Create an account, enter your firm&apos;s rule parameters, and log your first observation.
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
                <Link href="/signup" className="btn-primary flex-1 sm:flex-initial">
                  Create account
                </Link>
                <Link href="/login" className="btn-secondary flex-1 sm:flex-initial">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface/60 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Wordmark descriptor />
            <p className="mt-2 max-w-md text-xs text-muted">
              Prop firm challenge tracking and rule evaluation based on user-recorded observations. Not connected to any
              broker or prop firm.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium sm:text-sm">
            <a href="#features" className="text-muted hover:text-ink">
              Rule Engine
            </a>
            <a href="#how-it-works" className="text-muted hover:text-ink">
              Workflow
            </a>
            <a href="#about" className="text-muted hover:text-ink">
              Scope &amp; Limits
            </a>
            <Link href="/login" className="text-ink hover:underline">
              Sign in
            </Link>
            <Link href="/signup" className="text-accent hover:underline">
              Create account
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
