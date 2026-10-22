/** Time-zone helpers built on Intl only (no dependencies). */

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isValidResetTime(value: string | null | undefined): value is string {
  return !!value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

interface Wall { y: number; m: number; d: number; h: number; mi: number; s: number }

function wallParts(date: Date, tz: string): Wall {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

/** Offset (ms) of `tz` from UTC at the given instant. */
export function tzOffsetMs(date: Date, tz: string): number {
  const w = wallParts(date, tz);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Local calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function localDate(date: Date, tz: string): string {
  const w = wallParts(date, tz);
  return `${w.y}-${String(w.m).padStart(2, "0")}-${String(w.d).padStart(2, "0")}`;
}

/**
 * Converts a wall-clock time in `tz` to a UTC instant. Handles DST: if the wall
 * time does not exist (spring-forward gap) the instant just after the gap is used;
 * if it occurs twice (fall-back) the earlier occurrence is used.
 */
export function wallTimeToUtc(dateStr: string, hhmm: string, tz: string): Date {
  const [y = 0, m = 1, d = 1] = dateStr.split("-").map(Number);
  const [h = 0, mi = 0] = hhmm.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, h, mi, 0);
  const candidates = new Set<number>();
  for (const probe of [naive - 86400000, naive, naive + 86400000]) {
    const off = tzOffsetMs(new Date(probe), tz);
    candidates.add(naive - off);
  }
  const valid = [...candidates]
    .filter((t) => {
      const w = wallParts(new Date(t), tz);
      return w.y === y && w.m === m && w.d === d && w.h === h && w.mi === mi;
    })
    .sort((a, b) => a - b);
  if (valid.length > 0) return new Date(valid[0]!);
  // Nonexistent wall time (gap): shift forward by the gap size.
  const offBefore = tzOffsetMs(new Date(naive - 86400000), tz);
  return new Date(naive - offBefore);
}

export function addDays(dateStr: string, days: number): string {
  const [y = 0, m = 1, d = 1] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** The most recent daily reset instant at or before `now`. */
export function latestResetInstant(now: Date, tz: string, resetTime: string): Date {
  const today = localDate(now, tz);
  const todays = wallTimeToUtc(today, resetTime, tz);
  if (todays.getTime() <= now.getTime()) return todays;
  return wallTimeToUtc(addDays(today, -1), resetTime, tz);
}

/** Trading-day key for an instant: the date of the reset period it falls into. */
export function periodKey(instant: Date, tz: string, resetTime: string): string {
  const reset = latestResetInstant(instant, tz, resetTime);
  return localDate(reset, tz);
}
