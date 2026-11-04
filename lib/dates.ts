/**
 * Calendar-day arithmetic on "YYYY-MM-DD" strings, done in UTC so a day is a
 * day and never slides across midnight with the server's clock. The facility's
 * timezone is applied once, in todayIn(), when deciding what "today" is.
 */

export const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** b minus a, in whole days. */
export function diffDays(a: string, b: string): number {
  const ms = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  return Math.round(ms / 86_400_000);
}

/** The Monday on or before the given day. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 Sunday
  const back = dow === 0 ? 6 : dow - 1;
  return addDays(day, -back);
}

export function weekdayShort(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

export function fmtDay(day: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  if (!isISODate(day)) return day;
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function fmtDayLong(day: string): string {
  return fmtDay(day, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function fmtWhen(ms: number, timeZone: string): string {
  try {
    return new Date(ms).toLocaleString("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

/** Flower day for a date: the flip date is day 1. Null before the flip. */
export function flowerDay(flipDate: string, day: string): number | null {
  const n = diffDays(flipDate, day) + 1;
  return n >= 1 ? n : null;
}
