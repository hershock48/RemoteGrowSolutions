import { saveRoom } from "@/app/f/actions";
import { DEFAULT_TARGETS, LIVE_PLATFORMS, SUBSTRATES } from "@/lib/site";
import type { Room } from "@/lib/types";

/**
 * The room profile: equipment that rarely changes on the left, targets that
 * change through a cycle on the right. Both are one record; the split is
 * visual, because the grower fills the first once and the consultant edits
 * the second on the weekly call.
 *
 * The lighting and irrigation schedule is its own block. Shot size is never
 * typed: it comes from the drippers per plant and the dripper size, so the
 * room page can list every P1 and P2 shot with its on and off time, its
 * volume, and the day's total.
 */
export default function RoomForm({ slug, room, err }: { slug: string; room?: Room; err?: string }) {
  const t = room?.targets;
  const s = room?.schedule;
  const platforms: string[] = [...LIVE_PLATFORMS, "None yet"];
  if (room?.sensorPlatform && !platforms.includes(room.sensorPlatform)) platforms.unshift(room.sensorPlatform);
  return (
    <form action={saveRoom} className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <input type="hidden" name="slug" value={slug} />
      {room && <input type="hidden" name="id" value={room.id} />}

      <fieldset className="card p-6">
        <legend className="eyebrow px-1">The room</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Room name" err={err === "name" ? "A room needs a name." : undefined}>
            <input id="name" name="name" className="field" defaultValue={room?.name ?? ""} required maxLength={60} placeholder="Flower 01" />
          </Field>
          <Field id="kind" label="Kind">
            <select id="kind" name="kind" className="field" defaultValue={room?.kind ?? "flower"}>
              <option value="flower">Flower</option>
              <option value="veg">Veg</option>
              <option value="mom">Mother</option>
              <option value="clone">Clone</option>
            </select>
          </Field>
          <Field id="fixtureModel" label="Fixture model">
            <input id="fixtureModel" name="fixtureModel" className="field" defaultValue={room?.fixtureModel ?? ""} maxLength={80} placeholder="Ion 720W" />
          </Field>
          <Field id="fixtureCount" label="Fixtures">
            <input id="fixtureCount" name="fixtureCount" className="field" type="number" inputMode="numeric" min={0} defaultValue={room?.fixtureCount ?? ""} />
          </Field>
          <Field id="canopySqft" label="Canopy, sq ft">
            <input id="canopySqft" name="canopySqft" className="field" type="number" inputMode="decimal" min={0} step="1" defaultValue={room?.canopySqft ?? ""} />
          </Field>
          <Field id="plantsPerLight" label="Plants per light">
            <input id="plantsPerLight" name="plantsPerLight" className="field" type="number" inputMode="decimal" min={0} step="0.5" defaultValue={room?.plantsPerLight ?? ""} />
          </Field>
          <Field id="substrate" label="Substrate">
            <select id="substrate" name="substrate" className="field" defaultValue={room?.substrate ?? "Coco"}>
              {SUBSTRATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field id="containerGal" label="Container volume, gallons">
            <input id="containerGal" name="containerGal" className="field" type="number" inputMode="decimal" min={0} step="0.1" defaultValue={room?.containerGal ?? ""} />
          </Field>
          <Field id="benches" label="Benches or rows" hint="For the drawing of the room.">
            <input id="benches" name="benches" className="field" type="number" inputMode="numeric" min={1} max={24} step="1" defaultValue={room?.benches ?? ""} />
          </Field>
          <Field id="feedZones" label="Feed zones" hint="Each zone gets its own runoff reads.">
            <input id="feedZones" name="feedZones" className="field" type="number" inputMode="numeric" min={1} max={24} step="1" defaultValue={room?.feedZones ?? ""} />
          </Field>
          <Field id="emittersPerPlant" label="Drippers per plant" hint="With the dripper size, this sets the shot size and the daily volume.">
            <input id="emittersPerPlant" name="emittersPerPlant" className="field" type="number" inputMode="decimal" min={0} step="1" defaultValue={room?.emittersPerPlant ?? 2} />
          </Field>
          <Field id="emitterGph" label="Dripper size, GPH" hint="Nominal. Verify with a cup and a timer.">
            <input id="emitterGph" name="emitterGph" className="field" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={room?.emitterGph ?? 0.5} />
          </Field>
          <Field id="vegDays" label="Veg duration, days">
            <input id="vegDays" name="vegDays" className="field" type="number" inputMode="numeric" min={0} defaultValue={room?.vegDays ?? 21} />
          </Field>
          <Field id="flowerDays" label="Flower duration, days">
            <input id="flowerDays" name="flowerDays" className="field" type="number" inputMode="numeric" min={1} defaultValue={room?.flowerDays ?? 63} />
          </Field>
          <Field id="sensorPlatform" label="Sensor platform">
            <select id="sensorPlatform" name="sensorPlatform" className="field" defaultValue={room?.sensorPlatform ?? ""}>
              <option value="">Choose one</option>
              {platforms.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field id="controller" label="Irrigation controller">
            <input id="controller" name="controller" className="field" defaultValue={room?.controller ?? ""} maxLength={120} />
          </Field>
          <Field id="hvac" label="HVAC">
            <input id="hvac" name="hvac" className="field" defaultValue={room?.hvac ?? ""} maxLength={160} />
          </Field>
          <Field id="dehu" label="Dehumidification">
            <input id="dehu" name="dehu" className="field" defaultValue={room?.dehu ?? ""} maxLength={160} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="genetics" label="Genetics usually run here">
              <input id="genetics" name="genetics" className="field" defaultValue={room?.genetics ?? ""} maxLength={200} />
            </Field>
          </div>
        </div>
        {err === "number" && <p className="error">One of the numbers is not a number.</p>}
      </fieldset>

      <div className="space-y-6">
        <fieldset id="schedule" className="card scroll-mt-28 p-6">
          <legend className="eyebrow px-1">Lights and irrigation schedule</legend>
          <p className="mt-2 text-sm text-muted">P1 is the ramp from lights on to field capacity, P2 the maintenance shots after it. Times are on the facility clock, 24 hour.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field id="lightsOn" label="Lights on">
              <input id="lightsOn" name="lightsOn" className="field" type="time" defaultValue={s?.lightsOn ?? ""} />
            </Field>
            <Field id="lightsOff" label="Lights off">
              <input id="lightsOff" name="lightsOff" className="field" type="time" defaultValue={s?.lightsOff ?? ""} />
            </Field>
          </div>
          {(["p1", "p2"] as const).map((p) => {
            const ph = s?.[p];
            const N = p.toUpperCase();
            return (
              <div key={p} role="group" aria-label={N} className="mt-4 rounded-lg border border-line p-3">
                <p className="font-display text-base font-bold text-bone">{N}</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Field id={`${p}Start`} label="First shot at">
                    <input id={`${p}Start`} name={`${p}Start`} className="field" type="time" defaultValue={ph?.start ?? ""} />
                  </Field>
                  <Field id={`${p}Shots`} label="Shots">
                    <input id={`${p}Shots`} name={`${p}Shots`} className="field" type="number" inputMode="numeric" min={0} max={60} step="1" defaultValue={ph?.shots ?? ""} />
                  </Field>
                  <Field id={`${p}ShotMin`} label="Shot length, min">
                    <input id={`${p}ShotMin`} name={`${p}ShotMin`} className="field" type="number" inputMode="decimal" min={0} max={120} step="0.05" defaultValue={ph?.shotMin ?? ""} />
                  </Field>
                  <Field id={`${p}Every`} label="Minutes apart">
                    <input id={`${p}Every`} name={`${p}Every`} className="field" type="number" inputMode="decimal" min={0} max={720} step="1" defaultValue={ph?.everyMin ?? ""} />
                  </Field>
                </div>
              </div>
            );
          })}
        </fieldset>

        <fieldset className="card p-6">
          <legend className="eyebrow px-1">Targets</legend>
          <p className="mt-2 text-sm text-muted">
            The room&apos;s own setpoints. Every reading is compared to these and nothing else. Change them on the
            weekly call as the crop moves.
          </p>
          <div className="mt-4 space-y-4">
            <Pair label="Temperature, °F" lo="tempLo" hi="tempHi" v={t?.tempF ?? DEFAULT_TARGETS.tempF} step="0.5" />
            <Pair label="RH, %" lo="rhLo" hi="rhHi" v={t?.rh ?? DEFAULT_TARGETS.rh} step="1" />
            <Pair label="VPD, kPa (optional)" lo="vpdLo" hi="vpdHi" v={t?.vpd} step="0.05" />
            <Pair label="CO₂, ppm (optional)" lo="co2Lo" hi="co2Hi" v={t?.co2} step="10" />
            <Pair label="Runoff, % of daily volume" lo="runoffLo" hi="runoffHi" v={t?.runoffPct ?? DEFAULT_TARGETS.runoffPct} step="1" />
            <Pair label="PPFD (optional)" lo="ppfdLo" hi="ppfdHi" v={t?.ppfd} step="10" />
            <Pair label="Feed EC (optional)" lo="feedEcLo" hi="feedEcHi" v={t?.feedEc} step="0.1" />
            <Field id="runoffEcMax" label="Runoff EC ceiling (optional)">
              <input id="runoffEcMax" name="runoffEcMax" className="field" type="number" inputMode="decimal" min={0} step="0.1" defaultValue={t?.runoffEcMax ?? ""} />
            </Field>
          </div>
        </fieldset>

        {room && (
          <label className="flex items-center gap-3 text-sm text-muted">
            <input type="checkbox" name="archived" value="yes" defaultChecked={!!room.archivedAt} className="h-5 w-5 accent-ember" />
            Archive this room (keeps its history, removes it from the dashboard)
          </label>
        )}

        <button type="submit" className="btn-primary w-full">
          {room ? "Save room" : "Add room"}
        </button>
      </div>
    </form>
  );
}

function Field({ id, label, hint, err, children }: { id: string; label: string; hint?: string; err?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && <span className="hint">{hint}</span>}
      {err && <span className="error">{err}</span>}
    </div>
  );
}

function Pair({ label, lo, hi, v, step }: { label: string; lo: string; hi: string; v?: [number, number]; step: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <input name={lo} aria-label={`${label}, low`} className="field" type="number" inputMode="decimal" step={step} defaultValue={v?.[0] ?? ""} placeholder="low" />
        <input name={hi} aria-label={`${label}, high`} className="field" type="number" inputMode="decimal" step={step} defaultValue={v?.[1] ?? ""} placeholder="high" />
      </div>
    </div>
  );
}
