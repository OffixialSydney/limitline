import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateChallenge, type AccountEvent, type AttentionItem, type ChallengeEvaluation, type Observation,
  type RuleStatus, type TradeRecord,
} from "@/lib/calculations/engine";
import { parseMoney } from "@/lib/calculations/money";
import { localDate } from "@/lib/calculations/time";
import { parseRuleConfig } from "@/lib/validation/rules";
import type {
  BalanceEventRow, ChallengeRow, ProfileRow, RuleRow, SnapshotRow, TradeRow, TradingDayRow,
} from "@/types/db";

const PAGE = 1000;
const HARD_CAP = 20000;

/** PostgREST caps responses (1000 rows by default), so large tables are read page by page up to a hard cap. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < HARD_CAP; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error("A database read failed.");
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export interface Bundle {
  rules: RuleRow[]; snapshots: SnapshotRow[]; trades: TradeRow[]; events: BalanceEventRow[]; days: TradingDayRow[];
}

export async function loadBundle(supabase: SupabaseClient, challengeIds: string[]): Promise<Bundle> {
  if (challengeIds.length === 0) return { rules: [], snapshots: [], trades: [], events: [], days: [] };
  const [rules, snapshots, trades, events, days] = await Promise.all([
    fetchAll<RuleRow>((f, t) => supabase.from("challenge_rules").select("id, challenge_id, rule_type, configuration, source_reference, version, verified_at, updated_at").in("challenge_id", challengeIds).order("id").range(f, t)),
    fetchAll<SnapshotRow>((f, t) => supabase.from("account_snapshots").select("id, challenge_id, balance, equity, observed_at, source, notes").in("challenge_id", challengeIds).order("observed_at").order("id").range(f, t)),
    fetchAll<TradeRow>((f, t) => supabase.from("trades").select("id, challenge_id, instrument, direction, entry_time, exit_time, entry_price, exit_price, stop_loss, take_profit, position_size, gross_pnl, costs, net_pnl, notes, created_at").in("challenge_id", challengeIds).order("entry_time").order("id").range(f, t)),
    fetchAll<BalanceEventRow>((f, t) => supabase.from("balance_events").select("id, challenge_id, event_type, amount, currency, occurred_at, notes").in("challenge_id", challengeIds).order("occurred_at").order("id").range(f, t)),
    fetchAll<TradingDayRow>((f, t) => supabase.from("trading_days").select("id, challenge_id, trading_date, status").in("challenge_id", challengeIds).order("trading_date").range(f, t)),
  ]);
  return { rules, snapshots, trades, events, days };
}

export function evaluateFromRows(c: ChallengeRow, b: Bundle, profile: ProfileRow, now: Date): ChallengeEvaluation {
  const mine = <T extends { challenge_id: string }>(rows: T[]) => rows.filter((r) => r.challenge_id === c.id);
  const rule = (t: string) => mine(b.rules).find((r) => r.rule_type === t)?.configuration ?? null;
  const observations: Observation[] = mine(b.snapshots).map((s) => ({
    observedAt: new Date(s.observed_at), balance: parseMoney(s.balance), equity: parseMoney(s.equity),
  }));
  const trades: TradeRecord[] = mine(b.trades).map((t) => ({
    entryTime: new Date(t.entry_time), exitTime: t.exit_time ? new Date(t.exit_time) : null, netPnl: parseMoney(t.net_pnl),
  }));
  const events: AccountEvent[] = mine(b.events).flatMap((e) => {
    const amount = parseMoney(e.amount);
    return amount === null ? [] : [{ occurredAt: new Date(e.occurred_at), type: e.event_type, amount }];
  });
  return evaluateChallenge({
    startingBalance: parseMoney(c.starting_balance) ?? 0,
    rules: {
      profitTarget: parseRuleConfig("profit_target", rule("profit_target")),
      dailyLoss: parseRuleConfig("daily_loss", rule("daily_loss")),
      overallLoss: parseRuleConfig("overall_loss", rule("overall_loss")),
      tradingDays: parseRuleConfig("trading_days", rule("trading_days")),
    },
    observations, trades, events,
    tradedDates: mine(b.days).filter((d) => d.status === "traded").map((d) => d.trading_date),
    deadline: c.deadline, now, todayLocal: localDate(now, profile.timezone),
    staleAfterMs: profile.stale_after_hours * 3600 * 1000, warnPercent: profile.warning_threshold_pct,
  });
}

/** Plain, serialisable summary for client components. */
export interface LossView {
  status: RuleStatus; remainingCents: number | null; allowanceCents: number | null; usedPercent: number | null; reason: string | null;
}
export interface ChallengeView {
  id: string; name: string; firmName: string; currency: string; phase: string; status: ChallengeRow["status"];
  startDate: string; deadline: string | null; startingCents: number;
  balanceCents: number | null; balanceSource: "snapshot" | "derived" | "none"; equityCents: number | null;
  profitCents: number | null; targetCents: number | null; progressPercent: number | null; progressRaw: number | null;
  daily: LossView | null; overall: LossView | null; worst: RuleStatus;
  lastObservedAt: string | null; updatedAt: string; attention: AttentionItem[];
}

const lossView = (r: ChallengeEvaluation["daily"]): LossView | null => r && ({
  status: r.status, remainingCents: r.remainingCents, allowanceCents: r.allowanceCents, usedPercent: r.usedPercent, reason: r.reasons[0] ?? null,
});

export function toView(c: ChallengeRow, e: ChallengeEvaluation, b: Bundle): ChallengeView {
  const lastActivity = [c.updated_at, ...b.trades.filter((t) => t.challenge_id === c.id).map((t) => t.created_at)].sort().at(-1) ?? c.updated_at;
  return {
    id: c.id, name: c.name, firmName: c.firm_name, currency: c.account_currency, phase: c.current_phase, status: c.status,
    startDate: c.start_date, deadline: c.deadline, startingCents: parseMoney(c.starting_balance) ?? 0,
    balanceCents: e.balance.cents, balanceSource: e.balance.source, equityCents: e.balance.equityCents,
    profitCents: e.profitCents, targetCents: e.progress.targetCents,
    progressPercent: e.progress.displayPercent, progressRaw: e.progress.rawPercent,
    daily: lossView(e.daily), overall: lossView(e.overall), worst: e.worst,
    lastObservedAt: e.lastObservedAt?.toISOString() ?? null,
    updatedAt: [lastActivity, e.lastObservedAt?.toISOString() ?? ""].sort().at(-1) ?? c.updated_at,
    attention: e.attention,
  };
}

export async function loadChallengeViews(supabase: SupabaseClient, profile: ProfileRow, opts: { includeArchived: boolean }) {
  let q = supabase.from("challenges").select("*").order("created_at", { ascending: false }).limit(500);
  if (!opts.includeArchived) q = q.neq("status", "archived");
  const { data, error } = await q;
  if (error) throw new Error("Your challenges could not be loaded.");
  const rows = (data ?? []) as ChallengeRow[];
  const bundle = await loadBundle(supabase, rows.map((r) => r.id));
  const now = new Date();
  const views = rows.map((c) => toView(c, evaluateFromRows(c, bundle, profile, now), bundle));
  return { rows, bundle, views, now };
}
