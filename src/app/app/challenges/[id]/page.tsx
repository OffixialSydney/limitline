import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChallengeStatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LossPanel } from "@/components/challenges/LossPanel";
import { ChallengeActions } from "@/components/challenges/ChallengeActions";
import { TradingDays } from "@/components/challenges/TradingDays";
import { ActivityList } from "@/components/dashboard/RecentActivity";
import { RecordButtons } from "@/components/trades/RecordForms";
import { requireSession } from "@/lib/server/context";
import { evaluateFromRows, loadBundle } from "@/lib/server/evaluate";
import { DEFAULT_STALE_AFTER_MS } from "@/lib/calculations/engine";
import { localDate } from "@/lib/calculations/time";
import { parseMoney } from "@/lib/calculations/money";
import { formatDate, formatDateTime, formatMoney, formatPercent, formatRelative, toLocalInputValue } from "@/lib/formatting";
import { MODEL_LABEL, PHASE_LABEL } from "@/lib/status";
import { parseRuleConfig } from "@/lib/validation/rules";
import { uuid } from "@/lib/validation/common";
import type { AuditRow, ChallengeRow } from "@/types/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Challenge" };

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const { supabase, user, profile, prefs } = await requireSession();
  const { data: c } = await supabase.from("challenges").select("*").eq("id", id).eq("user_id", user.id).maybeSingle<ChallengeRow>();
  if (!c) notFound();
  const bundle = await loadBundle(supabase, [id]);
  const now = new Date();
  const ev = evaluateFromRows(c, bundle, profile, now);
  const { data: audit } = await supabase.from("audit_logs").select("id, challenge_id, action, entity_type, entity_id, details, created_at").eq("challenge_id", id).order("created_at", { ascending: false }).limit(100);
  const { data: breaches } = await supabase.from("notifications").select("id, title, message, created_at, notification_type").eq("challenge_id", id).in("notification_type", ["breach_recorded", "daily_limit", "overall_limit"]).order("created_at", { ascending: false }).limit(20);

  const cur = c.account_currency;
  const m = (v: number | null) => formatMoney(v, cur, prefs.locale);
  const start = parseMoney(c.starting_balance) ?? 0;
  const staleMs = profile.stale_after_hours * 3600000 || DEFAULT_STALE_AFTER_MS;
  const stale = ev.lastObservedAt ? now.getTime() - ev.lastObservedAt.getTime() > staleMs : true;
  const today = localDate(now, prefs.timeZone);
  const tradedDates = bundle.days.filter((d) => d.status === "traded").map((d) => d.trading_date).sort().reverse();
  const labels = Object.fromEntries(tradedDates.map((d) => [d, formatDate(d, prefs)]));
  const overallCfg = parseRuleConfig("overall_loss", bundle.rules.find((r) => r.rule_type === "overall_loss")?.configuration);
  const rulesMeta = bundle.rules[0];
  const history = [
    ...((audit ?? []) as AuditRow[]),
    ...((breaches ?? []) as { id: string; title: string; message: string; created_at: string }[]).map((n) => ({
      id: `n-${n.id}`, challenge_id: id, action: "breach_alert", entity_type: "notification", entity_id: n.id, created_at: n.created_at, details: { summary: n.title.replace(`${c.name}: `, "") },
    } as AuditRow)),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <>
      <PageHeader
        back={<Link href="/app/challenges" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={14} aria-hidden="true" />Challenges</Link>}
        title={c.name}
        description={<span className="flex flex-wrap items-center gap-2"><span>{c.firm_name} · {PHASE_LABEL[c.current_phase] ?? c.current_phase}</span><ChallengeStatusBadge status={c.status} /></span>}
        actions={<>
          {c.status !== "archived" && <Link href={`/app/challenges/${id}/edit`} className="btn-secondary"><Pencil size={15} aria-hidden="true" />Edit</Link>}
          {c.status !== "archived" && <RecordButtons options={[{ id, name: c.name, currency: cur }]} challengeId={id} nowLocal={toLocalInputValue(now, prefs.timeZone)} />}
          <ChallengeActions id={id} name={c.name} status={c.status} />
        </>} />

      <p className={`mb-6 flex items-start gap-2 rounded-control border px-3 py-2 text-sm ${stale ? "border-warning/40 bg-warning/10" : "border-line bg-surface"}`} role={stale ? "status" : undefined}>
        {stale && <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />}
        <span>
          {ev.lastObservedAt
            ? <>Last recorded update: <strong className="font-medium">{formatDateTime(ev.lastObservedAt, prefs)}</strong> ({formatRelative(ev.lastObservedAt)}).{stale ? " Current account conditions may differ." : ""}</>
            : <>No observations recorded. Some calculations are unavailable because required account observations are missing.</>}
          {" "}Values come from what you entered, not from a live feed.
        </span>
      </p>

      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line lg:grid-cols-3 xl:grid-cols-6" aria-label="Account overview">
          {[
            ["Starting balance", m(start), null],
            ["Current balance", ev.balance.cents === null ? "No data" : m(ev.balance.cents), ev.balance.source === "snapshot" ? "Latest observation" : ev.balance.source === "derived" ? "Derived: start + trades + balance events" : "Record an observation"],
            ["Current equity", ev.balance.equityCents === null ? "Not recorded" : m(ev.balance.equityCents), ev.balance.equityObservedAt ? formatDateTime(ev.balance.equityObservedAt, prefs) : null],
            ["Net recorded profit / loss", ev.profitCents === null ? "No data" : `${ev.profitCents > 0 ? "+" : ""}${m(ev.profitCents)}`, "Excludes deposits and withdrawals"],
            ["Target", ev.progress.targetCents === null ? "No target" : m(ev.progress.targetCents), "Profit above the starting balance"],
            ["Target progress", ev.progress.available ? formatPercent(ev.progress.rawPercent, prefs.locale) : "Not enough data", null],
          ].map(([k, v, note]) => (
            <div key={k} className="bg-surface px-4 py-3"><dt className="text-xs font-medium text-muted">{k}</dt><dd className="num mt-1 text-lg font-semibold">{v}</dd>{note && <p className="mt-0.5 text-xs text-muted">{note}</p>}</div>
          ))}
        </dl>

        <section className="panel p-5" aria-labelledby="progress-h">
          <h2 id="progress-h" className="text-base font-semibold">Progress toward target</h2>
          <div className="mt-3"><ProgressBar value={ev.progress.displayPercent} label="Target progress" tone={ev.progress.state === "below_start" ? "warning" : "accent"} /></div>
          <p className="mt-3 text-sm">
            {!ev.progress.available ? (ev.progress.reason ?? "Not enough data")
              : ev.progress.state === "exceeded" ? `Target exceeded: ${formatPercent(ev.progress.rawPercent, prefs.locale)} of the target recorded.`
              : ev.progress.state === "below_start" ? `Recorded results are below the starting balance (${formatPercent(ev.progress.rawPercent, prefs.locale)} of the target).`
              : `${formatPercent(ev.progress.rawPercent, prefs.locale)} of the target recorded.`}
          </p>
          <p className="mt-1 text-xs text-muted">Formula: recorded trading profit ÷ target profit × 100. Deposits, withdrawals, fees and credits are excluded.{ev.progress.available ? ` (${m(ev.progress.profitCents)} ÷ ${m(ev.progress.targetCents)})` : ""}</p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <LossPanel title="Daily loss" result={ev.daily} currency={cur} prefs={prefs} notConfigured="No daily loss rule is configured for this challenge." />
          <LossPanel title="Overall loss" result={ev.overall} currency={cur} prefs={prefs} notConfigured="No overall loss rule is configured, so loss status cannot be determined." />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel p-5" aria-labelledby="req-h">
            <h2 id="req-h" className="text-base font-semibold">Requirements</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted">Drawdown model</dt><dd className="text-right">{overallCfg ? MODEL_LABEL[overallCfg.model] : "Not configured"}</dd>
              <dt className="text-muted">Trading days</dt><dd className="num text-right">{ev.tradingDays.configured ? `${ev.tradingDays.completed} of ${ev.tradingDays.required}${ev.tradingDays.met ? " (met)" : ""}` : `${ev.tradingDays.completed} recorded, no minimum set`}</dd>
              <dt className="text-muted">Deadline</dt><dd className="text-right">{c.deadline ? `${formatDate(c.deadline, prefs)}${ev.deadline.daysRemaining !== null ? ev.deadline.daysRemaining < 0 ? " (passed)" : ` (${ev.deadline.daysRemaining} days)` : ""}` : "None"}</dd>
              <dt className="text-muted">Started</dt><dd className="text-right">{formatDate(c.start_date, prefs)}</dd>
              <dt className="text-muted">Rule source</dt><dd className="text-right">{rulesMeta?.source_reference ?? "Not recorded"}</dd>
              <dt className="text-muted">Rules verified</dt><dd className="text-right">{rulesMeta?.verified_at ? formatDate(rulesMeta.verified_at, prefs) : "Not recorded"}</dd>
            </dl>
            {c.notes && <p className="mt-3 whitespace-pre-wrap border-t border-line pt-3 text-sm text-muted">{c.notes}</p>}
          </section>
          <section className="panel p-5" aria-labelledby="days-h">
            <h2 id="days-h" className="mb-3 text-base font-semibold">Trading days</h2>
            {c.status === "archived" ? <p className="text-sm text-muted">Restore this challenge to edit trading days.</p> : <TradingDays challengeId={id} dates={tradedDates} today={today} labels={labels} />}
          </section>
        </div>

        <section className="panel" aria-labelledby="hist-h">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 id="hist-h" className="text-sm font-semibold">Account history</h2>
            <Link href={`/app/trades?challenge=${id}`} className="link text-sm">View records</Link>
          </div>
          <ActivityList rows={history} prefs={prefs} />
        </section>
      </div>
    </>
  );
}
