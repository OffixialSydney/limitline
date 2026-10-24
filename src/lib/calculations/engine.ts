/**
 * Limitline calculation engine. Pure functions only: no React, no database, no clock.
 * Every amount is integer minor units (see money.ts). `now` is always passed in.
 *
 * Status vocabulary (see docs/CALCULATIONS.md):
 *  normal          recorded evidence shows room remaining, data is fresh and complete
 *  warning         used share of the allowance >= the user's warning threshold
 *  limit_reached   the latest observation is at/through the limit
 *  breach_recorded an earlier observation in the evaluated window went through the limit
 *  unknown         the rule model is not supported and is deliberately not calculated
 *  data_incomplete required inputs are missing, stale, or contradicted by newer records
 */
import { type Cents, parseMoney, percentOf, ratioPercent } from "./money.ts";
import { isValidResetTime, isValidTimeZone, latestResetInstant, periodKey } from "./time.ts";

export type RuleStatus =
  | "normal" | "warning" | "limit_reached" | "breach_recorded" | "unknown" | "data_incomplete";

export interface AmountSpec { mode: "amount" | "percent"; value: string }
export type ProfitTargetConfig = AmountSpec;
export interface DailyLossConfig extends AmountSpec {
  reference: "start_of_day_balance" | "start_of_day_equity" | "higher_of_balance_equity";
  includesOpenPositions: boolean;
  resetTimezone: string | null;
  resetTime: string | null;
}
export interface OverallLossConfig extends AmountSpec {
  model: "static" | "trailing" | "eod_trailing" | "custom";
  measure: "balance" | "equity";
  lockAtStartingBalance: boolean;
  resetTimezone: string | null;
  resetTime: string | null;
}
export interface TradingDaysConfig { required: number }

export interface Observation { observedAt: Date; balance: Cents | null; equity: Cents | null }
export type EventType = "deposit" | "withdrawal" | "fee" | "credit" | "adjustment";
export interface AccountEvent { occurredAt: Date; type: EventType; amount: Cents }
export interface TradeRecord { entryTime: Date | null; exitTime: Date | null; netPnl: Cents | null }

export const DEFAULT_STALE_AFTER_MS = 48 * 3600 * 1000;
export const DEFAULT_WARN_PERCENT = 80;

/** Deposits and credits add; withdrawals and fees subtract; adjustments carry their own sign. */
export function signedEventAmount(e: AccountEvent): Cents {
  switch (e.type) {
    case "deposit": case "credit": return Math.abs(e.amount);
    case "withdrawal": case "fee": return -Math.abs(e.amount);
    case "adjustment": return e.amount;
  }
}

function resolveAmount(spec: AmountSpec, base: Cents): Cents | null {
  const v = spec.mode === "amount" ? parseMoney(spec.value) : percentOf(base, spec.value);
  return v !== null && v > 0 ? v : null;
}

const sortObs = (obs: Observation[]) => [...obs].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());

// ---------------------------------------------------------------- balance & profit

export interface BalanceInfo {
  cents: Cents | null;
  source: "snapshot" | "derived" | "none";
  observedAt: Date | null;
  equityCents: Cents | null;
  equityObservedAt: Date | null;
  balanceOutdated: boolean;
  equityOutdated: boolean;
  laterTradesCount: number;
  laterEventsCount: number;
}

export function currentBalance(args: {
  startingBalance: Cents; observations: Observation[]; trades: TradeRecord[]; events: AccountEvent[];
}): BalanceInfo {
  const obs = sortObs(args.observations);
  const lastBal = [...obs].reverse().find((o) => o.balance !== null);
  const lastEq = [...obs].reverse().find((o) => o.equity !== null);
  const equityCents = lastEq?.equity ?? null;
  const equityObservedAt = lastEq?.observedAt ?? null;

  const tradeTimes = args.trades
    .map((t) => (t.exitTime ?? t.entryTime)?.getTime() ?? null)
    .filter((t): t is number => t !== null);
  const eventTimes = args.events.map((e) => e.occurredAt.getTime());

  const equityOutdated = equityObservedAt !== null && (
    tradeTimes.some((t) => t > equityObservedAt.getTime()) ||
    eventTimes.some((t) => t > equityObservedAt.getTime()) ||
    obs.some((o) => o.observedAt.getTime() > equityObservedAt.getTime() && o.equity === null)
  );

  if (lastBal && lastBal.balance !== null) {
    const balAt = lastBal.observedAt.getTime();
    const laterTradesCount = tradeTimes.filter((t) => t > balAt).length;
    const laterEventsCount = eventTimes.filter((t) => t > balAt).length;
    const newerObsWithoutBalance = obs.some((o) => o.observedAt.getTime() > balAt && o.balance === null);
    const balanceOutdated = laterTradesCount > 0 || laterEventsCount > 0 || newerObsWithoutBalance;
    return {
      cents: lastBal.balance,
      source: "snapshot",
      observedAt: lastBal.observedAt,
      equityCents,
      equityObservedAt,
      balanceOutdated,
      equityOutdated,
      laterTradesCount,
      laterEventsCount,
    };
  }
  const tradePnl = args.trades.reduce((s, t) => s + (t.netPnl ?? 0), 0);
  const hasRecords = args.trades.some((t) => t.netPnl !== null) || args.events.length > 0;
  if (hasRecords) {
    const adj = args.events.reduce((s, e) => s + signedEventAmount(e), 0);
    return {
      cents: args.startingBalance + tradePnl + adj,
      source: "derived",
      observedAt: null,
      equityCents,
      equityObservedAt,
      balanceOutdated: false,
      equityOutdated,
      laterTradesCount: 0,
      laterEventsCount: 0,
    };
  }
  return {
    cents: null,
    source: "none",
    observedAt: null,
    equityCents,
    equityObservedAt,
    balanceOutdated: false,
    equityOutdated,
    laterTradesCount: 0,
    laterEventsCount: 0,
  };
}

/**
 * Recorded trading profit/loss, excluding deposits, withdrawals, fees, credits and adjustments.
 * snapshot source: balance - starting - events recorded at or before that observation.
 * derived source: sum of recorded net trade results.
 */
export function tradingProfit(args: {
  startingBalance: Cents; balance: BalanceInfo; trades: TradeRecord[]; events: AccountEvent[];
}): Cents | null {
  const { balance } = args;
  if (balance.source === "snapshot" && balance.cents !== null && balance.observedAt) {
    const at = balance.observedAt.getTime();
    const adj = args.events.filter((e) => e.occurredAt.getTime() <= at).reduce((s, e) => s + signedEventAmount(e), 0);
    return balance.cents - args.startingBalance - adj;
  }
  if (balance.source === "derived") return args.trades.reduce((s, t) => s + (t.netPnl ?? 0), 0);
  return null;
}

// ---------------------------------------------------------------- profit target progress

export interface ProgressResult {
  available: boolean;
  reason: string | null;
  targetCents: Cents | null;
  profitCents: Cents | null;
  rawPercent: number | null;
  displayPercent: number | null; // clamped to 0..100
  state: "below_start" | "in_progress" | "reached" | "exceeded" | null;
}

export function computeProgress(args: {
  startingBalance: Cents; target: ProfitTargetConfig | null; profitCents: Cents | null;
}): ProgressResult {
  const none = (reason: string): ProgressResult => ({
    available: false, reason, targetCents: null, profitCents: args.profitCents,
    rawPercent: null, displayPercent: null, state: null,
  });
  if (!args.target) return none("No profit target is configured.");
  const targetCents = resolveAmount(args.target, args.startingBalance);
  if (targetCents === null) return none("The profit target value is missing or invalid.");
  if (args.profitCents === null) return { ...none("Not enough data"), targetCents };
  const rawPercent = ratioPercent(args.profitCents, targetCents);
  if (rawPercent === null) return { ...none("Not enough data"), targetCents };
  const state = args.profitCents < 0 ? "below_start"
    : args.profitCents > targetCents ? "exceeded"
    : args.profitCents === targetCents ? "reached" : "in_progress";
  return {
    available: true, reason: null, targetCents, profitCents: args.profitCents, rawPercent,
    displayPercent: Math.min(100, Math.max(0, rawPercent)), state,
  };
}

// ---------------------------------------------------------------- loss rules

export type Completeness = "complete" | "partial" | "missing";

export interface LossResult {
  rule: "daily" | "overall";
  measure: "balance" | "equity";
  referenceLabel: string;
  status: RuleStatus;
  reasons: string[];
  allowanceCents: Cents | null;
  thresholdCents: Cents | null;
  referenceCents: Cents | null;
  currentValueCents: Cents | null;
  usedCents: Cents | null;
  remainingCents: Cents | null; // <= 0 when the limit is reached
  usedPercent: number | null;
  completeness: Completeness;
  calculatedAt: Date;
  observedAt: Date | null;
  explanation: string;
}

interface LossArgs {
  startingBalance: Cents; observations: Observation[]; activityTimes: Date[];
  now: Date; staleAfterMs?: number; warnPercent?: number;
}

function blank(
  rule: "daily" | "overall",
  measure: "balance" | "equity",
  referenceLabel: string,
  status: RuleStatus,
  reasons: string[],
  now: Date,
  explanation: string,
  extra: Partial<LossResult> = {},
): LossResult {
  return {
    rule, measure, referenceLabel, status, reasons, allowanceCents: null, thresholdCents: null, referenceCents: null,
    currentValueCents: null, usedCents: null, remainingCents: null, usedPercent: null,
    completeness: "missing", calculatedAt: now, observedAt: null, explanation, ...extra,
  };
}

function classify(a: {
  remaining: Cents; allowance: Cents; warnPercent: number;
  breachedEarlier: boolean; downgrade: boolean;
}): RuleStatus {
  if (a.remaining <= 0) return "limit_reached";
  if (a.breachedEarlier) return "breach_recorded";
  if (a.downgrade) return "data_incomplete";
  const used = a.allowance - a.remaining;
  return used * 100 >= a.allowance * a.warnPercent ? "warning" : "normal";
}

const valueOf = (o: Observation, m: "balance" | "equity") => (m === "balance" ? o.balance : o.equity);

/** Reasons that make a reading incomplete or outdated. */
function trustIssues(lastObs: Date, measure: "balance" | "equity", args: LossArgs, extra: string[] = []): string[] {
  const issues = [...extra];
  const stale = args.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  if (args.now.getTime() - lastObs.getTime() > stale) {
    issues.push(`The latest ${measure} observation is older than the freshness window, so current conditions may differ. Record a new observation with current ${measure}.`);
  }
  if (args.activityTimes.some((t) => t.getTime() > lastObs.getTime() && t.getTime() <= args.now.getTime())) {
    issues.push(`Trades or balance events were recorded after the latest ${measure} observation, so it may not reflect them. Record a new observation with current balance and equity.`);
  }
  if (args.observations.some((o) => o.observedAt.getTime() > lastObs.getTime() && o.observedAt.getTime() <= args.now.getTime() && valueOf(o, measure) === null)) {
    issues.push(`A newer observation was recorded without a ${measure} value, so this calculation uses an older ${measure} reading. Record a new observation with both balance and equity.`);
  }
  return issues;
}

export function evaluateOverallLoss(cfg: OverallLossConfig, args: LossArgs): LossResult {
  const { now } = args;
  const warnPercent = args.warnPercent ?? DEFAULT_WARN_PERCENT;
  const measure = cfg.measure;
  const referenceLabel = cfg.model === "static"
    ? "Starting balance"
    : cfg.model === "trailing"
    ? `Highest recorded ${measure}`
    : cfg.model === "eod_trailing"
    ? `Highest completed-day ${measure}`
    : "Reference";

  if (cfg.model === "custom") {
    return blank("overall", measure, referenceLabel, "unknown",
      ["This drawdown model is marked custom or unsupported. Limitline does not calculate it."], now,
      "Custom drawdown models are not calculated, and no other model is substituted.");
  }
  const allowance = resolveAmount(cfg, args.startingBalance);
  if (allowance === null) {
    return blank("overall", measure, referenceLabel, "data_incomplete",
      ["The overall loss limit value is missing or invalid. Edit the challenge rules to set a positive loss limit."], now,
      "A positive loss limit is required.");
  }
  if (cfg.model === "eod_trailing" && (!isValidTimeZone(cfg.resetTimezone) || !isValidResetTime(cfg.resetTime))) {
    return blank("overall", measure, referenceLabel, "data_incomplete",
      ["End-of-day trailing needs a valid reset timezone and reset time to know where each day ends."], now,
      "The day boundary is unknown, so the end-of-day reference cannot be established.", { allowanceCents: allowance });
  }
  const obs = sortObs(args.observations)
    .map((o) => ({ at: o.observedAt, v: valueOf(o, cfg.measure) }))
    .filter((o): o is { at: Date; v: Cents } => o.v !== null);
  if (obs.length === 0) {
    return blank("overall", measure, referenceLabel, "data_incomplete",
      [`No ${cfg.measure} observations are recorded, so the current position cannot be established. Record an observation with your current ${cfg.measure}.`], now,
      "At least one observation is required.", { allowanceCents: allowance });
  }

  const start = args.startingBalance;
  const thresholdFor = (peak: Cents) => {
    const t = peak - allowance;
    return cfg.lockAtStartingBalance ? Math.min(t, start) : t;
  };
  const last = obs[obs.length - 1]!;
  let breachedAt: Date | null = null;
  let finalThreshold: Cents;
  let reference: Cents;

  if (cfg.model === "static") {
    finalThreshold = start - allowance;
    reference = start;
    breachedAt = obs.find((o) => o.v <= finalThreshold)?.at ?? null;
  } else if (cfg.model === "trailing") {
    let peak = start;
    for (const o of obs) {
      if (!breachedAt && o.v <= thresholdFor(peak)) breachedAt = o.at;
      peak = Math.max(peak, o.v);
    }
    reference = peak;
    finalThreshold = thresholdFor(peak);
  } else {
    const tz = cfg.resetTimezone!, rt = cfg.resetTime!;
    const days = new Map<string, { at: Date; v: Cents }[]>();
    for (const o of obs) {
      const k = periodKey(o.at, tz, rt);
      days.set(k, [...(days.get(k) ?? []), o]);
    }
    const nowKey = periodKey(now, tz, rt);
    let peak = start;
    for (const k of [...days.keys()].sort()) {
      const list = days.get(k)!;
      for (const o of list) if (!breachedAt && o.v <= thresholdFor(peak)) breachedAt = o.at;
      if (k < nowKey) peak = Math.max(peak, list[list.length - 1]!.v); // only completed days set the reference
    }
    reference = peak;
    finalThreshold = thresholdFor(peak);
  }

  const remaining = last.v - finalThreshold;
  const breachedEarlier = breachedAt !== null && remaining > 0;
  const issues = trustIssues(last.at, measure, args);
  const status = classify({ remaining, allowance, warnPercent, breachedEarlier, downgrade: issues.length > 0 });
  const used = allowance - remaining;
  const modelText = cfg.model === "static" ? "Static: threshold = starting balance - limit."
    : cfg.model === "trailing" ? `Trailing: threshold = highest recorded ${cfg.measure} - limit${cfg.lockAtStartingBalance ? ", never above the starting balance" : ""}.`
    : `End-of-day trailing: threshold = highest end-of-day ${cfg.measure} from completed days - limit${cfg.lockAtStartingBalance ? ", never above the starting balance" : ""}.`;
  return {
    rule: "overall", measure, referenceLabel, status,
    reasons: issues,
    allowanceCents: allowance, thresholdCents: finalThreshold, referenceCents: reference,
    currentValueCents: last.v, usedCents: Math.max(0, used), remainingCents: remaining,
    usedPercent: ratioPercent(Math.max(0, used), allowance),
    completeness: issues.length ? "partial" : "complete", calculatedAt: now, observedAt: last.at,
    explanation: `${modelText} Remaining = latest ${cfg.measure} - threshold, from recorded observations only.`,
  };
}

export function evaluateDailyLoss(cfg: DailyLossConfig, args: LossArgs): LossResult {
  const { now } = args;
  const warnPercent = args.warnPercent ?? DEFAULT_WARN_PERCENT;
  const measure: "balance" | "equity" = cfg.includesOpenPositions ? "equity" : "balance";
  const referenceLabel = cfg.reference === "start_of_day_balance"
    ? "Start-of-day balance"
    : cfg.reference === "start_of_day_equity"
    ? "Start-of-day equity"
    : "Higher of start-of-day balance or equity";

  const allowance = resolveAmount(cfg, args.startingBalance);
  if (allowance === null) {
    return blank("daily", measure, referenceLabel, "data_incomplete",
      ["The daily loss limit value is missing or invalid. Edit the challenge rules to set a positive loss limit."], now,
      "A positive loss limit is required.");
  }
  if (!isValidTimeZone(cfg.resetTimezone) || !isValidResetTime(cfg.resetTime)) {
    return blank("daily", measure, referenceLabel, "data_incomplete",
      ["The daily reset timezone or time is missing, so the start of the current day is unknown."], now,
      "A daily loss cannot be calculated without knowing when the day resets.", { allowanceCents: allowance });
  }
  const resetAt = latestResetInstant(now, cfg.resetTimezone, cfg.resetTime);
  const obs = sortObs(args.observations);
  const refValue = (o: Observation): Cents | null => {
    if (cfg.reference === "start_of_day_balance") return o.balance;
    if (cfg.reference === "start_of_day_equity") return o.equity;
    return o.balance !== null && o.equity !== null ? Math.max(o.balance, o.equity) : null;
  };
  const refObs = [...obs].reverse().find((o) => o.observedAt.getTime() <= resetAt.getTime() && refValue(o) !== null);
  if (!refObs) {
    return blank("daily", measure, referenceLabel, "data_incomplete",
      ["No observation exists at or before the last daily reset, so the day's starting reference is unknown. Record an observation at or before the daily reset."], now,
      "Needs an observation from before the reset to measure today's loss.", { allowanceCents: allowance });
  }
  const reference = refValue(refObs)!;
  const period = obs
    .filter((o) => o.observedAt.getTime() > resetAt.getTime())
    .map((o) => ({ at: o.observedAt, v: valueOf(o, measure) }))
    .filter((o): o is { at: Date; v: Cents } => o.v !== null);
  const threshold = reference - allowance;
  if (period.length === 0) {
    return blank("daily", measure, referenceLabel, "data_incomplete",
      [`No ${measure} observation has been recorded since the last daily reset. Record a new observation with your current ${measure}.`], now,
      "Today's loss is unknown until an observation after the reset is recorded.",
      { allowanceCents: allowance, thresholdCents: threshold, referenceCents: reference, completeness: "partial",
        observedAt: refObs.observedAt });
  }
  const last = period[period.length - 1]!;
  const breachedAt = period.find((o) => o.v <= threshold)?.at ?? null;
  const loss = reference - last.v;
  const used = Math.max(0, loss);
  const remaining = allowance - used;
  const extra: string[] = [];
  if (args.activityTimes.some((t) => t.getTime() > refObs.observedAt.getTime() && t.getTime() <= resetAt.getTime())) {
    extra.push("Trades or balance events were recorded between the reference observation and the daily reset, so the reference may be outdated.");
  }
  const issues = trustIssues(last.at, measure, args, extra);
  const breachedEarlier = breachedAt !== null && remaining > 0;
  const status = classify({ remaining, allowance, warnPercent, breachedEarlier, downgrade: issues.length > 0 });
  return {
    rule: "daily", measure, referenceLabel, status, reasons: issues, allowanceCents: allowance, thresholdCents: threshold,
    referenceCents: reference, currentValueCents: last.v, usedCents: used, remainingCents: remaining,
    usedPercent: ratioPercent(used, allowance), completeness: issues.length ? "partial" : "complete",
    calculatedAt: now, observedAt: last.at,
    explanation: `Reference = ${cfg.reference.replaceAll("_", " ")} at the last reset (${resetAt.toISOString()}). Loss = reference - latest ${measure} since the reset. Remaining = limit - loss.`,
  };
}

// ---------------------------------------------------------------- trading days & deadline

export interface TradingDaysResult {
  configured: boolean; required: number; completed: number; remaining: number; met: boolean;
}

export function computeTradingDays(cfg: TradingDaysConfig | null, tradedDates: string[]): TradingDaysResult {
  const completed = new Set(tradedDates).size;
  if (!cfg || cfg.required <= 0) return { configured: false, required: 0, completed, remaining: 0, met: true };
  return { configured: true, required: cfg.required, completed, remaining: Math.max(0, cfg.required - completed), met: completed >= cfg.required };
}

export interface DeadlineResult { status: "none" | "ok" | "approaching" | "passed"; daysRemaining: number | null }

/** `deadline` and `today` are YYYY-MM-DD in the same calendar (the user's timezone). */
export function computeDeadline(deadline: string | null, today: string, approachingDays = 7): DeadlineResult {
  if (!deadline) return { status: "none", daysRemaining: null };
  const days = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (days < 0) return { status: "passed", daysRemaining: days };
  return { status: days <= approachingDays ? "approaching" : "ok", daysRemaining: days };
}

// ---------------------------------------------------------------- full evaluation

export type AttentionKind =
  | "daily_warning" | "daily_limit" | "overall_warning" | "overall_limit" | "breach_recorded"
  | "target_reached" | "trading_days_incomplete" | "deadline_approaching" | "data_incomplete";
export interface AttentionItem { kind: AttentionKind; severity: "info" | "warning" | "critical"; message: string; key: string }

export interface ChallengeInput {
  startingBalance: Cents;
  rules: {
    profitTarget: ProfitTargetConfig | null; dailyLoss: DailyLossConfig | null;
    overallLoss: OverallLossConfig | null; tradingDays: TradingDaysConfig | null;
  };
  observations: Observation[]; trades: TradeRecord[]; events: AccountEvent[];
  tradedDates: string[]; deadline: string | null;
  now: Date; todayLocal: string; staleAfterMs?: number; warnPercent?: number;
}

export interface ChallengeEvaluation {
  balance: BalanceInfo; profitCents: Cents | null; progress: ProgressResult;
  daily: LossResult | null; overall: LossResult | null;
  tradingDays: TradingDaysResult; deadline: DeadlineResult;
  lastObservedAt: Date | null; attention: AttentionItem[]; worst: RuleStatus;
}

const RANK: Record<RuleStatus, number> = {
  breach_recorded: 5, limit_reached: 4, warning: 3, data_incomplete: 2, unknown: 1, normal: 0,
};
export const statusRank = (s: RuleStatus) => RANK[s];

export function evaluateChallenge(input: ChallengeInput): ChallengeEvaluation {
  const { now } = input;
  const activityTimes: Date[] = [
    ...input.trades.flatMap((t) => (t.exitTime ?? t.entryTime ? [(t.exitTime ?? t.entryTime) as Date] : [])),
    ...input.events.map((e) => e.occurredAt),
  ];
  const lossArgs: LossArgs = {
    startingBalance: input.startingBalance, observations: input.observations, activityTimes, now,
    ...(input.staleAfterMs !== undefined ? { staleAfterMs: input.staleAfterMs } : {}),
    ...(input.warnPercent !== undefined ? { warnPercent: input.warnPercent } : {}),
  };
  const balance = currentBalance({ startingBalance: input.startingBalance, observations: input.observations, trades: input.trades, events: input.events });
  const profitCents = tradingProfit({ startingBalance: input.startingBalance, balance, trades: input.trades, events: input.events });
  const progress = computeProgress({ startingBalance: input.startingBalance, target: input.rules.profitTarget, profitCents });
  const daily = input.rules.dailyLoss ? evaluateDailyLoss(input.rules.dailyLoss, lossArgs) : null;
  const overall = input.rules.overallLoss ? evaluateOverallLoss(input.rules.overallLoss, lossArgs) : null;
  const tradingDays = computeTradingDays(input.rules.tradingDays, input.tradedDates);
  const deadline = computeDeadline(input.deadline, input.todayLocal);
  const obsTimes = input.observations.map((o) => o.observedAt.getTime());
  const lastObservedAt = obsTimes.length ? new Date(Math.max(...obsTimes)) : null;

  const attention: AttentionItem[] = [];
  const addLoss = (r: LossResult | null, label: string, warnKind: AttentionKind, limitKind: AttentionKind) => {
    if (!r) return;
    const period = r.observedAt ? r.observedAt.toISOString().slice(0, 10) : "none";
    if (r.status === "warning") attention.push({ kind: warnKind, severity: "warning", key: `${warnKind}:${period}`, message: `${label} allowance is approaching its configured limit (${r.usedPercent ?? "?"}% used on recorded data).` });
    else if (r.status === "limit_reached") attention.push({ kind: limitKind, severity: "critical", key: `${limitKind}:${period}`, message: `The latest recorded ${r.measure} observation is at or beyond the ${label.toLowerCase()} limit.` });
    else if (r.status === "breach_recorded") attention.push({ kind: "breach_recorded", severity: "critical", key: `breach_recorded:${r.rule}:${r.observedAt?.toISOString() ?? ""}`, message: `An earlier recorded ${r.measure} observation went through the ${label.toLowerCase()} limit.` });
    else if (r.status === "data_incomplete") attention.push({ kind: "data_incomplete", severity: "warning", key: `data_incomplete:${r.rule}:${r.reasons[0] ?? ""}`, message: `${label}: ${r.reasons[0] ?? "data is incomplete."}` });
  };
  addLoss(daily, "Daily loss", "daily_warning", "daily_limit");
  addLoss(overall, "Overall loss", "overall_warning", "overall_limit");
  if (!input.rules.overallLoss) attention.push({ kind: "data_incomplete", severity: "warning", key: "data_incomplete:no_overall_rule", message: "No overall loss rule is configured, so loss status cannot be determined." });
  if (balance.balanceOutdated && !attention.some((a) => a.kind === "data_incomplete")) {
    attention.push({
      kind: "data_incomplete",
      severity: "warning",
      key: `data_incomplete:balance_outdated:${balance.observedAt?.toISOString() ?? "none"}`,
      message: "Trades or balance events were recorded after the latest balance observation. Record a new observation to update current balance and profit.",
    });
  }
  if (progress.available && (progress.state === "reached" || progress.state === "exceeded")) {
    attention.push({ kind: "target_reached", severity: "info", key: "target_reached", message: "The recorded profit has reached the configured target." });
  }
  const targetReached = progress.state === "reached" || progress.state === "exceeded";
  if (tradingDays.configured && !tradingDays.met && (targetReached || (deadline.daysRemaining !== null && deadline.daysRemaining <= 14 && deadline.status !== "passed"))) {
    attention.push({ kind: "trading_days_incomplete", severity: "warning", key: "trading_days_incomplete", message: `${tradingDays.remaining} more trading day(s) are needed to meet the minimum of ${tradingDays.required}.` });
  }
  if (deadline.status === "approaching") attention.push({ kind: "deadline_approaching", severity: "warning", key: `deadline_approaching:${input.deadline}`, message: `The deadline is in ${deadline.daysRemaining} day(s).` });

  const statuses = [daily?.status, overall?.status].filter((s): s is RuleStatus => !!s);
  const worst = statuses.reduce<RuleStatus>((w, s) => (RANK[s] > RANK[w] ? s : w), "normal");
  return { balance, profitCents, progress, daily, overall, tradingDays, deadline, lastObservedAt, attention, worst: statuses.length ? worst : "unknown" };
}
