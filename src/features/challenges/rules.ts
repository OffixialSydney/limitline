import type { ChallengeFormValues } from "@/lib/validation/challenge";
import type { RuleType } from "@/lib/validation/rules";

/** Turns validated form values into rule rows. A blank value means the rule is not configured and is removed. */
export function buildRules(v: ChallengeFormValues): Partial<Record<RuleType, unknown>> {
  const out: Partial<Record<RuleType, unknown>> = {};
  if (v.targetValue) out.profit_target = { mode: v.targetMode, value: v.targetValue };
  if (v.dailyValue) {
    out.daily_loss = {
      mode: v.dailyMode, value: v.dailyValue, reference: v.dailyReference, includesOpenPositions: v.dailyIncludesOpen,
      resetTimezone: v.resetTimezone ?? null, resetTime: v.resetTime ?? null,
    };
  }
  if (v.overallValue) {
    out.overall_loss = {
      mode: v.overallMode, value: v.overallValue, model: v.drawdownModel, measure: v.overallMeasure,
      lockAtStartingBalance: v.lockAtStart, resetTimezone: v.resetTimezone ?? null, resetTime: v.resetTime ?? null,
    };
  }
  if (v.minTradingDays && Number(v.minTradingDays) > 0) out.trading_days = { required: Number(v.minTradingDays) };
  if (v.consistencyPercent) out.consistency = { maxSingleDayPercent: v.consistencyPercent };
  return out;
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, val]) => `${JSON.stringify(k)}:${canonical(val)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
