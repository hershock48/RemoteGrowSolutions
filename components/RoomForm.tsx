import { saveRoom } from "@/app/f/actions";
import { DEFAULT_TARGETS, SENSOR_PLATFORMS, SUBSTRATES } from "@/lib/site";
import type { Room } from "@/lib/types";

/**
 * The room profile: equipment that rarely changes on the left, targets that
 * change through a cycle on the right. Both are one record; the split is
 * visual, because the grower fills the first once and the consultant edits
 * the second on the weekly call.
 */
export default function RoomForm({ slug, room, err }: { slug: string; room?: Room; err?: string }) {
  const t = room?.targets;
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
          <Field id="emittersPerPlant" label="Emitters per plant" hint="Drives the runoff calculation on every check-in.">
            <input id="emittersPerPlant" name="emittersPerPlant" className="field" type="number" inputMode="decimal" min={0} step="1" defaultValue={room?.emittersPerPlant ?? 2} />
          </Field>
          <Field id="emitterGph" label="Emitter flow, GPH" hint="Nominal. Verify with a cup and a timer.">
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
              {SENSOR_PLATFORMS.map((s) => (
                <option key={s}>{s}</option>
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
        <fieldset className="card p-6">
          <legend className="eyebrow px-1">Targets</legend>
          <p className="mt-2 text-sm text-muted">
            The room&apos;s own numbers. Every check-in is compared to these and nothing else. Change them on the
            weekly call as the crop moves.
          </p>
          <div className="mt-4 space-y-4">
            <Pair label="Temperature, °F" lo="tempLo" hi="tempHi" v={t?.tempF ?? DEFAULT_TARGETS.tempF} step="0.5" />
            <Pair label="RH, %" lo="rhLo" hi="rhHi" v={t?.rh ?? DEFAULT_TARGETS.rh} step="1" />
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
