/**
 * Money strategy: every monetary amount inside the calculation engine is an
 * integer number of minor units ("cents", 2 decimal places). Decimal strings
 * from forms/database are parsed with string arithmetic, never with
 * floating-point multiplication. Rounding is half away from zero, applied once,
 * at parse time or when taking a percentage.
 */
export type Cents = number;

const DECIMAL = /^-?\d+(\.\d+)?$/;

export function parseMoney(input: string | number | null | undefined): Cents | null {
  if (input === null || input === undefined) return null;
  const raw = typeof input === "number" ? (Number.isFinite(input) ? input.toFixed(6) : "") : input.trim();
  if (!DECIMAL.test(raw)) return null;
  const negative = raw.startsWith("-");
  const [intPart = "0", fracPart = ""] = raw.replace("-", "").split(".");
  const frac3 = (fracPart + "000").slice(0, 3);
  let cents = Number(intPart) * 100 + Number(frac3.slice(0, 2));
  if (Number(frac3[2]) >= 5) cents += 1; // half away from zero (on magnitude)
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

export function centsToDecimalString(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Percentage given as a decimal string with up to 2 decimals, e.g. "5" or "4.25". */
export function percentToBps(percent: string | number): number | null {
  const raw = typeof percent === "number" ? percent.toFixed(4) : percent.trim();
  if (!DECIMAL.test(raw) || raw.startsWith("-")) return null;
  const [i = "0", f = ""] = raw.split(".");
  const frac3 = (f + "000").slice(0, 3);
  let bps = Number(i) * 100 + Number(frac3.slice(0, 2));
  if (Number(frac3[2]) >= 5) bps += 1;
  return bps;
}

export function percentOf(cents: Cents, percent: string | number): Cents | null {
  const bps = percentToBps(percent);
  if (bps === null) return null;
  const product = Math.abs(cents) * bps;
  if (!Number.isSafeInteger(product)) return null;
  const result = Math.floor((product + 5000) / 10000);
  return cents < 0 ? -result : result;
}

/** Ratio as a percentage with 2 decimals, computed with integers. */
export function ratioPercent(numerator: Cents, denominator: Cents): number | null {
  if (denominator === 0) return null;
  const scaled = Math.abs(numerator) * 10000;
  if (!Number.isSafeInteger(scaled)) return null;
  const value = Math.floor((scaled / Math.abs(denominator)) + 0.5) / 100;
  return (numerator < 0) !== (denominator < 0) ? -value : value;
}
