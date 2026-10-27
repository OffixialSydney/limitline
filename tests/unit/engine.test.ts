import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { centsToDecimalString, parseMoney, percentOf, ratioPercent } from "../../src/lib/calculations/money.ts";
import { addDays, latestResetInstant, localDate, wallTimeToUtc } from "../../src/lib/calculations/time.ts";
import {
  computeDeadline, computeProgress, computeTradingDays, currentBalance, evaluateChallenge,
  evaluateDailyLoss, evaluateOverallLoss, tradingProfit,
  type AccountEvent, type DailyLossConfig, type Observation, type OverallLossConfig, type TradeRecord,
} from "../../src/lib/calculations/engine.ts";

const NOW = new Date("2026-10-22T15:00:00Z");
const NY = "America/New_York";
const c = (s: string) => parseMoney(s)!;
const o = (iso: string, balance: string | null, equity: string | null = null): Observation => ({
  observedAt: new Date(iso), balance: balance === null ? null : c(balance), equity: equity === null ? null : c(equity),
});
const START = c("10000");

const daily = (over: Partial<DailyLossConfig> = {}): DailyLossConfig => ({
  mode: "amount", value: "500", reference: "start_of_day_balance", includesOpenPositions: false,
  resetTimezone: NY, resetTime: "17:00", ...over,
});
const overall = (over: Partial<OverallLossConfig> = {}): OverallLossConfig => ({
  mode: "amount", value: "1000", model: "static", measure: "balance", lockAtStartingBalance: false,
  resetTimezone: NY, resetTime: "17:00", ...over,
});
const args = (observations: Observation[], extra: Partial<Parameters<typeof evaluateDailyLoss>[1]> = {}) => ({
  startingBalance: START, observations, activityTimes: [], now: NOW, ...extra,
});

describe("money precision", () => {
  it("adds decimals exactly in integer cents", () => {
    assert.equal(c("0.1") + c("0.2"), 30);
  });
  it("rounds half away from zero once at parse time", () => {
    assert.equal(parseMoney("10.005"), 1001);
    assert.equal(parseMoney("10.004"), 1000);
    assert.equal(parseMoney("-10.005"), -1001);
  });
  it("rejects non-decimal input", () => {
    assert.equal(parseMoney("1e3"), null);
    assert.equal(parseMoney(""), null);
    assert.equal(parseMoney("abc"), null);
  });
  it("computes percentages in integers", () => {
    assert.equal(percentOf(c("10000"), "5"), c("500"));
    assert.equal(percentOf(c("10000"), "4.25"), c("425"));
    assert.equal(percentOf(33333, "0.01"), 3);
  });
  it("formats cents back to a decimal string", () => {
    assert.equal(centsToDecimalString(-1005), "-10.05");
    assert.equal(ratioPercent(400_00, 1000_00), 40);
  });
});

describe("profit target progress", () => {
const target: import("../../src/lib/calculations/engine.ts").ProfitTargetConfig = {
  mode: "amount",
  value: "1000",
};
  const run = (profit: string | null, t = target) =>
    computeProgress({ startingBalance: START, target: t, profitCents: profit === null ? null : c(profit) });
  it("40% for 10,400 on a 10,000 start with a 1,000 target", () => {
    const r = run("400");
    assert.equal(r.rawPercent, 40);
    assert.equal(r.state, "in_progress");
  });
  it("supports percent targets", () => assert.equal(run("400", { mode: "percent", value: "10" }).rawPercent, 40));
  it("zero profit is 0% not unavailable", () => {
    const r = run("0");
    assert.equal(r.available, true);
    assert.equal(r.displayPercent, 0);
  });
  it("target reached", () => assert.equal(run("1000").state, "reached"));
  it("target exceeded is clamped for display but keeps the raw value", () => {
    const r = run("1500");
    assert.equal(r.state, "exceeded");
    assert.equal(r.rawPercent, 150);
    assert.equal(r.displayPercent, 100);
  });
  it("negative P&L clamps display to 0", () => {
    const r = run("-200");
    assert.equal(r.state, "below_start");
    assert.equal(r.rawPercent, -20);
    assert.equal(r.displayPercent, 0);
  });
  it("is unavailable without data or a valid target", () => {
    assert.equal(run(null).available, false);
    assert.equal(run(null).reason, "Not enough data");
    assert.equal(run("100", { mode: "amount", value: "0" }).available, false);
    assert.equal(computeProgress({ startingBalance: START, target: null, profitCents: 0 }).available, false);
  });
});

describe("time zones and DST", () => {
  it("reset instant differs across the spring-forward transition", () => {
    assert.equal(wallTimeToUtc("2026-03-06", "17:00", NY).toISOString(), "2026-03-06T22:00:00.000Z");
    assert.equal(wallTimeToUtc("2026-03-09", "17:00", NY).toISOString(), "2026-03-09T21:00:00.000Z");
  });
  it("picks the earlier instant for a repeated fall-back wall time", () => {
    assert.equal(wallTimeToUtc("2026-11-01", "01:30", NY).toISOString(), "2026-11-01T05:30:00.000Z");
  });
  it("moves a nonexistent spring-forward wall time past the gap", () => {
    assert.equal(wallTimeToUtc("2026-03-08", "02:30", NY).toISOString(), "2026-03-08T07:30:00.000Z");
  });
  it("finds the latest reset before and after the reset time", () => {
    assert.equal(latestResetInstant(new Date("2026-03-09T20:00:00Z"), NY, "17:00").toISOString(), "2026-03-08T21:00:00.000Z");
    assert.equal(latestResetInstant(new Date("2026-03-09T21:30:00Z"), NY, "17:00").toISOString(), "2026-03-09T21:00:00.000Z");
    assert.equal(latestResetInstant(new Date("2026-03-07T20:00:00Z"), NY, "17:00").toISOString(), "2026-03-06T22:00:00.000Z");
  });
  it("local date and day arithmetic", () => {
    assert.equal(localDate(new Date("2026-10-22T02:00:00Z"), NY), "2026-10-21");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  });
  it("uses the correct DST offset when measuring a daily loss", () => {
    const now = new Date("2026-03-09T15:00:00Z");
    const r = evaluateDailyLoss(daily(), {
      startingBalance: START, activityTimes: [], now,
      observations: [o("2026-03-08T20:00:00Z", "10400"), o("2026-03-08T21:30:00Z", "10000"), o("2026-03-09T14:00:00Z", "9800")],
    });
    // The reset was 21:00Z (EDT). Reference is the 20:00Z observation (10,400), so 9,800 is a 600 loss.
    assert.equal(r.referenceCents, c("10400"));
    assert.equal(r.status, "limit_reached");
  });
});

describe("daily loss", () => {
  const base = [o("2026-10-21T20:00:00Z", "10000")];
  it("normal: 300 lost of 500 leaves 200", () => {
    const r = evaluateDailyLoss(daily(), args([...base, o("2026-10-22T14:00:00Z", "9700")]));
    assert.equal(r.status, "normal");
    assert.equal(r.remainingCents, c("200"));
    assert.equal(r.usedPercent, 60);
  });
  it("warning at 90% used", () => {
    const r = evaluateDailyLoss(daily(), args([...base, o("2026-10-22T14:00:00Z", "9550")]));
    assert.equal(r.status, "warning");
    assert.equal(r.remainingCents, c("50"));
  });
  it("respects a custom warning threshold", () => {
    const r = evaluateDailyLoss(daily(), args([...base, o("2026-10-22T14:00:00Z", "9700")], { warnPercent: 50 }));
    assert.equal(r.status, "warning");
  });
  it("limit reached exactly at the limit", () => {
    const r = evaluateDailyLoss(daily(), args([...base, o("2026-10-22T14:00:00Z", "9500")]));
    assert.equal(r.status, "limit_reached");
    assert.equal(r.remainingCents, 0);
  });
  it("breach recorded when an earlier observation crossed the limit and the account recovered", () => {
    const r = evaluateDailyLoss(daily(), args([...base, o("2026-10-22T10:00:00Z", "9400"), o("2026-10-22T14:00:00Z", "9800")]));
    assert.equal(r.status, "breach_recorded");
  });
  it("a gain today leaves the full allowance", () => {
    const r = evaluateDailyLoss(daily(), args([...base, o("2026-10-22T14:00:00Z", "10200")]));
    assert.equal(r.remainingCents, c("500"));
    assert.equal(r.status, "normal");
  });
  it("percent allowance uses the starting balance", () => {
    const r = evaluateDailyLoss(daily({ mode: "percent", value: "5" }), args([...base, o("2026-10-22T14:00:00Z", "9700")]));
    assert.equal(r.allowanceCents, c("500"));
  });
  it("no snapshots is data incomplete, never normal", () => {
    const r = evaluateDailyLoss(daily(), args([]));
    assert.equal(r.status, "data_incomplete");
    assert.equal(r.remainingCents, null);
  });
  it("missing reset timezone is data incomplete", () => {
    assert.equal(evaluateDailyLoss(daily({ resetTimezone: null }), args(base)).status, "data_incomplete");
    assert.equal(evaluateDailyLoss(daily({ resetTimezone: "Mars/Phobos" }), args(base)).status, "data_incomplete");
    assert.equal(evaluateDailyLoss(daily({ resetTime: null }), args(base)).status, "data_incomplete");
  });
  it("no observation since the reset is data incomplete", () => {
    const r = evaluateDailyLoss(daily(), args(base));
    assert.equal(r.status, "data_incomplete");
    assert.equal(r.remainingCents, null);
  });
  it("no observation before the reset is data incomplete", () => {
    const r = evaluateDailyLoss(daily(), args([o("2026-10-22T14:00:00Z", "9700")]));
    assert.equal(r.status, "data_incomplete");
  });
  it("equity measure requires equity values", () => {
    const r = evaluateDailyLoss(daily({ includesOpenPositions: true, reference: "start_of_day_equity" }),
      args([o("2026-10-21T20:00:00Z", "10000", "10050"), o("2026-10-22T14:00:00Z", "9700", "9750")]));
    assert.equal(r.referenceCents, c("10050"));
    assert.equal(r.usedCents, c("300"));
  });
  it("a trade recorded after the latest observation prevents a healthy status", () => {
    const r = evaluateDailyLoss(daily(), args([...base, o("2026-10-22T14:00:00Z", "9700")], { activityTimes: [new Date("2026-10-22T14:30:00Z")] }));
    assert.equal(r.status, "data_incomplete");
    assert.equal(r.completeness, "partial");
  });
  it("a hard limit is still reported even when the data is stale", () => {
    const r = evaluateDailyLoss(daily(), args([...base, o("2026-10-22T14:00:00Z", "9400")], { activityTimes: [new Date("2026-10-22T14:30:00Z")] }));
    assert.equal(r.status, "limit_reached");
  });
});

describe("overall loss", () => {
  it("static: threshold is starting balance minus the limit", () => {
    const r = evaluateOverallLoss(overall(), args([o("2026-10-22T14:00:00Z", "9400")]));
    assert.equal(r.thresholdCents, c("9000"));
    assert.equal(r.remainingCents, c("400"));
    assert.equal(r.status, "normal"); // 60% used, below the 80% warning threshold
  });
  it("static: warning and limit reached", () => {
    assert.equal(evaluateOverallLoss(overall(), args([o("2026-10-22T14:00:00Z", "9150")])).status, "warning");
    assert.equal(evaluateOverallLoss(overall(), args([o("2026-10-22T14:00:00Z", "9000")])).status, "limit_reached");
    assert.equal(evaluateOverallLoss(overall(), args([o("2026-10-22T14:00:00Z", "8800")])).remainingCents, c("-200"));
  });
  it("static: zero and positive P&L keep the full allowance buffer", () => {
    const r = evaluateOverallLoss(overall(), args([o("2026-10-22T14:00:00Z", "10000")]));
    assert.equal(r.remainingCents, c("1000"));
    assert.equal(r.usedCents, 0);
  });
  it("trailing: the threshold follows the highest recorded balance", () => {
    const r = evaluateOverallLoss(overall({ model: "trailing" }), args([o("2026-10-21T14:00:00Z", "10500"), o("2026-10-22T14:00:00Z", "11200")]));
    assert.equal(r.thresholdCents, c("10200"));
    assert.equal(r.remainingCents, c("1000"));
  });
  it("trailing: falling back toward the trailed threshold reduces the remaining room", () => {
    const r = evaluateOverallLoss(overall({ model: "trailing" }), args([o("2026-10-21T14:00:00Z", "11200"), o("2026-10-22T14:00:00Z", "10300")]));
    assert.equal(r.remainingCents, c("100"));
    assert.equal(r.status, "warning");
  });
  it("trailing: crossing the trailed threshold is a limit reached", () => {
    const r = evaluateOverallLoss(overall({ model: "trailing" }), args([o("2026-10-21T14:00:00Z", "11200"), o("2026-10-22T14:00:00Z", "10100")]));
    assert.equal(r.status, "limit_reached");
  });
  it("trailing: lock at starting balance stops the threshold rising above the start", () => {
    const r = evaluateOverallLoss(overall({ model: "trailing", lockAtStartingBalance: true }), args([o("2026-10-22T14:00:00Z", "11200")]));
    assert.equal(r.thresholdCents, c("10000"));
    assert.equal(r.remainingCents, c("1200"));
  });
  const eodObs = [o("2026-10-20T14:00:00Z", "11500"), o("2026-10-20T20:00:00Z", "10900"), o("2026-10-22T13:00:00Z", "10800")];
  it("end-of-day trailing ignores intraday peaks and uses completed day closes", () => {
    const eod = evaluateOverallLoss(overall({ model: "eod_trailing" }), args(eodObs));
    assert.equal(eod.thresholdCents, c("9900"));
    assert.equal(eod.remainingCents, c("900"));
    const intraday = evaluateOverallLoss(overall({ model: "trailing" }), args(eodObs));
    assert.equal(intraday.thresholdCents, c("10500"));
    assert.equal(intraday.remainingCents, c("300"));
  });
  it("end-of-day trailing needs a timezone and reset time", () => {
    const r = evaluateOverallLoss(overall({ model: "eod_trailing", resetTimezone: null }), args(eodObs));
    assert.equal(r.status, "data_incomplete");
  });
  it("custom models are unknown and never substituted", () => {
    const r = evaluateOverallLoss(overall({ model: "custom" }), args([o("2026-10-22T14:00:00Z", "10000")]));
    assert.equal(r.status, "unknown");
    assert.equal(r.remainingCents, null);
  });
  it("missing observations are data incomplete", () => {
    assert.equal(evaluateOverallLoss(overall(), args([])).status, "data_incomplete");
    assert.equal(evaluateOverallLoss(overall({ measure: "equity" }), args([o("2026-10-22T14:00:00Z", "9900")])).status, "data_incomplete");
  });
  it("stale observations cannot produce a healthy status", () => {
    const r = evaluateOverallLoss(overall(), args([o("2026-10-12T14:00:00Z", "9900")]));
    assert.equal(r.status, "data_incomplete");
    assert.match(r.reasons.join(" "), /older/);
  });
  it("a recorded trade after the latest snapshot prevents a healthy status", () => {
    const r = evaluateOverallLoss(overall(), args([o("2026-10-22T14:00:00Z", "9900")], { activityTimes: [new Date("2026-10-22T14:30:00Z")] }));
    assert.equal(r.status, "data_incomplete");
  });
  it("changing the configured limit changes the calculated status", () => {
    const obs = [o("2026-10-22T14:00:00Z", "9600")];
    assert.equal(evaluateOverallLoss(overall({ value: "1000" }), args(obs)).status, "normal");
    assert.equal(evaluateOverallLoss(overall({ value: "450" }), args(obs)).status, "warning");
    assert.equal(evaluateOverallLoss(overall({ value: "400" }), args(obs)).status, "limit_reached");
  });
  it("a prior breach is kept as breach_recorded after recovery (static)", () => {
    const r = evaluateOverallLoss(overall(), args([o("2026-10-20T14:00:00Z", "8900"), o("2026-10-22T14:00:00Z", "9800")]));
    assert.equal(r.status, "breach_recorded");
  });
});

describe("balance, deposits and withdrawals", () => {
  const trade = (pnl: string | null): TradeRecord => ({ entryTime: null, exitTime: new Date("2026-10-20T12:00:00Z"), netPnl: pnl === null ? null : c(pnl) });
  const ev = (type: AccountEvent["type"], amount: string, at = "2026-10-20T00:00:00Z"): AccountEvent => ({ type, amount: c(amount), occurredAt: new Date(at) });
  it("a deposit is not trading profit (snapshot basis)", () => {
    const obs = [o("2026-10-21T14:00:00Z", "12000")];
    const events = [ev("deposit", "1500")];
    const bal = currentBalance({ startingBalance: START, observations: obs, trades: [], events });
    assert.equal(bal.source, "snapshot");
    assert.equal(tradingProfit({ startingBalance: START, balance: bal, trades: [], events }), c("500"));
  });
  it("a withdrawal is not a trading loss", () => {
    const obs = [o("2026-10-21T14:00:00Z", "9800")];
    const events = [ev("withdrawal", "200")];
    const bal = currentBalance({ startingBalance: START, observations: obs, trades: [], events });
    assert.equal(tradingProfit({ startingBalance: START, balance: bal, trades: [], events }), 0);
  });
  it("events after the latest snapshot are not subtracted from it", () => {
    const obs = [o("2026-10-21T14:00:00Z", "10400")];
    const events = [ev("deposit", "1000", "2026-10-22T00:00:00Z")];
    const bal = currentBalance({ startingBalance: START, observations: obs, trades: [], events });
    assert.equal(tradingProfit({ startingBalance: START, balance: bal, trades: [], events }), c("400"));
  });
  it("derived balance without snapshots adds trades and adjustments, profit is trades only", () => {
    const trades = [trade("300"), trade("-50"), trade(null)];
    const events = [ev("deposit", "1000"), ev("fee", "25"), ev("adjustment", "-5")];
    const bal = currentBalance({ startingBalance: START, observations: [], trades, events });
    assert.equal(bal.source, "derived");
    assert.equal(bal.cents, c("10000") + c("250") + c("1000") - c("25") - c("5"));
    assert.equal(tradingProfit({ startingBalance: START, balance: bal, trades, events }), c("250"));
  });
  it("no records means no balance and no profit", () => {
    const bal = currentBalance({ startingBalance: START, observations: [], trades: [], events: [] });
    assert.equal(bal.cents, null);
    assert.equal(tradingProfit({ startingBalance: START, balance: bal, trades: [], events: [] }), null);
  });
});

describe("trading days and deadline", () => {
  it("counts unique dates", () => {
    const r = computeTradingDays({ required: 4 }, ["2026-10-01", "2026-10-01", "2026-10-02"]);
    assert.deepEqual([r.completed, r.remaining, r.met], [2, 2, false]);
  });
  it("not configured counts as met without claiming a requirement", () => {
    const r = computeTradingDays(null, []);
    assert.deepEqual([r.configured, r.met], [false, true]);
  });
  it("deadline states", () => {
    assert.equal(computeDeadline(null, "2026-10-22").status, "none");
    assert.deepEqual(computeDeadline("2026-10-25", "2026-10-22"), { status: "approaching", daysRemaining: 3 });
    assert.equal(computeDeadline("2026-11-30", "2026-10-22").status, "ok");
    assert.equal(computeDeadline("2026-10-21", "2026-10-22").status, "passed");
  });
});

describe("evaluateChallenge", () => {
  const rules = {
    profitTarget: { mode: "amount" as const, value: "1000" }, dailyLoss: daily(), overallLoss: overall(),
    tradingDays: { required: 4 },
  };
  const input = (observations: Observation[], over = {}) => ({
    startingBalance: START, rules, observations, trades: [], events: [], tradedDates: [], deadline: null,
    now: NOW, todayLocal: "2026-10-22", ...over,
  });
  it("incomplete records never produce a healthy worst status", () => {
    const e = evaluateChallenge(input([]));
    assert.equal(e.worst, "data_incomplete");
    assert.equal(e.progress.available, false);
    assert.ok(e.attention.some((a) => a.kind === "data_incomplete"));
  });
  it("combines progress, loss rules and alerts from the same records", () => {
    const e = evaluateChallenge(input([o("2026-10-21T20:00:00Z", "10000"), o("2026-10-22T14:00:00Z", "10400")]));
    assert.equal(e.progress.rawPercent, 40);
    assert.equal(e.daily?.status, "normal");
    assert.equal(e.overall?.status, "normal");
    assert.equal(e.worst, "normal");
    assert.equal(e.attention.length, 0);
  });
  it("flags target reached and incomplete trading days together", () => {
    const e = evaluateChallenge(input([o("2026-10-21T20:00:00Z", "10000"), o("2026-10-22T14:00:00Z", "11050")], { tradedDates: ["2026-10-20"] }));
    const kinds = e.attention.map((a) => a.kind);
    assert.ok(kinds.includes("target_reached"));
    assert.ok(kinds.includes("trading_days_incomplete"));
  });
  it("flags an approaching deadline", () => {
    const e = evaluateChallenge(input([o("2026-10-22T14:00:00Z", "10000")], { deadline: "2026-10-25" }));
    assert.ok(e.attention.some((a) => a.kind === "deadline_approaching"));
  });
  it("a missing overall rule is surfaced, not assumed healthy", () => {
    const e = evaluateChallenge(input([o("2026-10-22T14:00:00Z", "10000")], { rules: { ...rules, overallLoss: null, dailyLoss: null } }));
    assert.equal(e.worst, "unknown");
    assert.ok(e.attention.some((a) => a.key === "data_incomplete:no_overall_rule"));
  });
});

describe("challenge page data consistency audit scenarios", () => {
  it("reproduces the $10,000 balance / $1,000 equity / $9,500 daily ref / $8,500 (4,250%) used scenario with explicit metric labels", () => {
    const observations: Observation[] = [
      o("2026-10-21T20:00:00Z", "9500", "9500"),
      o("2026-10-22T10:00:00Z", "10000", "1000"),
    ];
    const laterTrade: TradeRecord = {
      entryTime: new Date("2026-10-22T11:00:00Z"),
      exitTime: new Date("2026-10-22T11:30:00Z"),
      netPnl: c("150"),
    };
    const laterWithdrawal: AccountEvent = {
      occurredAt: new Date("2026-10-22T12:00:00Z"),
      type: "withdrawal",
      amount: c("200"),
    };

    const ev = evaluateChallenge({
      startingBalance: c("10000"),
      rules: {
        profitTarget: { mode: "amount", value: "1000" },
        dailyLoss: daily({
          mode: "amount",
          value: "200",
          reference: "start_of_day_balance",
          includesOpenPositions: true,
        }),
        overallLoss: overall({
          mode: "amount",
          value: "600",
          model: "static",
          measure: "balance",
        }),
        tradingDays: { required: 4 },
      },
      observations,
      trades: [laterTrade],
      events: [laterWithdrawal],
      tradedDates: ["2026-10-22"],
      deadline: null,
      now: NOW,
      todayLocal: "2026-10-22",
    });

    // Balance & equity remain distinct and flag post-snapshot activity
    assert.equal(ev.balance.cents, c("10000"));
    assert.equal(ev.balance.equityCents, c("1000"));
    assert.equal(ev.balance.source, "snapshot");
    assert.equal(ev.balance.balanceOutdated, true);
    assert.equal(ev.balance.equityOutdated, true);
    assert.equal(ev.balance.laterTradesCount, 1);
    assert.equal(ev.balance.laterEventsCount, 1);

    // Snapshot-based trading profit at 10:00Z is $10,000 - $10,000 = $0 (0% target progress)
    assert.equal(ev.profitCents, 0);
    assert.equal(ev.progress.available, true);
    assert.equal(ev.progress.rawPercent, 0);
    assert.equal(ev.progress.displayPercent, 0);
    assert.equal(ev.progress.state, "in_progress");

    // Daily loss uses equity ($1,000) against $9,500 reference and $200 allowance -> $8,500 used (4,250%)
    assert.ok(ev.daily);
    assert.equal(ev.daily.measure, "equity");
    assert.equal(ev.daily.referenceCents, c("9500"));
    assert.equal(ev.daily.allowanceCents, c("200"));
    assert.equal(ev.daily.thresholdCents, c("9300"));
    assert.equal(ev.daily.currentValueCents, c("1000"));
    assert.equal(ev.daily.usedCents, c("8500"));
    assert.equal(ev.daily.usedPercent, 4250);
    assert.equal(ev.daily.completeness, "partial");
    assert.equal(ev.daily.status, "limit_reached");

    // Overall loss uses balance ($10,000) against $10,000 reference and $600 allowance -> downgraded to data_incomplete because of later trade/withdrawal
    assert.ok(ev.overall);
    assert.equal(ev.overall.measure, "balance");
    assert.equal(ev.overall.referenceCents, c("10000"));
    assert.equal(ev.overall.allowanceCents, c("600"));
    assert.equal(ev.overall.thresholdCents, c("9400"));
    assert.equal(ev.overall.currentValueCents, c("10000"));
    assert.equal(ev.overall.usedCents, 0);
    assert.equal(ev.overall.usedPercent, 0);
    assert.equal(ev.overall.completeness, "partial");
    assert.equal(ev.overall.status, "data_incomplete");
  });

  it("flags an older equity observation as partial/incomplete when a newer balance-only observation exists", () => {
    const observations: Observation[] = [
      o("2026-10-21T20:00:00Z", "10000", "10000"),
      o("2026-10-22T10:00:00Z", "9900", "9900"),
      o("2026-10-22T12:00:00Z", "10000", null), // newer balance-only observation
    ];
    const bal = currentBalance({ startingBalance: START, observations, trades: [], events: [] });
    assert.equal(bal.cents, c("10000"));
    assert.equal(bal.equityCents, c("9900"));
    assert.equal(bal.balanceOutdated, false);
    assert.equal(bal.equityOutdated, true);

    const d = evaluateDailyLoss(daily({ includesOpenPositions: true }), args(observations));
    assert.equal(d.measure, "equity");
    assert.equal(d.status, "data_incomplete");
    assert.equal(d.completeness, "partial");
    assert.match(d.reasons.join(" "), /newer observation was recorded without a equity value/i);
  });

  it("handles zero-denominator and invalid allowance edge cases safely without NaN or Infinity", () => {
    assert.equal(ratioPercent(c("100"), 0), null);
    assert.equal(ratioPercent(0, 0), null);
    const dZero = evaluateDailyLoss(daily({ value: "0" }), args([o("2026-10-21T20:00:00Z", "10000"), o("2026-10-22T12:00:00Z", "9900")]));
    assert.equal(dZero.status, "data_incomplete");
    assert.equal(dZero.usedPercent, null);
    const oZero = evaluateOverallLoss(overall({ value: "0" }), args([o("2026-10-22T12:00:00Z", "9900")]));
    assert.equal(oZero.status, "data_incomplete");
    assert.equal(oZero.usedPercent, null);
  });
});

describe("daily loss reset timezone and overall loss profit buffer audit", () => {
  const LAGOS = "Africa/Lagos";
  // Evaluation time: Oct 24, 2026 at 01:40 AM Africa/Lagos (00:40:00Z)
  const NOW_LAGOS = new Date("2026-10-24T00:40:00.000Z");

  it("correctly identifies an observation at 12:28 AM UTC (01:28 AM Africa/Lagos) as BEFORE the 01:34 Africa/Lagos reset (00:34 UTC)", () => {
    const reset = latestResetInstant(NOW_LAGOS, LAGOS, "01:34");
    assert.equal(reset.toISOString(), "2026-10-24T00:34:00.000Z");

    // Observation recorded at Oct 24, 2026 12:28 AM UTC (01:28 AM Africa/Lagos) with $10,050 balance & equity
    const obsPreReset = o("2026-10-24T00:28:00.000Z", "10050", "10050");
    const dl = evaluateDailyLoss(
      daily({
        mode: "amount",
        value: "200",
        reference: "start_of_day_balance",
        includesOpenPositions: false,
        resetTimezone: LAGOS,
        resetTime: "01:34",
      }),
      {
        startingBalance: c("10000"),
        observations: [obsPreReset],
        activityTimes: [],
        now: NOW_LAGOS,
      },
    );

    // Pre-reset observation becomes the start-of-day reference ($10,050), and current period has no observations yet
    assert.equal(dl.status, "data_incomplete");
    assert.equal(dl.completeness, "partial");
    assert.equal(dl.referenceCents, c("10050"));
    assert.equal(dl.allowanceCents, c("200"));
    assert.equal(dl.thresholdCents, c("9850"));
    assert.equal(dl.currentValueCents, null);
    assert.equal(dl.remainingCents, null);
    assert.equal(dl.resetAt?.toISOString(), "2026-10-24T00:34:00.000Z");
    assert.equal(dl.resetTimezone, LAGOS);
    assert.match(dl.reasons.join(" "), /No balance observation has been recorded since the last daily reset/i);
  });

  it("completes the daily loss calculation once an observation is recorded after 01:34 Africa/Lagos", () => {
    const obsPreReset = o("2026-10-24T00:28:00.000Z", "10050", "10050");
    const obsPostReset = o("2026-10-24T00:38:00.000Z", "10020", "10020"); // 01:38 AM Africa/Lagos
    const dl = evaluateDailyLoss(
      daily({
        mode: "amount",
        value: "200",
        reference: "start_of_day_balance",
        includesOpenPositions: false,
        resetTimezone: LAGOS,
        resetTime: "01:34",
      }),
      {
        startingBalance: c("10000"),
        observations: [obsPreReset, obsPostReset],
        activityTimes: [],
        now: NOW_LAGOS,
      },
    );

    assert.equal(dl.status, "normal");
    assert.equal(dl.completeness, "complete");
    assert.equal(dl.referenceCents, c("10050"));
    assert.equal(dl.thresholdCents, c("9850"));
    assert.equal(dl.currentValueCents, c("10020"));
    assert.equal(dl.usedCents, c("30"));
    assert.equal(dl.remainingCents, c("170"));
    assert.equal(dl.usedPercent, 15);
  });

  it("reports $650 remaining on a static $600 overall loss allowance when current value is $10,050 (+$50 profit buffer above $10,000 start)", () => {
    const obs = o("2026-10-24T00:28:00.000Z", "10050", "10050");
    const ol = evaluateOverallLoss(
      overall({
        mode: "amount",
        value: "600",
        model: "static",
        measure: "equity",
      }),
      {
        startingBalance: c("10000"),
        observations: [obs],
        activityTimes: [],
        now: NOW_LAGOS,
      },
    );

    assert.equal(ol.status, "normal");
    assert.equal(ol.completeness, "complete");
    assert.equal(ol.referenceCents, c("10000"));
    assert.equal(ol.allowanceCents, c("600"));
    assert.equal(ol.thresholdCents, c("9400"));
    assert.equal(ol.currentValueCents, c("10050"));
    // Remaining = $10,050 (latest value) - $9,400 (static floor) = $650 ($600 allowance + $50 profit buffer)
    assert.equal(ol.remainingCents, c("650"));
    assert.equal(ol.usedCents, 0);
    assert.equal(ol.usedPercent, 0);
  });
});

describe("net result missing vs zero and observation freshness regressions", () => {
  const rules = {
    profitTarget: { mode: "amount" as const, value: "1000" },
    dailyLoss: daily(),
    overallLoss: overall(),
    tradingDays: { required: 4 },
  };

  it("8. a trade with a missing net result (null) is never silently counted as a confirmed $0 result, even when a deposit exists", () => {
    const tradeMissingNet: TradeRecord = {
      entryTime: new Date("2026-10-22T10:00:00Z"),
      exitTime: null,
      netPnl: null,
    };
    const depositEvent: AccountEvent = {
      occurredAt: new Date("2026-10-22T09:00:00Z"),
      type: "deposit",
      amount: c("500"),
    };

    // Case A: Trade with missing netPnl alone
    const evalAlone = evaluateChallenge({
      startingBalance: START,
      rules,
      observations: [],
      trades: [tradeMissingNet],
      events: [],
      tradedDates: ["2026-10-22"],
      deadline: null,
      now: NOW,
      todayLocal: "2026-10-22",
    });
    assert.equal(evalAlone.balance.cents, null);
    assert.equal(evalAlone.profitCents, null);
    assert.equal(evalAlone.progress.available, false);

    // Case B: Trade with missing netPnl alongside a deposit (derived balance has $10,500, but trading profit must remain null, NOT 0)
    const evalWithDeposit = evaluateChallenge({
      startingBalance: START,
      rules,
      observations: [],
      trades: [tradeMissingNet],
      events: [depositEvent],
      tradedDates: ["2026-10-22"],
      deadline: null,
      now: NOW,
      todayLocal: "2026-10-22",
    });
    assert.equal(evalWithDeposit.balance.source, "derived");
    assert.equal(evalWithDeposit.balance.cents, c("10500"));
    assert.equal(evalWithDeposit.profitCents, null);
    assert.equal(evalWithDeposit.progress.available, false);
  });

  it("9. an explicit net result of zero (0) produces $0.00 trading profit and 0% target progress", () => {
    const tradeExplicitZero: TradeRecord = {
      entryTime: new Date("2026-10-22T10:00:00Z"),
      exitTime: new Date("2026-10-22T11:00:00Z"),
      netPnl: 0,
    };
    const ev = evaluateChallenge({
      startingBalance: START,
      rules,
      observations: [],
      trades: [tradeExplicitZero],
      events: [],
      tradedDates: ["2026-10-22"],
      deadline: null,
      now: NOW,
      todayLocal: "2026-10-22",
    });
    assert.equal(ev.balance.source, "derived");
    assert.equal(ev.balance.cents, START);
    assert.equal(ev.profitCents, 0);
    assert.equal(ev.progress.available, true);
    assert.equal(ev.progress.rawPercent, 0);
    assert.equal(ev.progress.displayPercent, 0);
  });

  it("10, 11 & 12. recording a newer observation after a trade/event clears the outdated notice and restores healthy status", () => {
    const preReset = o("2026-10-21T20:00:00Z", "10000", "10000");
    const morningObs = o("2026-10-22T10:00:00Z", "10100", "10100");
    const noonTrade: TradeRecord = {
      entryTime: new Date("2026-10-22T12:00:00Z"),
      exitTime: new Date("2026-10-22T12:30:00Z"),
      netPnl: c("100"),
    };

    // Before newer observation: outdated notice is active and daily/overall are downgraded to data_incomplete
    const beforeNewObs = evaluateChallenge({
      startingBalance: START,
      rules,
      observations: [preReset, morningObs],
      trades: [noonTrade],
      events: [],
      tradedDates: ["2026-10-22"],
      deadline: null,
      now: NOW,
      todayLocal: "2026-10-22",
    });
    assert.equal(beforeNewObs.balance.balanceOutdated, true);
    assert.equal(beforeNewObs.daily?.status, "data_incomplete");
    assert.equal(beforeNewObs.overall?.status, "data_incomplete");

    // After recording a newer observation at 13:00Z: outdated notice clears and daily/overall return to normal
    const afternoonObs = o("2026-10-22T13:00:00Z", "10200", "10200");
    const afterNewObs = evaluateChallenge({
      startingBalance: START,
      rules,
      observations: [preReset, morningObs, afternoonObs],
      trades: [noonTrade],
      events: [],
      tradedDates: ["2026-10-22"],
      deadline: null,
      now: NOW,
      todayLocal: "2026-10-22",
    });
    assert.equal(afterNewObs.balance.balanceOutdated, false);
    assert.equal(afterNewObs.balance.cents, c("10200"));
    assert.equal(afterNewObs.profitCents, c("200"));
    assert.equal(afterNewObs.daily?.status, "normal");
    assert.equal(afterNewObs.overall?.status, "normal");
  });
});
