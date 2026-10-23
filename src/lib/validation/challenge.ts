import { z } from "zod";
import { currencyCode, isoDate, optionalOf, optionalText, positiveMoney } from "./common.ts";
import { isValidResetTime, isValidTimeZone } from "../calculations/time.ts";

const amountValue = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Use a positive number with up to 2 decimals (no commas)");

export const PHASES = [
  ["phase_1", "Phase 1"],
  ["phase_2", "Phase 2"],
  ["phase_3", "Phase 3"],
  ["funded", "Funded"],
  ["other", "Other"],
] as const;

export const challengeFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter an account nickname").max(80),
    firmName: z.string().trim().min(1, "Enter the prop firm name").max(80),
    accountCurrency: currencyCode,
    startingBalance: positiveMoney("Starting balance"),
    startDate: isoDate,
    currentPhase: z.enum(["phase_1", "phase_2", "phase_3", "funded", "other"]),

    targetMode: z.enum(["amount", "percent"]),
    targetValue: optionalOf(amountValue),
    deadline: optionalOf(isoDate),
    minTradingDays: optionalOf(z.string().trim().regex(/^\d{1,3}$/, "Use a whole number")),

    dailyMode: z.enum(["amount", "percent"]),
    dailyValue: optionalOf(amountValue),
    dailyReference: z.enum(["start_of_day_balance", "start_of_day_equity", "higher_of_balance_equity"]),
    dailyIncludesOpen: z.boolean().optional().default(false),
    resetTimezone: optionalOf(z.string().refine(isValidTimeZone, "Choose a valid timezone")),
    resetTime: optionalOf(
      z
        .string()
        .trim()
        .transform((v) => (/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(v) ? v.slice(0, 5) : v))
        .refine(isValidResetTime, "Use HH:MM, 24-hour")
    ),

    overallMode: z.enum(["amount", "percent"]),
    overallValue: optionalOf(amountValue),
    drawdownModel: z.enum(["static", "trailing", "eod_trailing", "custom"]),
    overallMeasure: z.enum(["balance", "equity"]),
    lockAtStart: z.boolean().optional().default(false),

    consistencyPercent: optionalOf(
      z
        .string()
        .trim()
        .regex(/^\d+(\.\d{1,2})?$/, "Use a percentage")
        .refine((v) => Number(v) > 0 && Number(v) <= 100, "Use a value between 0 and 100")
    ),
    notes: optionalText(2000),
    ruleSource: optionalText(500),
    ruleVerifiedOn: optionalOf(isoDate),
  })
  .superRefine((v, ctx) => {
    if (v.deadline && v.deadline < v.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["deadline"],
        message: "The deadline must be on or after the start date",
      });
    }
    for (const [mode, value, path] of [
      [v.targetMode, v.targetValue, "targetValue"],
      [v.dailyMode, v.dailyValue, "dailyValue"],
      [v.overallMode, v.overallValue, "overallValue"],
    ] as const) {
      if (value && mode === "percent" && Number(value) > 100) {
        ctx.addIssue({ code: "custom", path: [path], message: "A percentage cannot exceed 100" });
      }
      if (value && Number(value) <= 0) {
        ctx.addIssue({ code: "custom", path: [path], message: "Must be greater than zero" });
      }
    }
  });

export type ChallengeFormInput = z.input<typeof challengeFormSchema>;
export type ChallengeFormValues = z.output<typeof challengeFormSchema>;
