// Needs dependencies installed (npm install). Run with: npm test
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { challengeFormSchema } from "../../src/lib/validation/challenge.ts";
import { balanceEventSchema, snapshotSchema, tradeFormSchema } from "../../src/lib/validation/records.ts";
import { parseRuleConfig } from "../../src/lib/validation/rules.ts";

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const challenge = {
  name: "Eval 1", firmName: "Firm", accountCurrency: "usd", startingBalance: "10000", startDate: "2026-10-01", currentPhase: "phase_1",
  targetMode: "percent", targetValue: "10", deadline: "", minTradingDays: "4",
  dailyMode: "percent", dailyValue: "5", dailyReference: "start_of_day_balance", dailyIncludesOpen: false, resetTimezone: "America/New_York", resetTime: "17:00",
  overallMode: "percent", overallValue: "10", drawdownModel: "static", overallMeasure: "balance", lockAtStart: false,
  consistencyPercent: "", notes: "", ruleSource: "", ruleVerifiedOn: "",
};

describe("challenge form", () => {
  it("accepts a complete form and normalises blanks and currency", () => {
    const r = challengeFormSchema.safeParse(challenge);
    assert.ok(r.success);
    if (r.success) { assert.equal(r.data.accountCurrency, "USD"); assert.equal(r.data.deadline, undefined); }
  });
  it("rejects non-positive or malformed balances", () => {
    assert.equal(challengeFormSchema.safeParse({ ...challenge, startingBalance: "0" }).success, false);
    assert.equal(challengeFormSchema.safeParse({ ...challenge, startingBalance: "10,000" }).success, false);
  });
  it("rejects percentages over 100 and deadlines before the start", () => {
    assert.equal(challengeFormSchema.safeParse({ ...challenge, dailyValue: "150" }).success, false);
    assert.equal(challengeFormSchema.safeParse({ ...challenge, deadline: "2026-09-01" }).success, false);
  });
  it("rejects an invalid reset timezone or time", () => {
    assert.equal(challengeFormSchema.safeParse({ ...challenge, resetTimezone: "Mars/Phobos" }).success, false);
    assert.equal(challengeFormSchema.safeParse({ ...challenge, resetTime: "25:00" }).success, false);
  });
  it("allows a missing reset timezone (the engine then reports data incomplete)", () => {
    assert.ok(challengeFormSchema.safeParse({ ...challenge, resetTimezone: "", resetTime: "" }).success);
  });
});

describe("records", () => {
  it("rejects a trade that exits before it enters", () => {
    const r = tradeFormSchema.safeParse({ challengeId: uuid, instrument: "EURUSD", direction: "long", entryTime: "2026-10-02T10:00", exitTime: "2026-10-02T09:00" });
    assert.equal(r.success, false);
  });
  it("accepts a minimal trade", () => {
    assert.ok(tradeFormSchema.safeParse({ challengeId: uuid, instrument: "EURUSD", direction: "short", entryTime: "2026-10-02T10:00" }).success);
  });
  it("only adjustments may be negative", () => {
    const e = { challengeId: uuid, currency: "USD", occurredAt: "2026-10-02T10:00" };
    assert.equal(balanceEventSchema.safeParse({ ...e, eventType: "deposit", amount: "-5" }).success, false);
    assert.ok(balanceEventSchema.safeParse({ ...e, eventType: "adjustment", amount: "-5" }).success);
  });
  it("an observation needs balance or equity", () => {
    assert.equal(snapshotSchema.safeParse({ challengeId: uuid, observedAt: "2026-10-02T10:00" }).success, false);
    assert.ok(snapshotSchema.safeParse({ challengeId: uuid, observedAt: "2026-10-02T10:00", equity: "9900.50" }).success);
  });
});

describe("rule configuration", () => {
  it("rejects unknown keys and malformed values", () => {
    assert.equal(parseRuleConfig("profit_target", { mode: "amount", value: "100", extra: 1 }), null);
    assert.equal(parseRuleConfig("overall_loss", { mode: "amount", value: "abc" }), null);
  });
  it("round-trips a valid configuration", () => {
    assert.deepEqual(parseRuleConfig("trading_days", { required: 4 }), { required: 4 });
  });
});
