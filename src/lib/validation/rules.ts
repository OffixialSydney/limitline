import { z } from "zod";
import { isValidResetTime, isValidTimeZone } from "../calculations/time.ts";

const amountSpec = { mode: z.enum(["amount", "percent"]), value: z.string().trim().regex(/^\d+(\.\d{1,2})?$/) };

export const profitTargetConfig = z.object(amountSpec).strict();
export const dailyLossConfig = z.object({
  ...amountSpec,
  reference: z.enum(["start_of_day_balance", "start_of_day_equity", "higher_of_balance_equity"]),
  includesOpenPositions: z.boolean(),
  resetTimezone: z.string().nullable().refine((v) => v === null || isValidTimeZone(v), "Invalid timezone"),
  resetTime: z.string().nullable().refine((v) => v === null || isValidResetTime(v), "Invalid reset time"),
}).strict();
export const overallLossConfig = z.object({
  ...amountSpec,
  model: z.enum(["static", "trailing", "eod_trailing", "custom"]),
  measure: z.enum(["balance", "equity"]),
  lockAtStartingBalance: z.boolean(),
  resetTimezone: z.string().nullable().refine((v) => v === null || isValidTimeZone(v), "Invalid timezone"),
  resetTime: z.string().nullable().refine((v) => v === null || isValidResetTime(v), "Invalid reset time"),
}).strict();
export const tradingDaysConfig = z.object({ required: z.number().int().min(1).max(365) }).strict();
export const consistencyConfig = z.object({ maxSingleDayPercent: z.string().regex(/^\d+(\.\d{1,2})?$/) }).strict();

export const RULE_SCHEMAS = {
  profit_target: profitTargetConfig,
  daily_loss: dailyLossConfig,
  overall_loss: overallLossConfig,
  trading_days: tradingDaysConfig,
  consistency: consistencyConfig,
} as const;
export type RuleType = keyof typeof RULE_SCHEMAS;

/** Returns the parsed configuration, or null when a stored value no longer matches its schema. */
export function parseRuleConfig<T extends RuleType>(type: T, value: unknown): z.infer<(typeof RULE_SCHEMAS)[T]> | null {
  const r = RULE_SCHEMAS[type].safeParse(value);
  return r.success ? (r.data as z.infer<(typeof RULE_SCHEMAS)[T]>) : null;
}
