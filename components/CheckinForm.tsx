"use client";

import VideoField from "./VideoField";
import { useState } from "react";
import { saveCheckin } from "@/app/f/actions";
import { irrigation, ml, pct } from "@/lib/irrigation";
import { CHECKIN_FIELDS, GROUPS, type FieldDef } from "@/lib/site";
import type { Checkin, Room } from "@/lib/types";

/**
 * The day's entry for one room. One record per room per day: come back later
 * and add to it, and every box already filled shows what is there.
 *
 * Runoff is entered by feed zone, the way the paper log does it: two plants
 * spread across the zone, a whole-row collection where the room is plumbed
 * for one, or both. The day's applied volume comes from the P1 and P2
 * schedule on the room profile, so nobody retypes shot counts; a room with no
 * schedule yet still gets the two shot boxes.
 *
 * Clearing a box and saving removes that reading: the form shows what is on
 * file, so an empty box is a decision, with one exception the action handles
 * (a form that is out of date only ever adds).
 *
 * A plain <form> posting to a server action. The runoff percentage shown
 * while typing is a layer on top; with scripts off the same form submits and
 * the server does the sums.
 */

const SLOTS = [
  { k: "a", source: "plant", n: 1, name: "Plant A" },
  { k: "b", source: "plant", n: 2, name: "Plant B" },
  { k: "row", source: "row", n: 0, name: "Whole row" },
] as const;

const PARTS = [
  { k: "ec", label: "EC", step: "0.01", max: 30 },
  { k: "ph", label: "pH", step: "0.01", max: 14 },
  { k: "ml", label: "mL", step: "1", max: 200000 },
] as const;

export default function CheckinForm({
  slug,
  room,
  day,
  existing,
  previous,
  dayOfFlower,
  photos,
  scheduleMl,
  feeds,
  guideHref,
  err,
}: {
  slug: string;
  room: Room;
  day: string;
  existing?: Checkin;
  previous?: Checkin;
  dayOfFlower?: number;
  photos: boolean;
  /** The day's applied volume per plant from the room's schedule, or 0 when it has none. */
  scheduleMl: number;
  feeds: number;
  guideHref: string;
  err?: string;
}) {
  const zones = Math.max(1, Math.floor(room.feedZones ?? 1));
  const t = room.targets;
  const hasSchedule = scheduleMl > 0;
  const [photoNote, setPhotoNote] = useState("");
  // The video saves on its own (components/VideoField.tsx). While one is going
  // up the Save button waits, and after it lands the form knows the entry's new save time.
  const [videoBusy, setVideoBusy] = useState(false);
  const [seen, setSeen] = useState(existing?.at ?? 0);
  const [live, setLive] = useState<{ daily: number; runoff: number | null }>({
    daily: hasSchedule ? scheduleMl : (existing?.feedMl ?? 0),
    runoff: existing?.runoffPct ?? null,
  });

  const recalc = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const n = (k: string) => {
      const v = String(fd.get(k) ?? "").trim();
      return v === "" ? undefined : Number(v);
    };
    const daily = hasSchedule
      ? scheduleMl
      : irrigation({ emittersPerPlant: room.emittersPerPlant, emitterGph: room.emitterGph, shotMin: n("shotMin") ?? 0, shotsPerDay: n("shotsPerDay") ?? 0 }).dailyMl;
    const plants: number[] = [];
    for (let z = 1; z <= zones; z++) for (const k of ["a", "b"]) {
      const v = n(`z${z}_${k}_ml`);
      if (v !== undefined && Number.isFinite(v)) plants.push(v);
    }
    const mean = plants.length ? plants.reduce((a, b) => a + b, 0) / plants.length : null;
    setLive({ daily, runoff: mean !== null && daily > 0 ? (mean / daily) * 100 : null });
  };

  const target = (f: FieldDef): string | null => {
    switch (f.id) {
      case "tempF":
        return `${t.tempF[0]} to ${t.tempF[1]}`;
      case "rh":
        return `${t.rh[0]} to ${t.rh[1]}`;
      case "ppfd":
        return t.ppfd ? `${t.ppfd[0]} to ${t.ppfd[1]}` : null;
      case "co2":
        return t.co2 ? `${t.co2[0]} to ${t.co2[1]}` : null;
      case "feedEc":
        return t.feedEc ? `${t.feedEc[0]} to ${t.feedEc[1]}` : null;
      default:
        return null;
    }
  };

  const fieldsFor = (g: FieldDef["group"]) => CHECKIN_FIELDS.filter((f) => f.group === g && !(hasSchedule && (f.id === "shotMin" || f.id === "shotsPerDay")));
  const number = (f: FieldDef) => {
    const now = existing?.[f.id as keyof Checkin];
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
          defaultValue={typeof now === "number" ? now : ""}
          placeholder={typeof prev === "number" ? `last ${prev}` : ""}
        />
        {tg && <span className="hint">Target {tg}</span>}
      </div>
    );
  };
  const read = (z: number, source: string, n: number) => existing?.zones?.find((r) => r.zone === z && r.source === source && r.n === n);

  return (
    <form action={saveCheckin} className="space-y-6" onInput={(e) => recalc(e.currentTarget)}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="roomId" value={room.id} />
      <input type="hidden" name="day" value={day} />
      {/* The save time of the entry these boxes were filled from. See saveCheckin. */}
      <input type="hidden" name="seen" value={seen} />

      {err === "date" && <p className="error">That day has not happened yet, or is not a date.</p>}
      {err === "runoff" && <p className="error">One of the runoff reads is not a number.</p>}
      {err === "empty" && <p className="error">Enter at least one reading, a runoff read or an observation.</p>}
      {err === "photo" && <p className="error">That photo is over 4 MB or is not a JPEG, PNG, WebP or HEIC. Take a smaller one or skip it.</p>}
      {err && !["photo", "empty", "date", "runoff", "room"].includes(err) && <p className="error">One of the readings is not a number. Check the {err} box.</p>}

      <fieldset className="card p-5">
        <legend className="eyebrow px-1">{GROUPS.environment}</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{fieldsFor("environment").map(number)}</div>
      </fieldset>

      <fieldset className="card p-5">
        <legend className="eyebrow px-1">{GROUPS.irrigation}</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{fieldsFor("irrigation").map(number)}</div>
        <p className="mt-3 text-sm text-muted">
          {hasSchedule
            ? `From the room profile: ${feeds} feeds a day, ${ml(scheduleMl)} mL per plant, through ${room.emittersPerPlant} dripper${room.emittersPerPlant === 1 ? "" : "s"} at ${room.emitterGph} GPH.`
            : `No P1 and P2 schedule on the room profile yet, so enter today's shots. ${room.emittersPerPlant} dripper${room.emittersPerPlant === 1 ? "" : "s"} at ${room.emitterGph} GPH per plant.`}
        </p>
      </fieldset>

      <fieldset className="card p-5">
        <legend className="eyebrow px-1">Runoff by feed zone</legend>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Two plants in every zone, spread apart, or a whole-row collection where the bench drains to one point. No runoff from a plant: enter 0 for mL and leave EC and pH blank.{" "}
          <a href={guideHref} className="font-semibold text-flare hover:underline">
            How to take a runoff read
          </a>
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {Array.from({ length: zones }, (_, i) => i + 1).map((z) => (
            <div key={z} role="group" aria-label={`Zone ${z}`} className="rounded-lg border border-line p-3">
              <p className="font-display text-base font-bold text-bone">Zone {z}</p>
              {/* On a phone the read name sits above its three boxes, so a box is
                  wide enough to show the number typed into it. */}
              <div className="mt-2 grid grid-cols-3 items-center gap-x-2 gap-y-2 sm:grid-cols-[4.5rem_1fr_1fr_1fr]">
                <span className="hidden sm:block" />
                {PARTS.map((p) => (
                  <span key={p.k} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted" aria-hidden="true">
                    {p.label}
                  </span>
                ))}
                {SLOTS.map((s) => {
                  const r = read(z, s.source, s.n);
                  return (
                    <div key={s.k} className="contents">
                      <span className="col-span-3 -mb-1 text-[13px] text-muted sm:col-span-1 sm:mb-0">{s.name}</span>
                      {PARTS.map((p) => (
                        <input
                          key={p.k}
                          name={`z${z}_${s.k}_${p.k}`}
                          aria-label={`Zone ${z}, ${s.name}, ${p.label}`}
                          className="field !px-2"
                          type="number"
                          inputMode="decimal"
                          step={p.step}
                          min={0}
                          max={p.max}
                          defaultValue={r?.[p.k] ?? ""}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <dl className="mt-4 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2" aria-live="polite">
          <Stat label="Daily feed" value={live.daily > 0 ? `${ml(live.daily)} mL per plant` : "Enter shots above"} />
          <Stat
            label="Runoff"
            value={live.runoff === null ? "Enter the plant volumes" : pct(live.runoff)}
            tone={live.runoff === null ? undefined : live.runoff >= t.runoffPct[0] && live.runoff <= t.runoffPct[1] ? "ok" : "warn"}
            sub={`Target ${t.runoffPct[0]} to ${t.runoffPct[1]}%, from the plant reads`}
          />
        </dl>
      </fieldset>

      <fieldset className="card p-5">
        <legend className="eyebrow px-1">{GROUPS.substrate}</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{fieldsFor("substrate").map(number)}</div>
      </fieldset>

      <fieldset className="card p-5">
        <legend className="eyebrow px-1">Observations</legend>
        <label className="label mt-3" htmlFor="observations">
          Plant health, what you saw, what you changed
        </label>
        <textarea id="observations" name="observations" className="field" maxLength={3000} defaultValue={existing?.observations ?? ""} placeholder="Visible issues, feed changes, irrigation problems, alarms, crop development." />
        <div className="mt-4">
          <label className="label" htmlFor="photo">
            Canopy photo, the whole room
          </label>
          {photos ? (
            <>
              <input
                id="photo"
                name="photo"
                type="file"
                accept="image/*"
                capture="environment"
                aria-describedby="photo-note"
                onChange={(e) => {
                  // Checked here because a file over the server's limit never reaches
                  // the action: the request is refused whole and the typed entry with it.
                  const file = e.currentTarget.files?.[0];
                  if (file && file.size > 4 * 1024 * 1024) {
                    e.currentTarget.value = "";
                    setPhotoNote(`That photo is ${(file.size / 1048576).toFixed(1)} MB. The limit is 4 MB, so it was not attached. Lower the camera's resolution or send it another way.`);
                  } else setPhotoNote("");
                }}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border file:border-edge file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-bone" />
              <span className="hint">Same spot, same framing every time. Up to 4 MB. {existing?.photoUrl ? "A photo is already on this day; a new one replaces it." : ""}</span>
              <span id="photo-note" role="status" className={photoNote ? "error" : "sr-only"}>
                {photoNote}
              </span>
            </>
          ) : (
            <p className="text-sm text-muted">Photo uploads are not switched on for this deployment yet. The entry saves without one.</p>
          )}
        </div>
        <VideoField slug={slug} roomId={room.id} day={day} enabled={photos} initialUrl={existing?.videoUrl} onBusy={setVideoBusy} onSaved={setSeen} />
      </fieldset>

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={videoBusy}>
        {videoBusy ? "Waiting for the video" : `Save ${dayOfFlower ? `day ${dayOfFlower}` : "entry"}`}
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
