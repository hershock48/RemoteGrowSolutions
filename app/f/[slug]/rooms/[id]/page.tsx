import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import LineChart, { Legend } from "@/components/LineChart";
import FlagList from "@/components/FlagList";
import EntryLog from "@/components/EntryLog";
import { endCycle, startCycle } from "@/app/f/actions";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { addDays, flowerDay, fmtDay, fmtWhen } from "@/lib/dates";
import { evaluateRoom } from "@/lib/rules";
import { ecSeries, rhSeries, runoffSeries, runReadings, tempSeries } from "@/lib/series";

export const metadata: Metadata = { title: "Room" };

/**
 * One room. The hero is the picture that diagnoses a run: feed EC against
 * runoff EC over the flower days, with the ceiling dashed. The gap between
 * the two lines is what the consultant reads. Runoff percent, temperature
 * and RH follow as band charts. Dates lead with the flower day, because
 * that is the unit a grower thinks in; the clock date comes second.
 */
export default async function RoomPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ saved?: string; err?: string }> }) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { facility, viewer, today } = await requireFacility(slug);
  const room = await store.room(id);
  if (!room || room.facilityId !== facility.id) notFound();
  const [cycle, checkins, cycles, open] = await Promise.all([
    store.activeCycle(room.id),
    store.checkinsForRoom(room.id, 200),
    store.cycles(facility.id),
    store.openEventsBefore(facility.id, addDays(today, 1)),
  ]);
  const flags = evaluateRoom({ room, cycle, checkins, events: open, today });
  const base = `/f/${facility.slug}`;
  const day = cycle ? flowerDay(cycle.flipDate, today) : null;
  const past = cycles.filter((c) => c.roomId === room.id && c.status === "harvested").sort((a, b) => (b.harvestedOn ?? "").localeCompare(a.harvestedOn ?? ""));
  // Charts follow the active run; with none, the last finished one, so a
  // room between runs still shows what happened.
  const charted = cycle ?? past[0] ?? null;
  const rs = charted ? runReadings(checkins, charted) : [];
  const ec = ecSeries(rs, room);
  const runoff = runoffSeries(rs, room);
  const temp = tempSeries(rs, room);
  const rh = rhSeries(rs, room);
  const t = room.targets;
  const latest = checkins[0];
  const latestDay = latest ? (latest.dayOfFlower ?? (cycle ? flowerDay(cycle.flipDate, latest.day) : null)) : null;

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/rooms">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            {room.kind} room{room.archivedAt ? " · archived" : ""}
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl">{room.name}</h1>
          <p className="mt-2 text-[15px] text-muted">
            {room.fixtureCount ? `${room.fixtureCount} × ${room.fixtureModel || "fixtures"}` : room.fixtureModel}
            {room.canopySqft ? ` · ${room.canopySqft} sq ft` : ""} · {room.substrate}
            {room.containerGal ? `, ${room.containerGal} gal` : ""} · {room.emittersPerPlant} × {room.emitterGph} GPH
            {room.sensorPlatform ? ` · ${room.sensorPlatform}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/checkin?room=${room.id}`} className="btn-primary">
            Check in
          </Link>
          <Link href={`${base}/rooms/${room.id}/edit`} className="btn-ghost">
            Edit profile and targets
          </Link>
        </div>
      </div>

      {sp.saved && (
        <p className="mt-6 rounded-lg border border-ok/50 bg-ink-panel px-4 py-3 text-sm text-bone" role="status">
          {sp.saved === "checkin" ? "Check-in saved." : "Saved."}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-8">
          <section>
            <h2 className="text-xl text-bone">Right now</h2>
            <div className="mt-3">
              <FlagList flags={flags} base={base} empty="Inside its targets, check-ins current." />
            </div>
          </section>

          <section className="card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-xl text-bone">
                Feed against runoff EC
                {charted && <span className="ml-2 text-sm font-normal text-muted">{charted.genetic || "run"}, flipped {fmtDay(charted.flipDate)}{charted.status === "harvested" ? ", last run" : ""}</span>}
              </h2>
              <Legend series={ec} />
            </div>
            <p className="mt-1 text-sm text-muted">The gap between the lines is the story. Runoff climbing while feed holds is salt building in the substrate.</p>
            <div className="mt-4">
              <LineChart series={ec} yLabel="mS/cm" marker={day ?? undefined} ariaLabel={`Feed and runoff EC for ${room.name} by flower day`} />
            </div>
          </section>

          {/* Two across on a laptop, three only on a wide screen: three in the
              narrow column scaled the axis labels below legibility. */}
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {[
              { title: "Runoff %", target: `${t.runoffPct[0]} to ${t.runoffPct[1]}`, series: runoff, label: `Runoff percentage for ${room.name}` },
              { title: "Temperature °F", target: `${t.tempF[0]} to ${t.tempF[1]}`, series: temp, label: `Temperature for ${room.name}` },
              { title: "RH %", target: `${t.rh[0]} to ${t.rh[1]}`, series: rh, label: `Relative humidity for ${room.name}` },
            ].map((c) => (
              <div key={c.title} className="card p-4">
                <h3 className="text-sm font-semibold text-bone">{c.title}</h3>
                <p className="text-xs text-muted">Target {c.target}</p>
                <div className="mt-2">
                  <LineChart series={c.series} width={400} height={220} ariaLabel={c.label} />
                </div>
              </div>
            ))}
          </section>

          <section id="entries" className="scroll-mt-24">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl text-bone">What the grower entered, by date</h2>
              <span className="text-xs text-muted">Newest first. Day, environment, lights, irrigation, runoff, substrate, and what they saw.</span>
            </div>
            <div className="mt-3">
              <EntryLog checkins={checkins} timezone={facility.timezone} />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <p className="eyebrow">Current run</p>
            {cycle ? (
              <>
                <p className="mt-2 font-display text-2xl font-bold text-bone">
                  Day {day ?? 0} <span className="text-base font-semibold text-muted">of {room.flowerDays}</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {cycle.genetic || "Unnamed run"}. Flipped {fmtDay(cycle.flipDate)}, planned harvest {fmtDay(cycle.plannedHarvest ?? addDays(cycle.flipDate, room.flowerDays - 1))}.
                </p>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-flare">Record the harvest</summary>
                  <form action={endCycle} className="mt-3 space-y-3">
                    <input type="hidden" name="slug" value={facility.slug} />
                    <input type="hidden" name="cycleId" value={cycle.id} />
                    <div>
                      <label className="label" htmlFor="harvestedOn">
                        Harvested on
                      </label>
                      <input id="harvestedOn" name="harvestedOn" type="date" className="field" defaultValue={today} />
                    </div>
                    <div>
                      <label className="label" htmlFor="dryGrams">
                        Dry weight, grams (optional)
                      </label>
                      <input id="dryGrams" name="dryGrams" type="number" inputMode="decimal" min={0} className="field" />
                      <span className="hint">Feeds the quarter&apos;s grams per square foot on the report.</span>
                    </div>
                    <div>
                      <label className="label" htmlFor="cnote">
                        Note
                      </label>
                      <input id="cnote" name="note" className="field" maxLength={1000} />
                    </div>
                    <button type="submit" className="btn-ghost w-full">
                      Close this run
                    </button>
                  </form>
                </details>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted">
                  {room.kind === "flower" ? "No active run. Start one when the room flips." : "Runs are tracked on flower rooms."}
                </p>
                {room.kind === "flower" && (
                  <form action={startCycle} className="mt-4 space-y-3">
                    <input type="hidden" name="slug" value={facility.slug} />
                    <input type="hidden" name="roomId" value={room.id} />
                    <div>
                      <label className="label" htmlFor="genetic">
                        Genetic
                      </label>
                      <input id="genetic" name="genetic" className="field" defaultValue={room.genetics} maxLength={120} />
                    </div>
                    <div>
                      <label className="label" htmlFor="flipDate">
                        Flip date
                      </label>
                      <input id="flipDate" name="flipDate" type="date" className="field" defaultValue={today} />
                      {sp.err === "date" && <span className="error">That is not a date.</span>}
                    </div>
                    <div>
                      <label className="label" htmlFor="plannedHarvest">
                        Planned harvest (optional)
                      </label>
                      <input id="plannedHarvest" name="plannedHarvest" type="date" className="field" />
                      <span className="hint">Blank uses the room&apos;s {room.flowerDays}-day flower duration.</span>
                    </div>
                    <button type="submit" className="btn-primary w-full">
                      Start the run
                    </button>
                  </form>
                )}
              </>
            )}
          </section>

          <section className="card p-5">
            <p className="eyebrow">Targets</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Temperature</dt>
              <dd>{t.tempF[0]} to {t.tempF[1]} °F</dd>
              <dt className="text-muted">RH</dt>
              <dd>{t.rh[0]} to {t.rh[1]} %</dd>
              <dt className="text-muted">Runoff</dt>
              <dd>{t.runoffPct[0]} to {t.runoffPct[1]} %</dd>
              {t.ppfd && (
                <>
                  <dt className="text-muted">PPFD</dt>
                  <dd>{t.ppfd[0]} to {t.ppfd[1]}</dd>
                </>
              )}
              {t.feedEc && (
                <>
                  <dt className="text-muted">Feed EC</dt>
                  <dd>{t.feedEc[0]} to {t.feedEc[1]}</dd>
                </>
              )}
              {t.runoffEcMax !== undefined && (
                <>
                  <dt className="text-muted">Runoff EC</dt>
                  <dd>under {t.runoffEcMax}</dd>
                </>
              )}
            </dl>
          </section>

          {past.length > 0 && (
            <section className="card p-5">
              <p className="eyebrow">Past runs</p>
              <ul className="mt-2 space-y-2 text-sm">
                {past.map((c) => (
                  <li key={c.id} className="text-muted">
                    <span className="text-bone">{c.genetic || "Run"}</span>, {fmtDay(c.flipDate)} to {c.harvestedOn ? fmtDay(c.harvestedOn) : "?"}
                    {c.outcome?.dryGrams && room.canopySqft ? `, ${(c.outcome.dryGrams / room.canopySqft).toFixed(1)} g/sq ft` : c.outcome?.dryGrams ? `, ${c.outcome.dryGrams} g dry` : ""}
                    {c.outcome?.note ? `. ${c.outcome.note}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-xs text-muted">
            {latest
              ? `Last check-in ${latestDay ? `day ${latestDay}` : fmtDay(latest.day)} (${fmtWhen(latest.at, facility.timezone)}) by the ${latest.submittedBy === "rgs" ? "consultant" : "grower"}.`
              : ""}
          </p>
        </aside>
      </div>
    </Shell>
  );
}
