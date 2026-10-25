import { z } from "zod";
import { parseMoney, type Cents } from "../calculations/money.ts";
import { toLocalInputValue } from "../formatting/index.ts";
import type { TradeRow } from "../../types/db.ts";
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

const cleanOpt = (v: string | number | null | undefined): string =>
  v === null || v === undefined ? "" : String(v);

/**
 * Normalizes a TradeFormInput object so every form field has a defined string value.
 * Nullable or missing fields remain blank ("") and are never replaced with zero or fabricated defaults.
 */
export function normalizeTradeFormDefaults(defaults: Partial<TradeFormInput>): TradeFormInput {
  return {
    ...(defaults.id ? { id: defaults.id } : {}),
    challengeId: cleanOpt(defaults.challengeId),
    instrument: cleanOpt(defaults.instrument),
    direction: defaults.direction === "short" ? "short" : "long",
    entryTime: cleanOpt(defaults.entryTime),
    exitTime: cleanOpt(defaults.exitTime),
    entryPrice: cleanOpt(defaults.entryPrice),
    exitPrice: cleanOpt(defaults.exitPrice),
    stopLoss: cleanOpt(defaults.stopLoss),
    takeProfit: cleanOpt(defaults.takeProfit),
    positionSize: cleanOpt(defaults.positionSize),
    grossPnl: cleanOpt(defaults.grossPnl),
    costs: cleanOpt(defaults.costs),
    netPnl: cleanOpt(defaults.netPnl),
    notes: cleanOpt(defaults.notes),
  };
}

/**
 * Maps a persisted database TradeRow to TradeFormInput for the Edit trade form.
 * Preserves explicit zero values ("0" / "0.00") while keeping null fields blank ("").
 */
export function tradeRowToFormInput(t: TradeRow, timeZone: string): TradeFormInput {
  return normalizeTradeFormDefaults({
    id: t.id,
    challengeId: t.challenge_id,
    instrument: t.instrument,
    direction: t.direction,
    entryTime: toLocalInputValue(t.entry_time, timeZone),
    exitTime: t.exit_time ? toLocalInputValue(t.exit_time, timeZone) : "",
    entryPrice: cleanOpt(t.entry_price),
    exitPrice: cleanOpt(t.exit_price),
    stopLoss: cleanOpt(t.stop_loss),
    takeProfit: cleanOpt(t.take_profit),
    positionSize: cleanOpt(t.position_size),
    grossPnl: cleanOpt(t.gross_pnl),
    costs: cleanOpt(t.costs),
    netPnl: cleanOpt(t.net_pnl),
    notes: t.notes ?? "",
  });
}

/**
 * Resolves the saved net P&L in integer cents for a trade:
 * - If netPnl is explicitly entered (including "0" or "0.00"), uses netPnl.
 * - If netPnl is blank and grossPnl is entered, uses grossPnl minus costs (defaulting missing costs to 0).
 * - If both netPnl and grossPnl are blank, returns null (never fabricates a zero result).
 */
export function resolveTradeNetPnlCents(input: {
  grossPnl?: string | null | undefined;
  costs?: string | null | undefined;
  netPnl?: string | null | undefined;
}): Cents | null {
  const gross = parseMoney(input.grossPnl ?? null);
  const costs = parseMoney(input.costs ?? null);
  const netInput = parseMoney(input.netPnl ?? null);
  return netInput ?? (gross !== null ? gross - (costs ?? 0) : null);
}

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
