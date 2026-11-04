"use client";

import { useState } from "react";
import { irrigation, ml, pct } from "@/lib/irrigation";

type Props = {
  emittersPerPlant?: number;
  emitterGph?: number;
  shotMin?: number;
  shotsPerDay?: number;
  runoffMl?: number;
  containerGal?: number;
  compact?: boolean;
};

/**
 * The irrigation and runoff calculator: the first tool Jake named for the
 * platform. Public on its own page, and embedded in the check-in form with
 * the room's emitter configuration already filled in.
 */
export default function Calculator(p: Props) {
  const [v, setV] = useState({
    emittersPerPlant: String(p.emittersPerPlant ?? 2),
    emitterGph: String(p.emitterGph ?? 0.5),
    shotMin: String(p.shotMin ?? 5),
    shotsPerDay: String(p.shotsPerDay ?? 8),
    runoffMl: String(p.runoffMl ?? 300),
    containerGal: String(p.containerGal ?? ""),
  });
  const r = irrigation({
    emittersPerPlant: Number(v.emittersPerPlant),
    emitterGph: Number(v.emitterGph),
    shotMin: Number(v.shotMin),
    shotsPerDay: Number(v.shotsPerDay),
    runoffMl: v.runoffMl === "" ? undefined : Number(v.runoffMl),
    containerGal: v.containerGal === "" ? undefined : Number(v.containerGal),
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  const fields: [keyof typeof v, string, string][] = [
    ["emittersPerPlant", "Emitters per plant", "1"],
    ["emitterGph", "Flow rate, GPH per emitter", "0.01"],
    ["shotMin", "Minutes per shot", "0.1"],
    ["shotsPerDay", "Shots per day", "1"],
    ["runoffMl", "Measured daily runoff, mL per plant", "1"],
    ["containerGal", "Container volume, gallons (optional)", "0.1"],
  ];

  return (
    <div className={p.compact ? "" : "card p-6 sm:p-8"}>
      {!p.compact && <p className="eyebrow">Irrigation and runoff calculator</p>}
      <div className={`grid gap-4 ${p.compact ? "sm:grid-cols-3" : "mt-5 sm:grid-cols-2"}`}>
        {fields.map(([k, label, step]) => (
          <div key={k}>
            <label className="label" htmlFor={`calc-${k}`}>
              {label}
            </label>
            <input id={`calc-${k}`} className="field" type="number" inputMode="decimal" min={0} step={step} value={v[k]} onChange={set(k)} />
          </div>
        ))}
      </div>
      <dl className="mt-6 grid gap-px overflow-hidden rounded-xl2 border border-line bg-line sm:grid-cols-4" aria-live="polite">
        <Stat label="Volume per shot" value={`${ml(r.shotMl)} mL`} />
        <Stat label="Daily feed volume" value={`${ml(r.dailyMl)} mL`} />
        <Stat label="Runoff" value={r.runoffPct === null ? "Enter runoff" : pct(r.runoffPct)} />
        <Stat label="Daily net input" value={r.netMl === null ? "Enter runoff" : `${ml(r.netMl)} mL`} />
      </dl>
      {r.substratePct !== null && (
        <p className="mt-3 text-sm text-muted">
          Daily feed is {pct(r.substratePct)} of the container volume.
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Assumes nominal emitter flow, even distribution and a full day collected. Net input is applied minus collected
        runoff, not plant uptake. Verify emitter flow with a cup and a timer before trusting any of this.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink-panel px-5 py-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-1 font-display text-xl font-bold text-bone">{value}</dd>
    </div>
  );
}
