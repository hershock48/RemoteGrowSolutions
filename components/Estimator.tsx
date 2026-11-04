"use client";

import { useState } from "react";
import { quote, TIERS, usd } from "@/lib/pricing";

/**
 * The subscription estimator. Two numbers in, a tier out, and the reason:
 * which of the two numbers set it. Works as a plain pair of inputs with
 * JavaScript off (the table beside it carries every tier), and recomputes on
 * every keystroke with it on.
 */
export default function Estimator({ lights = 300, rooms = 4 }: { lights?: number; rooms?: number }) {
  const [l, setL] = useState(String(lights));
  const [r, setR] = useState(String(rooms));
  const q = quote(Number(l), Number(r));
  const idx = TIERS.indexOf(q.tier);

  return (
    <div className="card p-6 sm:p-8">
      <p className="eyebrow">Subscription estimator</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="est-lights">
            Flowering lights, total
          </label>
          <input id="est-lights" className="field" inputMode="numeric" type="number" min={0} max={5000} value={l} onChange={(e) => setL(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="est-rooms">
            Flower rooms
          </label>
          <input id="est-rooms" className="field" inputMode="numeric" type="number" min={0} max={100} value={r} onChange={(e) => setR(e.target.value)} />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-6" aria-live="polite">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {q.tier.name} <span>· tier {idx + 1}</span>
          </p>
          <p className="mt-1 font-display text-4xl font-bold text-bone">
            {usd(q.tier.monthly)}
            {q.tier.open ? "+" : ""}
            <span className="text-lg font-semibold text-muted">/month</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            {usd(q.annual)}
            {q.tier.open ? "+" : ""} a year.{" "}
            {q.driver === "both"
              ? "Lights and rooms land in the same tier."
              : q.driver === "lights"
                ? `Set by light count. Rooms alone would be ${q.byRooms.name}.`
                : `Set by room count. Lights alone would be ${q.byLights.name}.`}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 text-sm">
          <dt className="text-muted">By lights</dt>
          <dd className="font-semibold text-bone">{q.byLights.name}</dd>
          <dt className="text-muted">By rooms</dt>
          <dd className="font-semibold text-bone">{q.byRooms.name}</dd>
        </dl>
      </div>
      {q.tier.open && (
        <p className="mt-4 text-sm text-muted">
          Enterprise starts at {usd(q.tier.monthly)}. Operations well past 750 lights or nine rooms are quoted on their own.
        </p>
      )}
    </div>
  );
}
