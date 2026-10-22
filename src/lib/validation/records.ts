import { z } from "zod";
import { currencyCode, isoDate, moneyString, optionalOf, optionalText, priceString, uuid } from "./common.ts";

const dateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a date and time");
const posSize = z.string().trim().regex(/^\d+(\.\d{1,4})?$/, "Use a positive number with up to 4 decimals").refine((v) => Number(v) > 0, "Must be greater than zero");
const nonNegMoney = moneyString("Costs").refine((v) => Number(v) >= 0, "Costs cannot be negative");

export const tradeFormSchema = z.object({
  id: optionalOf(uuid),
  challengeId: uuid,
  instrument: z.string().trim().min(1, "Enter an instrument").max(40),
  direction: z.enum(["long", "short"]),
  entryTime: dateTime,
  exitTime: optionalOf(dateTime),
  entryPrice: optionalOf(priceString("Entry price")),
  exitPrice: optionalOf(priceString("Exit price")),
  stopLoss: optionalOf(priceString("Stop-loss")),
  takeProfit: optionalOf(priceString("Take-profit")),
  positionSize: optionalOf(posSize),
  grossPnl: optionalOf(moneyString("Gross result")),
  costs: optionalOf(nonNegMoney),
  netPnl: optionalOf(moneyString("Net result")),
  notes: optionalText(2000),
}).superRefine((v, ctx) => {
  if (v.exitTime && v.exitTime < v.entryTime) ctx.addIssue({ code: "custom", path: ["exitTime"], message: "The exit must be after the entry" });
});
export type TradeFormInput = z.input<typeof tradeFormSchema>;

export const balanceEventSchema = z.object({
  challengeId: uuid,
  eventType: z.enum(["deposit", "withdrawal", "fee", "credit", "adjustment"]),
  amount: moneyString("Amount").refine((v) => Number(v) !== 0, "Amount cannot be zero"),
  currency: currencyCode,
  occurredAt: dateTime,
  notes: optionalText(1000),
}).superRefine((v, ctx) => {
  if (v.eventType !== "adjustment" && Number(v.amount) <= 0) {
    ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter a positive amount. Only adjustments can be negative." });
  }
});
export type BalanceEventInput = z.input<typeof balanceEventSchema>;

export const snapshotSchema = z.object({
  challengeId: uuid,
  balance: optionalOf(moneyString("Balance")),
  equity: optionalOf(moneyString("Equity")),
  observedAt: dateTime,
  notes: optionalText(1000),
}).superRefine((v, ctx) => {
  if (!v.balance && !v.equity) ctx.addIssue({ code: "custom", path: ["balance"], message: "Enter a balance, an equity value, or both" });
});
export type SnapshotInput = z.input<typeof snapshotSchema>;

export const tradingDaySchema = z.object({ challengeId: uuid, tradingDate: isoDate });

export const LOCALES = ["en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "pt-BR", "ja-JP"] as const;
export const profileSchema = z.object({
  displayName: optionalText(80),
  preferredCurrency: currencyCode,
  timezone: z.string().min(1, "Choose a timezone"),
  locale: z.enum(LOCALES),
  warningThresholdPct: z.coerce.number().int().min(1, "Use 1 to 99").max(99, "Use 1 to 99"),
  staleAfterHours: z.coerce.number().int().min(1, "Use 1 to 720").max(720, "Use 1 to 720"),
  notifyInApp: z.boolean(),
});
export type ProfileInput = z.input<typeof profileSchema>;
