import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import Sparkline from "@/components/Sparkline";
import FlagList from "@/components/FlagList";
import { endCycle, startCycle } from "@/app/f/actions";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { addDays, flowerDay, fmtDay, fmtWhen } from "@/lib/dates";
import { evaluateRoom } from "@/lib/rules";

export const metadata: Metadata = { title: "Room" };

export default async function RoomPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ saved?: string; err?: string }> }) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { facility, viewer, today } = await requireFacility(slug);
  const room = await store.room(id);
  if (!room || room.facilityId !== facility.id) notFound();
  const [cycle, checkins, cycles, open] = await Promise.all([
    store.activeCycle(room.id),
    store.checkinsForRoom(room.id, 40),
    store.cycles(facility.id),
    store.openEventsBefore(facility.id, addDays(today, 1)),
  ]);
  const flags = evaluateRoom({ room, cycle, checkins, events: open, today });
  const base = `/f/${facility.slug}`;
  const day = cycle ? flowerDay(cycle.flipDate, today) : null;
  const series = [...checkins].reverse();
  const past = cycles.filter((c) => c.roomId === room.id && c.status === "harvested");
  const t = room.targets;

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
        <div className="space-y-8">
          <section>
            <h2 className="text-xl text-bone">Right now</h2>
            <div className="mt-3">
              <FlagList flags={flags} base={base} empty="Inside its targets, check-ins current." />
            </div>
          </section>

          <section>
            <h2 className="text-xl text-bone">Trend</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Runoff %</p>
                <div className="mt-2">
                  <Sparkline values={series.map((c) => c.runoffPct)} band={t.runoffPct} label="Runoff percentage" />
                </div>
              </div>
              <div className="card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Runoff EC</p>
                <div className="mt-2">
                  <Sparkline values={series.map((c) => c.runoffEc)} ceiling={t.runoffEcMax} label="Runoff EC" />
                </div>
              </div>
              <div className="card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Temperature °F</p>
                <div className="mt-2">
                  <Sparkline values={series.map((c) => c.tempF)} band={t.tempF} label="Temperature" />
                </div>
              </div>
              <div className="card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">RH %</p>
                <div className="mt-2">
                  <Sparkline values={series.map((c) => c.rh)} band={t.rh} label="Relative humidity" />
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl text-bone">Check-ins</h2>
            <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Check-in history, scrolls sideways on a phone">
              <table className="tbl min-w-[760px]">
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Flower day</th>
                    <th scope="col">Temp</th>
                    <th scope="col">RH</th>
                    <th scope="col">Feed EC/pH</th>
                    <th scope="col">Runoff EC/pH</th>
                    <th scope="col">Runoff</th>
                    <th scope="col">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {checkins.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-muted">
                        None yet.
                      </td>
                    </tr>
                  )}
                  {checkins.map((c) => (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap">{fmtDay(c.day)}</td>
                      <td className="text-muted">{c.dayOfFlower ?? ""}</td>
                      <td>{c.tempF ?? ""}</td>
                      <td>{c.rh ?? ""}</td>
                      <td>{[c.feedEc, c.feedPh].filter((v) => v !== undefined).join(" / ")}</td>
                      <td>{[c.runoffEc, c.runoffPh].filter((v) => v !== undefined).join(" / ")}</td>
                      <td>{c.runoffPct !== undefined ? `${c.runoffPct.toFixed(1)}%` : c.runoffMl !== undefined ? `${c.runoffMl} mL` : ""}</td>
                      <td className="max-w-[260px] text-muted">
                        {c.observations}
                        {c.photoUrl && (
                          <a href={c.photoUrl} target="_blank" rel="noopener" className="ml-1 text-flare hover:underline">
                            photo
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    {c.outcome?.dryGrams ? `, ${c.outcome.dryGrams} g dry` : ""}
                    {c.outcome?.note ? `. ${c.outcome.note}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-xs text-muted">
            {checkins.length ? `Last check-in ${fmtWhen(checkins[0].at, facility.timezone)} by the ${checkins[0].submittedBy === "rgs" ? "consultant" : "grower"}.` : ""}
          </p>
        </aside>
      </div>
    </Shell>
  );
}
