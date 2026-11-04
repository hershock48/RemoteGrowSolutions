"use client";

import { useState } from "react";
import { saveCheckin } from "@/app/f/actions";
import { irrigation, ml, pct } from "@/lib/irrigation";
import { CHECKIN_FIELDS, GROUPS, type FieldDef } from "@/lib/site";
import type { Checkin, Room } from "@/lib/types";

/**
 * The three-times-a-week form. The room profile already knows emitters and
 * flow rate, so the grower types shot length, shots and the runoff they
 * collected, and the runoff percentage appears as they type. Everything else
 * is a number box with the room's target under it.
 *
 * A plain <form> posting to a server action: the live arithmetic is a layer
 * on top, and with scripts off the same form submits and the server does the
 * sums. The previous reading sits in each placeholder so a value that has not
 * moved is one glance, not a lookup.
 */
export default function CheckinForm({
  slug,
  room,
  today,
  previous,
  dayOfFlower,
  photos,
  err,
}: {
  slug: string;
  room: Room;
  today: string;
  previous?: Checkin;
  dayOfFlower?: number;
  photos: boolean;
  err?: string;
}) {
  const [shotMin, setShotMin] = useState(previous?.shotMin?.toString() ?? "");
  const [shots, setShots] = useState(previous?.shotsPerDay?.toString() ?? "");
  const [runoff, setRunoff] = useState("");
  const calc = irrigation({
    emittersPerPlant: room.emittersPerPlant,
    emitterGph: room.emitterGph,
    shotMin: Number(shotMin),
    shotsPerDay: Number(shots),
    runoffMl: runoff === "" ? undefined : Number(runoff),
  });
  const t = room.targets;
  const target = (f: FieldDef): string | null => {
    switch (f.id) {
      case "tempF":
        return `${t.tempF[0]} to ${t.tempF[1]}`;
      case "rh":
        return `${t.rh[0]} to ${t.rh[1]}`;
      case "ppfd":
        return t.ppfd ? `${t.ppfd[0]} to ${t.ppfd[1]}` : null;
      case "feedEc":
        return t.feedEc ? `${t.feedEc[0]} to ${t.feedEc[1]}` : null;
      case "runoffEc":
        return t.runoffEcMax !== undefined ? `under ${t.runoffEcMax}` : null;
      default:
        return null;
    }
  };
  const groups = Object.keys(GROUPS) as FieldDef["group"][];

  return (
    <form action={saveCheckin} className="space-y-6" encType="multipart/form-data">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="roomId" value={room.id} />

      <div className="card flex flex-wrap items-end gap-4 p-5">
        <div>
          <label className="label" htmlFor="day">
            Reading for
          </label>
          <input id="day" name="day" type="date" className="field" defaultValue={today} max={today} />
        </div>
        <p className="pb-3 text-sm text-muted">
          {dayOfFlower ? `Day ${dayOfFlower} of ${room.flowerDays}.` : room.kind === "flower" ? "No active run on this room." : `${room.kind} room.`}{" "}
          {room.emittersPerPlant} emitter{room.emittersPerPlant === 1 ? "" : "s"} at {room.emitterGph} GPH per plant.
        </p>
      </div>

      {err && err !== "photo" && err !== "empty" && <p className="error">One of the readings is not a number. Check the {err} box.</p>}
      {err === "empty" && <p className="error">Enter at least one reading or an observation.</p>}
      {err === "photo" && <p className="error">That photo is over 8 MB. Take a smaller one or skip it.</p>}

      {groups.map((g) => (
        <fieldset key={g} className="card p-5">
          <legend className="eyebrow px-1">{GROUPS[g]}</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHECKIN_FIELDS.filter((f) => f.group === g).map((f) => {
              const live = f.id === "shotMin" ? [shotMin, setShotMin] : f.id === "shotsPerDay" ? [shots, setShots] : f.id === "runoffMl" ? [runoff, setRunoff] : null;
              const prev = previous?.[f.id as keyof Checkin];
              const tg = target(f);
              return (
                <div key={f.id}>
                  <label className="label" htmlFor={`c-${f.id}`}>
                    {f.label}
                    {f.unit ? <span className="font-normal text-muted"> {f.unit}</span> : null}
                  </label>
                  <input
                    id={`c-${f.id}`}
                    name={f.id}
                    className="field"
                    type="number"
                    inputMode="decimal"
                    step={f.step}
                    min={f.min}
                    max={f.max}
                    placeholder={typeof prev === "number" ? `last ${prev}` : ""}
                    {...(live ? { value: live[0] as string, onChange: (e) => (live[1] as (v: string) => void)(e.target.value) } : {})}
                  />
                  {tg && <span className="hint">Target {tg}</span>}
                </div>
              );
            })}
          </div>
          {g === "runoff" && (
            <dl className="mt-4 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3" aria-live="polite">
              <Stat label="Per shot" value={calc.shotMl > 0 ? `${ml(calc.shotMl)} mL` : "Enter shot length"} />
              <Stat label="Daily feed" value={calc.dailyMl > 0 ? `${ml(calc.dailyMl)} mL per plant` : "Enter shots per day"} />
              <Stat
                label="Runoff"
                value={calc.runoffPct === null ? "Enter collected runoff" : pct(calc.runoffPct)}
                tone={calc.runoffPct === null ? undefined : calc.runoffPct >= t.runoffPct[0] && calc.runoffPct <= t.runoffPct[1] ? "ok" : "warn"}
                sub={`Target ${t.runoffPct[0]} to ${t.runoffPct[1]}%`}
              />
            </dl>
          )}
        </fieldset>
      ))}

      <fieldset className="card p-5">
        <legend className="eyebrow px-1">Observations</legend>
        <label className="label mt-3" htmlFor="observations">
          What you saw and what you changed
        </label>
        <textarea id="observations" name="observations" className="field" maxLength={3000} placeholder="Visible issues, changes to irrigation or environment, crop development." />
        <div className="mt-4">
          <label className="label" htmlFor="photo">
            Canopy photo
          </label>
          {photos ? (
            <>
              <input id="photo" name="photo" type="file" accept="image/*" capture="environment" className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border file:border-edge file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-bone" />
              <span className="hint">Same spot, same framing every time. Up to 8 MB.</span>
            </>
          ) : (
            <p className="text-sm text-muted">Photo uploads are not switched on for this deployment yet. The reading saves without one.</p>
          )}
        </div>
      </fieldset>

      <button type="submit" className="btn-primary">
        Save check-in
      </button>
    </form>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: "ok" | "warn"; sub?: string }) {
  return (
    <div className="bg-ink px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className={`mt-0.5 font-display text-lg font-bold ${tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-bone"}`}>{value}</dd>
      {sub && <dd className="text-xs text-muted">{sub}</dd>}
    </div>
  );
}
