import "server-only";

/**
 * A small fixed-window counter per key, held in process memory. Lifted from
 * the anchor/devine login routes, where the measurement that earned it was 30
 * unthrottled attempts in 43ms: an ungated door is a sweep, not a guess.
 *
 * Per-instance on serverless, so it slows a guesser rather than stopping one.
 * That is the right size for a passcode gate in front of grow-room readings.
 */

type Bucket = { count: number; resetAt: number };

export function limiter(name: string, { windowMs, max }: { windowMs: number; max: number }) {
  const g = globalThis as typeof globalThis & { __rgsLimiters?: Map<string, Map<string, Bucket>> };
  if (!g.__rgsLimiters) g.__rgsLimiters = new Map();
  if (!g.__rgsLimiters.has(name)) g.__rgsLimiters.set(name, new Map());
  const buckets = g.__rgsLimiters.get(name)!;

  const bucket = (key: string): Bucket => {
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      const fresh = { count: 0, resetAt: now + windowMs };
      buckets.set(key, fresh);
      return fresh;
    }
    return b;
  };

  return {
    allowed: (key: string) => bucket(key).count < max,
    fail: (key: string) => {
      bucket(key).count += 1;
    },
    clear: (key: string) => buckets.delete(key),
    retryAfterSec: (key: string) => Math.max(1, Math.ceil((bucket(key).resetAt - Date.now()) / 1000)),
  };
}

export async function clientKey(): Promise<string> {
  const { headers } = await import("next/headers");
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}
