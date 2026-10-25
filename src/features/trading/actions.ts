"use server";
import { revalidatePath } from "next/cache";
import { getActionSession, type Session } from "@/lib/server/context";
import { logAudit } from "@/lib/server/audit";
import { syncAlerts } from "@/lib/server/alerts";
import { parseMoney, centsToDecimalString } from "@/lib/calculations/money";
import { localDate } from "@/lib/calculations/time";
import { flattenZod, uuid, type ActionResult } from "@/lib/validation/common";
import {
  balanceEventSchema, resolveTradeNetPnlCents, snapshotSchema, tradeFormSchema, tradingDaySchema,
  type BalanceEventInput, type SnapshotInput, type TradeFormInput,
} from "@/lib/validation/records";

const FAIL_SAVE = "Your changes could not be saved. Your existing records have not been marked as updated.";
const NO_SESSION = "Your session has expired. Sign in again to continue.";

async function ownsChallenge(s: Session, id: string) {
  const { data } = await s.supabase.from("challenges").select("id, status, account_currency").eq("id", id).eq("user_id", s.user.id).maybeSingle<{ id: string; status: string; account_currency: string }>();
  return data;
}

/** Interprets a datetime-local value in the user's timezone and returns an ISO instant. */
function localInputToIso(value: string, timeZone: string): string {
  const [date = "", time = "00:00"] = value.split("T");
  const naive = Date.parse(`${date}T${time}:00Z`);
  const offsetOf = (t: number) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t));
    const g = (k: string) => Number(p.find((x) => x.type === k)?.value ?? 0);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(t / 1000) * 1000;
  };
  const first = naive - offsetOf(naive);
  return new Date(naive - offsetOf(first)).toISOString();
}

async function done(s: Session, challengeId: string, message: string): Promise<ActionResult> {
  await syncAlerts(s.supabase, s.user.id, challengeId, s.profile);
  revalidatePath("/app", "layout");
  revalidatePath("/app/trades");
  revalidatePath("/app/overview");
  revalidatePath(`/app/challenges/${challengeId}`);
  return { ok: true, message };
}

export async function saveTrade(input: TradeFormInput): Promise<ActionResult> {
  try {
    const s = await getActionSession();
    if (!s) return { ok: false, message: NO_SESSION };
    const parsed = tradeFormSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: flattenZod(parsed.error) };
    const v = parsed.data;
    const ch = await ownsChallenge(s, v.challengeId);
    if (!ch) return { ok: false, message: "That challenge could not be found." };
    const tz = s.profile.timezone;
    const gross = parseMoney(v.grossPnl), costs = parseMoney(v.costs);
    // Net is whatever the user entered; otherwise gross minus costs. Limitline does not infer P&L from prices.
    const net = resolveTradeNetPnlCents(v);
    const entryIso = localInputToIso(v.entryTime, tz);
    const exitIso = v.exitTime ? localInputToIso(v.exitTime, tz) : null;
    const instrument = v.instrument.toUpperCase();
    const row = {
      challenge_id: v.challengeId, user_id: s.user.id, instrument, direction: v.direction,
      entry_time: entryIso, exit_time: exitIso,
      entry_price: v.entryPrice ?? null, exit_price: v.exitPrice ?? null, stop_loss: v.stopLoss ?? null, take_profit: v.takeProfit ?? null,
      position_size: v.positionSize ?? null, gross_pnl: gross === null ? null : centsToDecimalString(gross),
      costs: costs === null ? null : centsToDecimalString(costs), net_pnl: net === null ? null : centsToDecimalString(net), notes: v.notes ?? null,
    };
    let tradeId = v.id;
    if (v.id) {
      const { data: updated, error } = await s.supabase
        .from("trades")
        .update(row)
        .eq("id", v.id)
        .eq("user_id", s.user.id)
        .select("id")
        .maybeSingle<{ id: string }>();
      if (error) return { ok: false, message: FAIL_SAVE };
      if (!updated) return { ok: false, message: "That trade could not be found." };
    } else {
      const { data: existing } = await s.supabase
        .from("trades")
        .select("id, exit_time, net_pnl")
        .eq("user_id", s.user.id)
        .eq("challenge_id", v.challengeId)
        .eq("instrument", instrument)
        .eq("direction", v.direction)
        .eq("entry_time", entryIso);
      const isDuplicate = (existing ?? []).some((e: { id: string; exit_time: string | null; net_pnl: string | null }) => {
        const sameExit = (e.exit_time ? new Date(e.exit_time).getTime() : null) === (exitIso ? new Date(exitIso).getTime() : null);
        const sameNet = parseMoney(e.net_pnl) === net;
        return sameExit && sameNet;
      });
      if (isDuplicate) {
        return { ok: false, message: "This trade has already been recorded for that entry time." };
      }
      const { data, error } = await s.supabase.from("trades").insert(row).select("id").single<{ id: string }>();
      if (error || !data) return { ok: false, message: FAIL_SAVE };
      tradeId = data.id;
    }
    // A recorded trade counts toward the trading-day requirement (exit date if closed, otherwise entry date).
    const day = localDate(new Date(exitIso ?? row.entry_time), tz);
    await s.supabase.from("trading_days").upsert({ user_id: s.user.id, challenge_id: v.challengeId, trading_date: day, status: "traded" }, { onConflict: "challenge_id,trading_date", ignoreDuplicates: true });
    await logAudit(s.supabase, { userId: s.user.id, challengeId: v.challengeId, action: v.id ? "trade_updated" : "trade_recorded", entityType: "trade", entityId: tradeId ?? null, details: { summary: `${row.instrument} ${row.direction}` } });
    return done(s, v.challengeId, v.id ? "Trade updated." : "Trade recorded.");
  } catch {
    return { ok: false, message: FAIL_SAVE };
  }
}

export async function deleteTrade(id: string): Promise<ActionResult> {
  const s = await getActionSession();
  if (!s) return { ok: false, message: NO_SESSION };
  if (!uuid.safeParse(id).success) return { ok: false, message: "That trade could not be found." };
  const { data: t } = await s.supabase.from("trades").select("id, challenge_id, instrument").eq("id", id).eq("user_id", s.user.id).maybeSingle<{ id: string; challenge_id: string; instrument: string }>();
  if (!t) return { ok: false, message: "That trade could not be found." };
  const { error } = await s.supabase.from("trades").delete().eq("id", id).eq("user_id", s.user.id);
  if (error) return { ok: false, message: FAIL_SAVE };
  await logAudit(s.supabase, { userId: s.user.id, challengeId: t.challenge_id, action: "trade_deleted", entityType: "trade", entityId: id, details: { summary: t.instrument } });
  return done(s, t.challenge_id, "Trade deleted.");
}

export async function addBalanceEvent(input: BalanceEventInput): Promise<ActionResult> {
  try {
    const s = await getActionSession();
    if (!s) return { ok: false, message: NO_SESSION };
    const parsed = balanceEventSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: flattenZod(parsed.error) };
    const v = parsed.data;
    const ch = await ownsChallenge(s, v.challengeId);
    if (!ch) return { ok: false, message: "That challenge could not be found." };
    if (v.currency !== ch.account_currency) return { ok: false, fieldErrors: { currency: `Use the account currency (${ch.account_currency}).` }, message: "Check the highlighted fields." };
    const amountCents = parseMoney(v.amount);
    if (amountCents === null || amountCents === 0) {
      return { ok: false, fieldErrors: { amount: "Enter a non-zero amount." }, message: "Check the highlighted fields." };
    }
    const occurredIso = localInputToIso(v.occurredAt, s.profile.timezone);
    const { data: existing } = await s.supabase
      .from("balance_events")
      .select("id, amount")
      .eq("user_id", s.user.id)
      .eq("challenge_id", v.challengeId)
      .eq("event_type", v.eventType)
      .eq("occurred_at", occurredIso);
    if ((existing ?? []).some((e: { id: string; amount: string }) => parseMoney(e.amount) === amountCents)) {
      return { ok: false, message: "This balance event has already been recorded for that date and time." };
    }
    const { data, error } = await s.supabase.from("balance_events").insert({
      user_id: s.user.id, challenge_id: v.challengeId, event_type: v.eventType, amount: centsToDecimalString(amountCents), currency: v.currency,
      occurred_at: occurredIso, notes: v.notes ?? null,
    }).select("id").single<{ id: string }>();
    if (error || !data) return { ok: false, message: FAIL_SAVE };
    await logAudit(s.supabase, { userId: s.user.id, challengeId: v.challengeId, action: "balance_event_recorded", entityType: "balance_event", entityId: data.id, details: { summary: v.eventType } });
    return done(s, v.challengeId, "Balance event recorded.");
  } catch {
    return { ok: false, message: FAIL_SAVE };
  }
}

export async function deleteBalanceEvent(id: string): Promise<ActionResult> {
  const s = await getActionSession();
  if (!s) return { ok: false, message: NO_SESSION };
  if (!uuid.safeParse(id).success) return { ok: false, message: "That record could not be found." };
  const { data: e } = await s.supabase.from("balance_events").select("id, challenge_id, event_type").eq("id", id).eq("user_id", s.user.id).maybeSingle<{ id: string; challenge_id: string; event_type: string }>();
  if (!e) return { ok: false, message: "That record could not be found." };
  const { error } = await s.supabase.from("balance_events").delete().eq("id", id).eq("user_id", s.user.id);
  if (error) return { ok: false, message: FAIL_SAVE };
  await logAudit(s.supabase, { userId: s.user.id, challengeId: e.challenge_id, action: "balance_event_deleted", entityType: "balance_event", entityId: id, details: { summary: e.event_type } });
  return done(s, e.challenge_id, "Balance event deleted.");
}

export async function addSnapshot(input: SnapshotInput): Promise<ActionResult> {
  try {
    const s = await getActionSession();
    if (!s) return { ok: false, message: NO_SESSION };
    const parsed = snapshotSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: flattenZod(parsed.error) };
    const v = parsed.data;
    const ch = await ownsChallenge(s, v.challengeId);
    if (!ch) return { ok: false, message: "That challenge could not be found." };
    const observedIso = localInputToIso(v.observedAt, s.profile.timezone);
    if (new Date(observedIso).getTime() > Date.now() + 5 * 60 * 1000) {
      return { ok: false, message: "Check the highlighted fields.", fieldErrors: { observedAt: "An observation cannot be dated in the future." } };
    }
    const balCents = v.balance ? parseMoney(v.balance) : null;
    const eqCents = v.equity ? parseMoney(v.equity) : null;
    const { data: existing } = await s.supabase
      .from("account_snapshots")
      .select("id, balance, equity")
      .eq("user_id", s.user.id)
      .eq("challenge_id", v.challengeId)
      .eq("observed_at", observedIso);
    const isDuplicate = (existing ?? []).some((e: { id: string; balance: string | null; equity: string | null }) =>
      parseMoney(e.balance) === balCents && parseMoney(e.equity) === eqCents,
    );
    if (isDuplicate) {
      return { ok: false, message: "This observation has already been recorded for that timestamp." };
    }
    const { data, error } = await s.supabase.from("account_snapshots").insert({
      user_id: s.user.id, challenge_id: v.challengeId,
      balance: balCents !== null ? centsToDecimalString(balCents) : null,
      equity: eqCents !== null ? centsToDecimalString(eqCents) : null,
      observed_at: observedIso, source: "manual", notes: v.notes ?? null,
    }).select("id").single<{ id: string }>();
    if (error || !data) return { ok: false, message: FAIL_SAVE };
    await logAudit(s.supabase, { userId: s.user.id, challengeId: v.challengeId, action: "snapshot_recorded", entityType: "account_snapshot", entityId: data.id, details: { summary: "manual observation" } });
    return done(s, v.challengeId, "Observation recorded.");
  } catch {
    return { ok: false, message: FAIL_SAVE };
  }
}

export async function deleteSnapshot(id: string): Promise<ActionResult> {
  const s = await getActionSession();
  if (!s) return { ok: false, message: NO_SESSION };
  if (!uuid.safeParse(id).success) return { ok: false, message: "That record could not be found." };
  const { data: e } = await s.supabase.from("account_snapshots").select("id, challenge_id").eq("id", id).eq("user_id", s.user.id).maybeSingle<{ id: string; challenge_id: string }>();
  if (!e) return { ok: false, message: "That record could not be found." };
  const { error } = await s.supabase.from("account_snapshots").delete().eq("id", id).eq("user_id", s.user.id);
  if (error) return { ok: false, message: FAIL_SAVE };
  await logAudit(s.supabase, { userId: s.user.id, challengeId: e.challenge_id, action: "snapshot_deleted", entityType: "account_snapshot", entityId: id, details: { summary: "manual observation" } });
  return done(s, e.challenge_id, "Observation deleted.");
}

export async function setTradingDay(challengeId: string, tradingDate: string, present: boolean): Promise<ActionResult> {
  const s = await getActionSession();
  if (!s) return { ok: false, message: NO_SESSION };
  const parsed = tradingDaySchema.safeParse({ challengeId, tradingDate });
  if (!parsed.success) return { ok: false, message: "Choose a valid date." };
  const ch = await ownsChallenge(s, challengeId);
  if (!ch) return { ok: false, message: "That challenge could not be found." };
  if (present) {
    const { error } = await s.supabase.from("trading_days").upsert({ user_id: s.user.id, challenge_id: challengeId, trading_date: tradingDate, status: "traded" }, { onConflict: "challenge_id,trading_date" });
    if (error) return { ok: false, message: FAIL_SAVE };
  } else {
    const { error } = await s.supabase.from("trading_days").delete().eq("challenge_id", challengeId).eq("trading_date", tradingDate).eq("user_id", s.user.id);
    if (error) return { ok: false, message: FAIL_SAVE };
  }
  await logAudit(s.supabase, { userId: s.user.id, challengeId, action: present ? "trading_day_added" : "trading_day_removed", entityType: "trading_day", details: { summary: tradingDate } });
  return done(s, challengeId, present ? "Trading day added." : "Trading day removed.");
}
