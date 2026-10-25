import { parseMoney, type Cents } from "../calculations/money.ts";

export interface FormatPrefs { locale: string; timeZone: string }
export const DEFAULT_PREFS: FormatPrefs = { locale: "en-US", timeZone: "UTC" };

export function formatMoney(cents: Cents | null | undefined, currency: string, locale = "en-US"): string {
  if (cents === null || cents === undefined) return "-";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}
export const formatMoneyString = (v: string | number | null | undefined, currency: string, locale = "en-US") =>
  formatMoney(parseMoney(v), currency, locale);

export function formatPercent(value: number | null | undefined, locale = "en-US", digits = 1): string {
  if (value === null || value === undefined) return "-";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)}%`;
}

export function formatNumber(value: number | string | null | undefined, locale = "en-US", digits = 8): string {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Number(value));
}

const isPlainDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function formatDateTimeInZone(value: Date | string | null | undefined, locale: string, timeZone: string): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(d);
  }
}

export function formatDateTime(value: Date | string | null | undefined, prefs: FormatPrefs): string {
  return formatDateTimeInZone(value, prefs.locale, prefs.timeZone);
}

export function formatDate(value: string | Date | null | undefined, prefs: FormatPrefs): string {
  if (!value) return "-";
  // Plain calendar dates (YYYY-MM-DD) must not shift with the viewer's timezone.
  const plain = isPlainDate(value);
  const d = plain ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(prefs.locale, { timeZone: plain ? "UTC" : prefs.timeZone, dateStyle: "medium" }).format(d);
}

export function formatRelative(value: Date | string | null | undefined, now = new Date()): string {
  if (!value) return "Never";
  const d = typeof value === "string" ? new Date(value) : value;
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

/** Value for <input type="datetime-local"> in the given timezone. */
export function toLocalInputValue(value: Date | string | null | undefined, timeZone: string): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  let p: Intl.DateTimeFormatPart[];
  try {
    p = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  } catch {
    p = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  }
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}
