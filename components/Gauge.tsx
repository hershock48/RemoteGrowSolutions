import type { Range } from "@/lib/types";

/**
 * One reading as a ring, the way Aroya's room view shows a room at a glance
 * (Jake named their customer interface as the reference, 2026-11-16): the
 * number in the middle, its name above, its setpoint under it.
 *
 * What is ours and not theirs: the ring's COLOUR IS THE STATUS. Green inside
 * the room's own setpoint, amber outside it, grey with no reading or no
 * setpoint. The faint arc is the setpoint band, so how far a reading sits
 * from its range can be read from the ring before the number is.
 *
 * The scale puts the band in the middle third: a reading at the low setpoint
 * fills a third of the ring, at the high setpoint two thirds. A ceiling
 * (runoff EC) puts the band in the first two thirds. Server-rendered SVG.
 */

const R = 30;
const C = 2 * Math.PI * R;

export type GaugeProps = { label: string; unit: string; value?: number; range?: Range; ceiling?: number; digits?: number };

export function gaugeState({ value, range, ceiling }: Pick<GaugeProps, "value" | "range" | "ceiling">): { tone: "ok" | "warn" | "none" | "miss"; fill: number; band: [number, number] | null } {
  if (value === undefined || !Number.isFinite(value)) return { tone: "miss", fill: 0, band: range ? [1 / 3, 2 / 3] : ceiling !== undefined ? [0, 2 / 3] : null };
  const clamp = (f: number) => Math.max(0.03, Math.min(1, f));
  if (range) {
    const span = range[1] - range[0] || Math.abs(range[0]) || 1;
    return { tone: value >= range[0] && value <= range[1] ? "ok" : "warn", fill: clamp((value - (range[0] - span)) / (3 * span)), band: [1 / 3, 2 / 3] };
  }
  if (ceiling !== undefined && ceiling > 0) return { tone: value <= ceiling ? "ok" : "warn", fill: clamp(value / (ceiling * 1.5)), band: [0, 2 / 3] };
  return { tone: "none", fill: 0.5, band: null };
}

const STROKE = { ok: "#8FD17A", warn: "#F5A83C", none: "#A89C90", miss: "#5A4A3F" } as const;

export default function Gauge(p: GaugeProps) {
  const { tone, fill, band } = gaugeState(p);
  const shown = p.value === undefined ? "" : p.digits !== undefined ? p.value.toFixed(p.digits) : Math.abs(p.value) >= 100 ? Math.round(p.value).toLocaleString("en-US") : String(Math.round(p.value * 10) / 10);
  const target = p.range ? `${p.range[0]} to ${p.range[1]}` : p.ceiling !== undefined ? `under ${p.ceiling}` : null;
  const state = tone === "ok" ? "inside its setpoint" : tone === "warn" ? "outside its setpoint" : tone === "miss" ? "no reading" : "no setpoint";
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{p.label}</p>
      <svg viewBox="0 0 80 80" className="mt-1.5 h-[84px] w-[84px] sm:h-24 sm:w-24" role="img" aria-label={`${p.label}: ${p.value === undefined ? "no reading" : `${shown} ${p.unit}`}, ${state}`}>
        <g transform="rotate(-90 40 40)" fill="none" strokeWidth={6}>
          <circle cx={40} cy={40} r={R} stroke="#241b17" />
          {band && <circle cx={40} cy={40} r={R} stroke="#8FD17A" strokeOpacity={0.22} strokeDasharray={`${((band[1] - band[0]) * C).toFixed(1)} ${C.toFixed(1)}`} strokeDashoffset={(-band[0] * C).toFixed(1)} />}
          {fill > 0 && <circle cx={40} cy={40} r={R} stroke={STROKE[tone]} strokeLinecap="round" strokeDasharray={`${(fill * C).toFixed(1)} ${C.toFixed(1)}`} />}
        </g>
        <text x={40} y={p.value === undefined ? 44 : 42} textAnchor="middle" fontSize={p.value === undefined ? 9 : shown.length > 4 ? 14 : 17} fontWeight={700} fill={p.value === undefined ? "#A89C90" : "#F7F3EC"} fontFamily="var(--font-display)">
          {p.value === undefined ? "No reading" : shown}
        </text>
        {p.value !== undefined && (
          <text x={40} y={54} textAnchor="middle" fontSize={8} fill="#A89C90">
            {p.unit}
          </text>
        )}
      </svg>
      <p className="mt-1 text-[11px] leading-tight text-muted">{target ? target : "no setpoint"}</p>
    </div>
  );
}
