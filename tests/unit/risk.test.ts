import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { impactOn, planTrade } from "../../src/lib/calculations/risk.ts";

const base = { entry: 1.1, stop: 1.095, takeProfit: 1.11, riskCents: 10000, valuePerPriceUnit: 100000, lotStep: null };

describe("planTrade", () => {
  it("sizes a long trade: $100 risk, 50 pip stop, $100k per 1.00 move", () => {
    const r = planTrade(base);
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.direction, "long");
      assert.equal(+r.size.toFixed(4), 0.2);
      assert.equal(r.plannedRiskCents, 10000);
      assert.equal(r.riskReward, 2);
      assert.equal(r.rewardCents, 20000);
    }
  });
  it("detects shorts", () => {
    const r = planTrade({ ...base, entry: 1.095, stop: 1.1, takeProfit: 1.085 });
    assert.ok(r.ok && r.direction === "short" && r.riskReward === 2);
  });
  it("rounds the size down to the lot step and reports the real risk", () => {
    const r = planTrade({ ...base, lotStep: 0.15 });
    assert.ok(r.ok);
    if (r.ok) { assert.equal(+r.size.toFixed(2), 0.15); assert.equal(r.plannedRiskCents, 7500); }
  });
  it("rejects invalid inputs instead of guessing", () => {
    assert.equal(planTrade({ ...base, stop: base.entry }).ok, false);
    assert.equal(planTrade({ ...base, riskCents: 0 }).ok, false);
    assert.equal(planTrade({ ...base, valuePerPriceUnit: 0 }).ok, false);
    assert.equal(planTrade({ ...base, riskCents: 1, lotStep: 1 }).ok, false);
  });
  it("warns on a take-profit on the wrong side", () => {
    const r = planTrade({ ...base, takeProfit: 1.09 });
    assert.ok(r.ok && r.tpWarning !== null && r.riskReward === null);
  });
});

describe("impactOn", () => {
  it("subtracts planned risk from the remaining allowance", () => assert.deepEqual(impactOn(30000, 10000), { afterCents: 20000, exceeds: false }));
  it("flags a trade that would use all remaining room", () => assert.equal(impactOn(10000, 10000).exceeds, true));
  it("is unknown when the allowance is unknown", () => assert.deepEqual(impactOn(null, 10000), { afterCents: null, exceeds: false }));
});
