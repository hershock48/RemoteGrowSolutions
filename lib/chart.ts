/**
 * Chart arithmetic, pure. Domains, nice ticks and pixel scales for the SVG
 * line chart in components/LineChart.tsx. Kept out of the component so the
 * numbers can be tested without rendering anything.
 */

export type Pt = { x: number; y: number };
export type Series = {
  name: string;
  points: Pt[];
  /** "primary" | "secondary" | "third" | "fourth": which palette slot draws it. */
  slot?: "primary" | "secondary" | "third" | "fourth";
  /** Points outside this band are drawn as alert dots. */
  band?: [number, number];
  /** Points above this value are drawn as alert dots. */
  ceiling?: number;
  dots?: boolean;
};

export type Domain = [number, number];

/** A step of 1, 2 or 5 times a power of ten that yields about `want` ticks. */
export function niceStep(range: number, want = 4): number {
  if (!(range > 0)) return 1;
  const raw = range / want;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  const m = r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10;
  return m * mag;
}

export function ticks([lo, hi]: Domain, want = 4): number[] {
  const step = niceStep(hi - lo, want);
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(round(v));
  return out;
}

const round = (v: number) => Math.round(v * 1e6) / 1e6;

/** The y domain: every value plus the band and ceiling, padded, floored at zero when nothing is negative. */
export function yDomain(series: Series[], extra: number[] = [], pad = 0.12): Domain {
  const ys = series.flatMap((s) => s.points.map((p) => p.y)).concat(extra, ...series.map((s) => (s.band ? s.band : [])), ...series.map((s) => (s.ceiling !== undefined ? [s.ceiling] : [])));
  if (!ys.length) return [0, 1];
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (hi === lo) {
    lo -= 1;
    hi += 1;
  }
  const span = hi - lo;
  lo -= span * pad;
  hi += span * pad;
  if (lo < 0 && Math.min(...ys) >= 0) lo = 0;
  return [lo, hi];
}

export function xDomain(series: Series[], extra: number[] = []): Domain {
  const xs = series.flatMap((s) => s.points.map((p) => p.x)).concat(extra);
  if (!xs.length) return [0, 1];
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return hi === lo ? [lo - 1, hi + 1] : [lo, hi];
}

export type Scale = (v: number) => number;

export function scale([lo, hi]: Domain, [a, b]: [number, number]): Scale {
  const k = (b - a) / (hi - lo || 1);
  return (v) => a + (v - lo) * k;
}

export const pathOf = (pts: Pt[], sx: Scale, sy: Scale): string =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");

export function isOutside(s: Series, p: Pt): boolean {
  if (s.band && (p.y < s.band[0] || p.y > s.band[1])) return true;
  if (s.ceiling !== undefined && p.y > s.ceiling) return true;
  return false;
}

export const fmtTick = (v: number): string => (Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));
