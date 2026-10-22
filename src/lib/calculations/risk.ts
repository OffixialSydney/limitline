/**
 * Hypothetical position sizing. Pure and independent of any account transaction.
 * valuePerPriceUnit = account-currency value of a 1.00 price move for 1 lot/unit.
 * It comes from the user's contract specification; Limitline does not look it up or convert currencies.
 */
import { type Cents } from "./money.ts";

export interface PlanInput {
  entry: number; stop: number; takeProfit: number | null; riskCents: Cents; valuePerPriceUnit: number; lotStep: number | null;
}
export type PlanResult =
  | { ok: false; reason: string }
  | {
      ok: true; direction: "long" | "short"; stopDistance: number; size: number; plannedRiskCents: Cents;
      rewardCents: Cents | null; riskReward: number | null; tpWarning: string | null;
    };

export function planTrade(i: PlanInput): PlanResult {
  const vals = [i.entry, i.stop, i.valuePerPriceUnit];
  if (vals.some((v) => !Number.isFinite(v) || v <= 0)) return { ok: false, reason: "Entry, stop-loss and the value per price unit must be positive numbers." };
  if (i.entry === i.stop) return { ok: false, reason: "The stop-loss cannot equal the entry price." };
  if (i.riskCents <= 0) return { ok: false, reason: "The risk amount must be greater than zero." };
  const direction = i.stop < i.entry ? "long" : "short";
  const stopDistance = Math.abs(i.entry - i.stop);
  const perLotRisk = stopDistance * i.valuePerPriceUnit * 100; // cents per 1 lot
  let size = i.riskCents / perLotRisk;
  if (i.lotStep && i.lotStep > 0) size = Math.floor(size / i.lotStep + 1e-9) * i.lotStep;
  if (size <= 0) return { ok: false, reason: "The risk amount is too small for one lot step at this stop distance." };
  const plannedRiskCents = Math.round(size * perLotRisk);
  let rewardCents: Cents | null = null, riskReward: number | null = null, tpWarning: string | null = null;
  if (i.takeProfit !== null) {
    const valid = direction === "long" ? i.takeProfit > i.entry : i.takeProfit < i.entry;
    if (!Number.isFinite(i.takeProfit) || i.takeProfit <= 0) tpWarning = "The take-profit must be a positive price.";
    else if (!valid) tpWarning = `For a ${direction} trade the take-profit should be ${direction === "long" ? "above" : "below"} the entry.`;
    else {
      rewardCents = Math.round(size * Math.abs(i.takeProfit - i.entry) * i.valuePerPriceUnit * 100);
      riskReward = Math.round((Math.abs(i.takeProfit - i.entry) / stopDistance) * 100) / 100;
    }
  }
  return { ok: true, direction, stopDistance, size, plannedRiskCents, rewardCents, riskReward, tpWarning };
}

export function impactOn(remainingCents: Cents | null, plannedRiskCents: Cents): { afterCents: Cents | null; exceeds: boolean } {
  if (remainingCents === null) return { afterCents: null, exceeds: false };
  return { afterCents: remainingCents - plannedRiskCents, exceeds: plannedRiskCents >= remainingCents };
}
