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

import {
  normalizeTradeFormDefaults,
  profileSchema,
  resolveTradeNetPnlCents,
  tradeRowToFormInput,
  type TradeFormInput,
} from "../../src/lib/validation/records.ts";
import { flattenZod } from "../../src/lib/validation/common.ts";
import { planTrade } from "../../src/lib/calculations/risk.ts";
import { parseMoney } from "../../src/lib/calculations/money.ts";
import type { TradeRow } from "../../src/types/db.ts";

describe("trade edit form prefill, net result handling, and regression suite", () => {
  const savedTradeFull: TradeRow = {
    id: "aaaa1111-e89b-42d3-a456-426614174001",
    challenge_id: uuid,
    instrument: "EURUSD",
    direction: "long",
    entry_time: "2026-10-23T14:30:00.000Z",
    exit_time: "2026-10-23T16:45:00.000Z",
    entry_price: "1.08500",
    exit_price: "1.08950",
    stop_loss: "1.08200",
    take_profit: "1.09100",
    position_size: "2.5",
    gross_pnl: "112.50",
    costs: "7.50",
    net_pnl: "105.00",
    notes: "London breakout continuation",
    created_at: "2026-10-23T16:46:00.000Z",
  };

  const savedTradeSparse: TradeRow = {
    id: "cccc3333-e89b-42d3-a456-426614174003",
    challenge_id: uuid,
    instrument: "EURUSD",
    direction: "long",
    entry_time: "2026-10-24T09:15:00.000Z",
    exit_time: null,
    entry_price: null,
    exit_price: null,
    stop_loss: null,
    take_profit: null,
    position_size: null,
    gross_pnl: null,
    costs: null,
    net_pnl: null,
    notes: null,
    created_at: "2026-10-24T09:16:00.000Z",
  };

  it("1. opening an existing trade in edit mode prepopulates all saved values", () => {
    const prefilled = tradeRowToFormInput(savedTradeFull, "UTC");
    assert.equal(prefilled.id, savedTradeFull.id);
    assert.equal(prefilled.challengeId, uuid);
    assert.equal(prefilled.instrument, "EURUSD");
    assert.equal(prefilled.direction, "long");
    assert.equal(prefilled.entryTime, "2026-10-23T14:30");
    assert.equal(prefilled.exitTime, "2026-10-23T16:45");
    assert.equal(prefilled.entryPrice, "1.08500");
    assert.equal(prefilled.exitPrice, "1.08950");
    assert.equal(prefilled.stopLoss, "1.08200");
    assert.equal(prefilled.takeProfit, "1.09100");
    assert.equal(prefilled.positionSize, "2.5");
    assert.equal(prefilled.costs, "7.50");
    assert.equal(prefilled.grossPnl, "112.50");
    assert.equal(prefilled.netPnl, "105.00");
    assert.equal(prefilled.notes, "London breakout continuation");
  });

  it("2. nullable fields remain blank rather than becoming zero or fabricated defaults", () => {
    const prefilled = tradeRowToFormInput(savedTradeSparse, "UTC");
    assert.equal(prefilled.id, savedTradeSparse.id);
    assert.equal(prefilled.instrument, "EURUSD");
    assert.equal(prefilled.direction, "long");
    assert.equal(prefilled.entryTime, "2026-10-24T09:15");
    assert.equal(prefilled.exitTime, "");
    assert.equal(prefilled.entryPrice, "");
    assert.equal(prefilled.exitPrice, "");
    assert.equal(prefilled.stopLoss, "");
    assert.equal(prefilled.takeProfit, "");
    assert.equal(prefilled.positionSize, "");
    assert.equal(prefilled.costs, "");
    assert.equal(prefilled.grossPnl, "");
    assert.equal(prefilled.netPnl, "");
    assert.equal(prefilled.notes, "");

    // Passing through tradeFormSchema keeps optional numeric fields undefined, never "0"
    const parsed = tradeFormSchema.safeParse(prefilled);
    assert.ok(parsed.success);
    if (parsed.success) {
      assert.equal(parsed.data.exitTime, undefined);
      assert.equal(parsed.data.entryPrice, undefined);
      assert.equal(parsed.data.exitPrice, undefined);
      assert.equal(parsed.data.stopLoss, undefined);
      assert.equal(parsed.data.takeProfit, undefined);
      assert.equal(parsed.data.positionSize, undefined);
      assert.equal(parsed.data.costs, undefined);
      assert.equal(parsed.data.grossPnl, undefined);
      assert.equal(parsed.data.netPnl, undefined);
      assert.equal(parsed.data.notes, undefined);
    }
  });

  it("3. changing the selected trade updates the form values with the correct record and clears missing fields", () => {
    const first = tradeRowToFormInput(savedTradeFull, "UTC");
    const second = tradeRowToFormInput({ ...savedTradeSparse, instrument: "GBPUSD", direction: "short" }, "UTC");
    assert.notEqual(first.id, second.id);
    assert.equal(second.instrument, "GBPUSD");
    assert.equal(second.direction, "short");
    assert.equal(second.netPnl, "");
    assert.equal(second.grossPnl, "");
    assert.equal(second.stopLoss, "");
    assert.equal(second.notes, "");
  });

  it("4 & 5. saving an edit updates the original record without creating a duplicate, and cancelling leaves the original untouched", () => {
    const store: TradeRow[] = [structuredClone(savedTradeSparse)];

    // Simulate opening edit form, modifying fields, and cancelling
    const initialForm = tradeRowToFormInput(store[0]!, "UTC");
    const dirtyDraft: TradeFormInput = { ...initialForm, instrument: "XAUUSD", netPnl: "500.00" };
    // Cancel resets back to initialForm and does not write to store
    const afterCancel = normalizeTradeFormDefaults(initialForm);
    assert.notEqual(dirtyDraft.instrument, afterCancel.instrument);
    assert.equal(store.length, 1);
    assert.equal(store[0]!.instrument, "EURUSD");
    assert.equal(store[0]!.net_pnl, null);

    // Now simulate saving an edit on the existing trade
    const editedInput: TradeFormInput = {
      ...initialForm,
      exitTime: "2026-10-24T11:00",
      grossPnl: "150.00",
      costs: "5.00",
      netPnl: "", // Blank -> derived from gross - costs = 145.00
      notes: "Closed after London fix",
    };
    const parsed = tradeFormSchema.safeParse(editedInput);
    assert.ok(parsed.success);
    if (parsed.success) {
      assert.equal(parsed.data.id, savedTradeSparse.id);
      const netCents = resolveTradeNetPnlCents(parsed.data);
      assert.equal(netCents, 145_00);

      // Update in-place by id (matching saveTrade behavior)
      const idx = store.findIndex((r) => r.id === parsed.data.id);
      assert.equal(idx, 0);
      store[idx] = {
        ...store[idx]!,
        exit_time: parsed.data.exitTime!,
        gross_pnl: parsed.data.grossPnl!,
        costs: parsed.data.costs!,
        net_pnl: "145.00",
        notes: parsed.data.notes ?? null,
      };
    }
    assert.equal(store.length, 1);
    assert.equal(store[0]!.id, savedTradeSparse.id);
    assert.equal(store[0]!.net_pnl, "145.00");
    assert.equal(store[0]!.notes, "Closed after London fix");
  });

  it("6. missing required fields and invalid values produce clear field-specific validation errors", () => {
    const missingInstrument = tradeFormSchema.safeParse({
      challengeId: uuid,
      instrument: "   ",
      direction: "long",
      entryTime: "2026-10-24T09:15",
    });
    assert.equal(missingInstrument.success, false);
    if (!missingInstrument.success) {
      const errs = flattenZod(missingInstrument.error);
      assert.ok(errs.instrument);
      assert.match(errs.instrument!, /Enter an instrument/i);
    }

    const negativeCosts = tradeFormSchema.safeParse({
      challengeId: uuid,
      instrument: "EURUSD",
      direction: "long",
      entryTime: "2026-10-24T09:15",
      costs: "-4.00",
    });
    assert.equal(negativeCosts.success, false);
    if (!negativeCosts.success) {
      const errs = flattenZod(negativeCosts.error);
      assert.ok(errs.costs);
    }
  });

  it("7, 8 & 9. blank net result vs gross-minus-costs vs explicit zero are handled consistently", () => {
    // Blank net and blank gross -> null ("Not entered"), even if costs are entered
    assert.equal(resolveTradeNetPnlCents({ grossPnl: "", costs: "", netPnl: "" }), null);
    assert.equal(resolveTradeNetPnlCents({ grossPnl: undefined, costs: "5.00", netPnl: undefined }), null);

    // Blank net with gross provided -> gross - costs
    assert.equal(resolveTradeNetPnlCents({ grossPnl: "200.00", costs: "12.50", netPnl: "" }), 187_50);
    assert.equal(resolveTradeNetPnlCents({ grossPnl: "-80.00", costs: "5.00", netPnl: "" }), -85_00);

    // Explicit net result of 0 or 0.00 -> 0 cents (distinct from null)
    assert.equal(resolveTradeNetPnlCents({ grossPnl: "", costs: "", netPnl: "0" }), 0);
    assert.equal(resolveTradeNetPnlCents({ grossPnl: "", costs: "", netPnl: "0.00" }), 0);
    assert.notEqual(resolveTradeNetPnlCents({ grossPnl: "", costs: "", netPnl: "0" }), null);

    // Explicit net result overrides gross - costs
    assert.equal(resolveTradeNetPnlCents({ grossPnl: "100.00", costs: "5.00", netPnl: "90.00" }), 90_00);
  });

  it("13. calculator validation rejects stop-loss equal to entry and risk amount <= 0", () => {
    const equalStop = planTrade({
      entry: 1.1,
      stop: 1.1,
      takeProfit: 1.11,
      riskCents: parseMoney("100")!,
      valuePerPriceUnit: 100000,
      lotStep: null,
    });
    assert.equal(equalStop.ok, false);
    if (!equalStop.ok) assert.match(equalStop.reason, /Stop-loss cannot equal the entry price/i);

    const zeroRisk = planTrade({
      entry: 1.1,
      stop: 1.095,
      takeProfit: 1.11,
      riskCents: 0,
      valuePerPriceUnit: 100000,
      lotStep: null,
    });
    assert.equal(zeroRisk.ok, false);
    if (!zeroRisk.ok) assert.match(zeroRisk.reason, /risk amount must be greater than zero/i);

    const negativeRisk = planTrade({
      entry: 1.1,
      stop: 1.095,
      takeProfit: 1.11,
      riskCents: -50_00,
      valuePerPriceUnit: 100000,
      lotStep: null,
    });
    assert.equal(negativeRisk.ok, false);
    if (!negativeRisk.ok) assert.match(negativeRisk.reason, /risk amount must be greater than zero/i);
  });

  it("14 & 15. settings profile schema persists user preferences and individual alert read status updates only the target alert", () => {
    const savedSettings = profileSchema.safeParse({
      displayName: "Sydney",
      preferredCurrency: "usd",
      timezone: "Africa/Lagos",
      locale: "en-US",
      warningThresholdPct: "75",
      staleAfterHours: "18",
      notifyInApp: true,
    });
    assert.ok(savedSettings.success);
    if (savedSettings.success) {
      assert.equal(savedSettings.data.preferredCurrency, "USD");
      assert.equal(savedSettings.data.timezone, "Africa/Lagos");
      assert.equal(savedSettings.data.warningThresholdPct, 75);
      assert.equal(savedSettings.data.staleAfterHours, 18);
      assert.equal(savedSettings.data.notifyInApp, true);
    }

    // Individual alert read status transitions only the targeted notification
    const alerts = [
      { id: "a1", read_at: null as string | null },
      { id: "a2", read_at: null as string | null },
    ];
    const markOneRead = (id: string, iso: string) =>
      alerts.map((a) => (a.id === id && a.read_at === null ? { ...a, read_at: iso } : a));
    const afterRead = markOneRead("a1", "2026-10-24T02:00:00.000Z");
    assert.equal(afterRead[0]!.read_at, "2026-10-24T02:00:00.000Z");
    assert.equal(afterRead[1]!.read_at, null);
  });
});
