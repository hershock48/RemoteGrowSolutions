/**
 * Form parsing helpers shared by every server action. All validation is
 * server-side and load-bearing; the browser's `min`/`max` are a convenience.
 */

export const str = (fd: FormData, key: string, max = 2000): string =>
  String(fd.get(key) ?? "")
    .trim()
    .slice(0, max);

/** A number or undefined. Empty is undefined; junk is NaN, which callers reject. */
export function num(fd: FormData, key: string): number | undefined {
  const raw = str(fd, key, 40);
  if (raw === "") return undefined;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export function int(fd: FormData, key: string): number | undefined {
  const n = num(fd, key);
  return n === undefined ? undefined : Number.isNaN(n) ? NaN : Math.round(n);
}

export const emailLooksReal = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/** URL-safe slugs for facility logins: lowercase letters, digits, hyphens. */
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/;

export type Errors = Record<string, string>;

/** Query-string messages the screens render, so every form works without JavaScript. */
/** A redirect target we will honor: a path on this site, never a protocol-relative URL. */
export const safePath = (s: string, fallback: string): string =>
  s.startsWith("/") && !s.startsWith("//") && !/[\u0000-\u001f\\]/.test(s) ? s : fallback;

export function q(params: Record<string, string | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  const out = s.toString();
  return out ? `?${out}` : "";
}
