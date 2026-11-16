import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import LineChart, { Legend } from "@/components/LineChart";
import EntryLog from "@/components/EntryLog";
import Gauge from "@/components/Gauge";
import RoomVisual from "@/components/RoomVisual";
import ScheduleView from "@/components/ScheduleView";
import SeriesCharts from "@/components/SeriesCharts";
import { TodayList, WeekGrid } from "@/components/TaskList";
import { deleteEvent, endCycle, saveEvent, startCycle, toggleEvent, uploadSeries } from "@/app/f/actions";
import { loadBoard } from "@/lib/board";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { addDays, diffDays, flowerDay, fmtDay, fmtWhen } from "@/lib/dates";
import { nowOf } from "@/lib/now";
import { evaluateRoom } from "@/lib/rules";
import { buildSchedule, parseHHMM } from "@/lib/schedule";
import { ecSeries, rhSeries, runoffSeries, runReadings, tempSeries } from "@/lib/series";
import { tally, URGENT_LINE } from "@/lib/tasks";
import { vpdKpa } from "@/lib/vpd";
import type { Series } from "@/lib/chart";
import type { CalEvent, Phase, Range } from "@/lib/types";

export const metadata: Metadata = { title: "Room" };

/**
 * One room, the same on both sides, in the order Jake reads it (2026-11-16):
 * the room drawn from its profile beside the profile itself, the checklist
 * for today and the week, the irrigation schedule with every shot, then the
 * environment against its setpoints. Uploaded sensor exports draw as graphs
 * under the heading they belong to, and a link opens the live platform.
 * The dated entries and the run sit below.
 *
 * Above all of it: a row of ring gauges, one per reading, coloured by
 * status, and the run as a strip of weeks. That is the shape of the room
 * view on Aroya, which he named as the reference for presenting a profile.
 */

const MESSAGES: Record<string, string> = {
  checkin: "Saved. The checklist below has been updated.",
  export: "Export added. It is drawn above, under irrigation or environment.",
  "1": "Saved.",
};
const ERRORS: Record<string, string> = {
  "export-size": "That file is over 3 MB. Export a shorter date range and upload again.",
  "export-empty": "Choose a file or paste the rows first.",
  "export-read": "No time column and no reading columns were found in that export. It needs a header row with a time or date column.",
  date: "That is not a date.",
  title: "Give the item a name.",
};

// A message is shown beside the thing it is about, because the page is long
// and every action lands back on its own section.
const WHERE: Record<string, "tasks" | "graphs"> = { checkin: "tasks", export: "graphs", "export-size": "graphs", "export-empty": "graphs", "export-read": "graphs", date: "tasks", title: "tasks" };

const phaseLine = (p?: Phase) => (p ? `${p.start}, ${p.shots} shot${p.shots === 1 ? "" : "s"} of ${p.shotMin} min${p.shots > 1 ? `, ${p.everyMin} min apart` : ""}` : "Not set");

export default async function RoomPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ saved?: string; err?: string }> }) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { facility, viewer, today } = await requireFacility(slug);
  const room = await store.room(id);
  if (!room || room.facilityId !== facility.id) notFound();
  const [cycle, checkins, cycles, open, upcoming, uploaded, board] = await Promise.all([
    store.activeCycle(room.id),
    store.checkinsForRoom(room.id, 200),
    store.cycles(facility.id),
    store.openEventsBefore(facility.id, addDays(today, 1)),
    store.eventsForRoom(room.id, facility.id, addDays(today, -7)),
    store.seriesForRoom(room.id, 6),
    loadBoard(facility.id, today),
  ]);
  const rb = board?.rooms.find((r) => r.room.id === room.id) ?? null;
  const flags = evaluateRoom({ room, cycle, checkins, events: open, today }).filter((f) => f.severity !== "info");
  const base = `/f/${facility.slug}`;
  const here = `${base}/rooms/${room.id}`;
  const entryHref = `${base}/checkin?room=${room.id}`;
  const day = cycle ? flowerDay(cycle.flipDate, today) : null;
  const past = cycles.filter((c) => c.roomId === room.id && c.status === "harvested").sort((a, b) => (b.harvestedOn ?? "").localeCompare(a.harvestedOn ?? ""));
  // Charts follow the active run; with none, the last finished one, so a
  // room between runs still shows what happened.
  const charted = cycle ?? past[0] ?? null;
  const rs = charted ? runReadings(checkins, charted) : [];
  const t = room.targets;
  const latest = checkins[0];
  const ec = ecSeries(rs, room);
  const vpd: Series[] = [
    {
      name: "VPD kPa",
      slot: "primary",
      band: t.vpd,
      dots: true,
      points: rs.filter((r) => r.c.tempF !== undefined && r.c.rh !== undefined).map((r) => ({ x: r.day, y: vpdKpa(r.c.tempF, r.c.rh) ?? 0 })),
    },
  ];
  const co2: Series[] = [{ name: "CO₂ ppm", slot: "fourth", band: t.co2, dots: true, points: rs.filter((r) => r.c.co2 !== undefined).map((r) => ({ x: r.day, y: r.c.co2! })) }];
  const now = nowOf(checkins);
  const weeks = Math.max(1, Math.ceil(room.flowerDays / 7));
  const week = day ? Math.min(weeks, Math.ceil(day / 7)) : 0;
  const built = buildSchedule(room.schedule, room.emittersPerPlant, room.emitterGph, room.containerGal);
  const lightsOn = parseHHMM(room.schedule?.lightsOn);
  const zoneEntry = checkins.find((c) => c.zones?.length);
  const zoneCount = Math.max(1, Math.floor(room.feedZones ?? 1));
  const substrate = uploaded.filter((s) => s.kind === "substrate");
  const environment = uploaded.filter((s) => s.kind === "environment");
  const sensors = facility.sensors ?? [];
  const live = sensors.find((s) => s.liveUrl && room.sensorPlatform && s.platform.toLowerCase() === room.sensorPlatform.toLowerCase()) ?? sensors.find((s) => s.liveUrl);
  const tone = !cycle ? "none" : flags.some((f) => f.severity === "missing") ? "miss" : flags.length ? "warn" : "ok";

  // Scheduled items for this room: everything open, plus what was closed in the last week.
  const items = new Map<string, CalEvent>();
  for (const e of open) if (e.roomId === room.id && e.kind !== "flip" && e.kind !== "harvest") items.set(e.id, e);
  for (const e of upcoming) if (e.kind !== "flip" && e.kind !== "harvest" && (!e.doneAt || diffDays(e.date, today) <= 7) && diffDays(today, e.date) <= 28) items.set(e.id, e);
  const scheduled = [...items.values()].sort((a, b) => a.date.localeCompare(b.date));
  const tasksToday = rb ? tally(rb.today) : null;

  const liveLink = (what: string) =>
    live ? (
      <a href={live.liveUrl} target="_blank" rel="noopener noreferrer" className="btn-small">
        Open {what} live in {live.platform}
      </a>
    ) : (
      <Link href={`${base}/profile#sensors`} className="py-1 text-xs font-semibold text-flare hover:underline">
        Connect {room.sensorPlatform || "a sensor platform"} for live {what}
      </Link>
    );

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/rooms">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            {room.kind} room{room.archivedAt ? " · archived" : ""}
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl">{room.name}</h1>
          {cycle && (
            <p className="mt-2 text-[15px] text-muted">
              <span className="font-semibold text-bone">Day {day ?? 0}</span> of {room.flowerDays} · {cycle.genetic || "Unnamed run"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={entryHref} className="btn-primary">
            Enter data
          </Link>
          <Link href={`${here}/edit`} className="btn-ghost">
            Edit room profile
          </Link>
        </div>
      </div>

      {cycle && week > 0 && (
        <ol className="mt-5 flex gap-1" aria-label={`The run by week: week ${week} of ${weeks}`}>
          {Array.from({ length: weeks }, (_, i) => {
            const state = i + 1 < week ? "done" : i + 1 === week ? "now" : "next";
            return (
              <li key={i} className="min-w-0 flex-1" aria-current={state === "now" ? "step" : undefined}>
                <span className={`block h-1.5 rounded-full ${state === "done" ? "bg-ok/70" : state === "now" ? "bg-flare" : "bg-line"}`} />
                <span className={`mt-1 block text-center text-[10px] ${state === "now" ? "font-semibold text-flare" : "text-muted"}`} aria-hidden="true">
                  W{i + 1}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-x-5 gap-y-1 border-b border-line text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
        {[
          ["#tasks", "Tasks"],
          ["#irrigation", "Irrigation"],
          ["#environment", "Environment"],
          ["#entries", "Entries"],
          ["#run", "Run"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="py-2.5 hover:text-bone">
            {label}
          </a>
        ))}
      </nav>

      {sp.saved && !WHERE[sp.saved] && <Note text={MESSAGES[sp.saved] ?? "Saved."} />}

      {/* ── Latest readings, as rings ── */}
      <section aria-label="Latest readings" className="card mt-6 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="eyebrow">Latest readings</p>
          <span className="text-xs text-muted">
            {now.day ? `Entered ${fmtDay(now.day)}` : "Nothing entered yet"}. Green is inside the setpoint, amber is outside it.
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 xl:grid-cols-8">
          <Gauge label="Temp" unit="°F" value={now.tempF} range={t.tempF} />
          <Gauge label="RH" unit="%" value={now.rh} range={t.rh} />
          <Gauge label="VPD" unit="kPa" value={now.vpd} range={t.vpd} digits={2} />
          <Gauge label="CO₂" unit="ppm" value={now.co2} range={t.co2} />
          <Gauge label="Substrate WC" unit="%" value={now.substrateWc} />
          <Gauge label="Substrate EC" unit="mS/cm" value={now.substrateEc} />
          <Gauge label="Runoff EC" unit="mS/cm" value={now.runoffEc} ceiling={t.runoffEcMax} />
          <Gauge label="Runoff" unit="%" value={now.runoffPct} range={t.runoffPct} digits={1} />
        </div>
      </section>

      {/* ── The room and its profile ── */}
      <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_1fr]" aria-label="Room profile">
        <div className="card p-4 sm:p-5">
          <RoomVisual room={room} tone={tone} />
          {flags.length > 0 && (
            <ul className="mt-3 space-y-0.5 border-t border-line pt-3 text-sm text-muted">
              {flags.map((f, i) => (
                <li key={`${f.code}-${i}`} className="flex items-start gap-2">
                  <span className={`dot mt-[7px] ${f.severity === "missing" ? "dot-miss" : "dot-warn"}`} aria-hidden="true" />
                  {f.text}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="eyebrow">Room profile</p>
            <Link href={`${here}/edit`} className="py-1 text-xs font-semibold text-flare hover:underline">
              Edit the room profile
            </Link>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-sm">
            <dt className="text-muted">Day of flower</dt>
            <dd className="text-bone">{cycle ? `${day ?? 0} of ${room.flowerDays}, flipped ${fmtDay(cycle.flipDate)}` : "No active run"}</dd>
            <dt className="text-muted">Genetics</dt>
            <dd className="text-bone">{cycle?.genetic || room.genetics || "Not recorded"}</dd>
            <dt className="text-muted">Feed EC / pH</dt>
            <dd className="text-bone">
              {t.feedEc ? `${t.feedEc[0]} to ${t.feedEc[1]} target` : "No target"}
              {latest?.feedEc !== undefined ? ` · last ${latest.feedEc}${latest.feedPh !== undefined ? ` / ${latest.feedPh}` : ""}` : ""}
            </dd>
            <dt className="text-muted">Lighting</dt>
            <dd className="text-bone">
              {room.schedule ? `${room.schedule.lightsOn} to ${room.schedule.lightsOff}${built.photoperiodMin ? ` (${Math.round((built.photoperiodMin / 60) * 10) / 10} h)` : ""}` : "Schedule not set"}
              {t.ppfd ? ` · PPFD ${t.ppfd[0]} to ${t.ppfd[1]}` : ""}
            </dd>
            <dt className="text-muted">Target temp</dt>
            <dd className="text-bone">{t.tempF[0]} to {t.tempF[1]} °F</dd>
            <dt className="text-muted">Target RH</dt>
            <dd className="text-bone">{t.rh[0]} to {t.rh[1]} %</dd>
            <dt className="text-muted">P1 timing</dt>
            <dd className="text-bone">{phaseLine(room.schedule?.p1)}</dd>
            <dt className="text-muted">P2 timing</dt>
            <dd className="text-bone">{phaseLine(room.schedule?.p2)}</dd>
            <dt className="text-muted">Lights</dt>
            <dd className="text-bone">{room.fixtureCount ? `${room.fixtureCount} × ${room.fixtureModel || "fixtures"}` : room.fixtureModel || "Not recorded"}</dd>
            <dt className="text-muted">Substrate</dt>
            <dd className="text-bone">
              {room.substrate}
              {room.containerGal ? `, ${room.containerGal} gal` : ""}
            </dd>
            <dt className="text-muted">Drippers</dt>
            <dd className="text-bone">
              {room.emittersPerPlant} per plant at {room.emitterGph} GPH
            </dd>
            <dt className="text-muted">Sensors</dt>
            <dd className="text-bone">{room.sensorPlatform || "Not recorded"}</dd>
          </dl>
        </div>
      </section>

      {/* ── Tasks ── */}
      <section id="tasks" className="mt-10 scroll-mt-28">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl text-bone">Tasks</h2>
          {tasksToday && (
            <span className="flex items-center gap-2 text-sm text-muted">
              <span className={`dot ${tasksToday.done === tasksToday.total ? "dot-ok" : "dot-warn"}`} aria-hidden="true" />
              {tasksToday.done}/{tasksToday.total} today
            </span>
          )}
        </div>
        {sp.saved && WHERE[sp.saved] === "tasks" && <Note text={MESSAGES[sp.saved]} />}
        {sp.err && WHERE[sp.err] === "tasks" && <Note text={ERRORS[sp.err]} bad />}
        {rb ? (
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="card min-w-0 p-4 sm:p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">{fmtDay(today, { weekday: "long", month: "short", day: "numeric" })}</h3>
              <div className="mt-2">
                <TodayList states={rb.today} slug={facility.slug} roomId={room.id} day={today} back={`${here}#tasks`} entryHref={entryHref} />
              </div>
              <p className="mt-3 border-t border-line pt-3 text-xs text-muted">{URGENT_LINE}</p>
            </div>
            <div className="min-w-0 space-y-6">
              <div className="card min-w-0 p-4 sm:p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Week of {fmtDay(rb.week[0].day)}</h3>
                <div className="mt-2">
                  <WeekGrid week={rb.week} today={today} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="card mt-4 px-5 py-4 text-sm text-muted">{room.kind === "flower" ? "The daily list starts when the room has a run on." : "The daily list runs on flower rooms. Scheduled items for this room are below."}</p>
        )}

        <div className="card mt-6 p-4 sm:p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Scheduled for this room</h3>
          <ul className="mt-2 divide-y divide-line">
            {scheduled.length === 0 && <li className="py-2.5 text-sm text-muted">Nothing scheduled.</li>}
            {scheduled.map((e) => {
              const late = !e.doneAt && diffDays(e.date, today) > 0;
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[15px]">
                  <form action={toggleEvent} className="flex">
                    <input type="hidden" name="slug" value={facility.slug} />
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="back" value={`${here}#tasks`} />
                    <button
                      type="submit"
                      aria-pressed={!!e.doneAt}
                      aria-label={e.doneAt ? `"${e.title}" is done. Untick it` : `Tick "${e.title}"`}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border text-sm font-bold hover:border-flare ${e.doneAt ? "border-ok bg-ok text-ink" : "border-edge text-transparent"}`}
                    >
                      ✓
                    </button>
                  </form>
                  <span className={`w-16 shrink-0 text-sm ${late ? "font-semibold text-miss" : "text-muted"}`}>{fmtDay(e.date)}</span>
                  <span className={`min-w-0 flex-1 ${e.doneAt ? "text-muted" : "text-bone"}`}>
                    {e.title}
                    <span className="ml-2 text-xs text-muted">{e.owner === "rgs" ? "consultant" : "grower"}</span>
                  </span>
                  <form action={deleteEvent}>
                    <input type="hidden" name="slug" value={facility.slug} />
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="back" value={`${here}#tasks`} />
                    <button type="submit" className="py-1 text-xs font-semibold text-muted hover:text-miss" aria-label={`Remove "${e.title}"`}>
                      Remove
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
          <details className="mt-2 border-t border-line pt-3">
            <summary className="cursor-pointer text-sm font-semibold text-flare">Schedule something for this room</summary>
            <form action={saveEvent} className="mt-3 grid gap-3 sm:grid-cols-[1fr_170px_150px_auto] sm:items-end">
              <input type="hidden" name="slug" value={facility.slug} />
              <input type="hidden" name="roomId" value={room.id} />
              <input type="hidden" name="back" value={`${here}#tasks`} />
              <input type="hidden" name="kind" value="task" />
              <div>
                <label className="label" htmlFor="ev-title">
                  What
                </label>
                <input id="ev-title" name="title" className="field" maxLength={120} placeholder="Defoliation, day 21" required />
              </div>
              <div>
                <label className="label" htmlFor="ev-date">
                  When
                </label>
                <input id="ev-date" name="date" type="date" className="field" defaultValue={today} required />
              </div>
              <div>
                <label className="label" htmlFor="ev-owner">
                  Who
                </label>
                <select id="ev-owner" name="owner" className="field" defaultValue="client">
                  <option value="client">Grower</option>
                  <option value="rgs">Consultant</option>
                </select>
              </div>
              <button type="submit" className="btn-ghost">
                Add
              </button>
            </form>
          </details>
        </div>
      </section>

      {/* ── Irrigation ── */}
      <section id="irrigation" className="mt-12 scroll-mt-28">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl text-bone">Irrigation</h2>
          {liveLink("irrigation graphs")}
        </div>
        <div className="card mt-4 p-4 sm:p-5">
          <ScheduleView room={room} editHref={`${here}/edit#schedule`} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="card min-w-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-lg text-bone">
                Feed against runoff EC
                {charted && <span className="ml-2 text-sm font-normal text-muted">{charted.status === "harvested" ? "last run" : "this run"}</span>}
              </h3>
              <Legend series={ec} />
            </div>
            <div className="mt-3">
              <LineChart series={ec} yLabel="mS/cm" marker={day ?? undefined} ariaLabel={`Feed and runoff EC for ${room.name} by flower day`} />
            </div>
          </div>
          <div className="card min-w-0 p-4 sm:p-5">
            <h3 className="text-lg text-bone">Runoff %</h3>
            <p className="text-xs text-muted">Target {t.runoffPct[0]} to {t.runoffPct[1]}</p>
            <div className="mt-2">
              <LineChart series={runoffSeries(rs, room)} width={400} height={240} ariaLabel={`Runoff percentage for ${room.name}`} />
            </div>
          </div>
        </div>

        <div className="card mt-6 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg text-bone">
              Runoff by feed zone
              {zoneEntry && <span className="ml-2 text-sm font-normal text-muted">{zoneEntry.dayOfFlower !== undefined ? `day ${zoneEntry.dayOfFlower}, ` : ""}{fmtDay(zoneEntry.day)}</span>}
            </h3>
            <Link href={entryHref} className="py-1 text-xs font-semibold text-flare hover:underline">
              Enter runoff reads
            </Link>
          </div>
          {zoneEntry?.zones?.length ? (
            <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Runoff by feed zone, scrolls sideways on a phone">
              <table className="tbl min-w-[420px]">
                <thead>
                  <tr>
                    <th scope="col">Zone</th>
                    <th scope="col">Read</th>
                    <th scope="col">EC</th>
                    <th scope="col">pH</th>
                    <th scope="col">Volume, mL</th>
                  </tr>
                </thead>
                <tbody>
                  {zoneEntry.zones.map((z) => (
                    <tr key={`${z.zone}-${z.source}-${z.n}`}>
                      <td className="font-semibold">Zone {z.zone}</td>
                      <td className="text-muted">{z.source === "row" ? "Whole row" : `Plant ${z.n === 1 ? "A" : "B"}`}</td>
                      <td className={z.ec !== undefined && t.runoffEcMax !== undefined && z.ec > t.runoffEcMax ? "font-semibold text-warn" : ""}>{z.ec ?? (z.ml === 0 ? "N/A" : "")}</td>
                      <td>{z.ph ?? (z.ml === 0 ? "N/A" : "")}</td>
                      <td>{z.ml ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">
              No zone reads yet. This room has {zoneCount} feed zone{zoneCount === 1 ? "" : "s"}; each gets two plants, or a whole-row collection.{" "}
              <Link href={`${base}/guide`} className="font-semibold text-flare hover:underline">
                How to take a runoff read
              </Link>
            </p>
          )}
        </div>

        {substrate.map((s) => (
          <div key={s.id} className="card mt-6 p-4 sm:p-5">
            <h3 className="text-lg text-bone">Substrate sensors</h3>
            <div className="mt-1">
              <SeriesCharts series={s} flipDate={charted?.flipDate} slug={facility.slug} timezone={facility.timezone} />
            </div>
          </div>
        ))}
      </section>

      {/* ── Environment ── */}
      <section id="environment" className="mt-12 scroll-mt-28">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl text-bone">Environment</h2>
          {liveLink("environment graphs")}
        </div>
        <p className="mt-2 text-xs text-muted">From the dated entries, against the setpoints on the room profile. VPD is air VPD worked out from temperature and RH.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            { title: "Temperature °F", series: tempSeries(rs, room), label: `Temperature for ${room.name}` },
            { title: "RH %", series: rhSeries(rs, room), label: `Relative humidity for ${room.name}` },
            { title: "VPD kPa", series: vpd, label: `Vapour pressure deficit for ${room.name}` },
            { title: "CO₂ ppm", series: co2, label: `Carbon dioxide for ${room.name}` },
          ].map((c) => (
            <div key={c.title} className="card min-w-0 p-4">
              <h3 className="text-sm font-semibold text-bone">{c.title}</h3>
              <div className="mt-2">
                <LineChart series={c.series} width={400} height={210} marker={day ?? undefined} ariaLabel={c.label} />
              </div>
            </div>
          ))}
        </div>
        {environment.map((s) => (
          <div key={s.id} className="card mt-6 p-4 sm:p-5">
            <h3 className="text-lg text-bone">Environment sensors</h3>
            <div className="mt-1">
              <SeriesCharts series={s} flipDate={charted?.flipDate} slug={facility.slug} timezone={facility.timezone} />
            </div>
          </div>
        ))}
      </section>

      {/* ── Sensor exports ── */}
      <section id="graphs" className="card mt-10 scroll-mt-28 p-4 sm:p-5">
        <h2 className="text-lg text-bone">Add a sensor graph</h2>
        {sp.saved && WHERE[sp.saved] === "graphs" && <Note text={MESSAGES[sp.saved]} />}
        {sp.err && WHERE[sp.err] === "graphs" && <Note text={ERRORS[sp.err]} bad />}
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Export the room from {room.sensorPlatform || "Aroya, Growlink or TrolMaster"} as a CSV and upload it. Water content, substrate EC, temperature, RH, VPD and CO₂ columns are read by their headers and drawn above, under irrigation or environment.
        </p>
        <form action={uploadSeries} className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <input type="hidden" name="slug" value={facility.slug} />
          <input type="hidden" name="roomId" value={room.id} />
          <div>
            <label className="label" htmlFor="export">
              CSV export, up to 3 MB
            </label>
            <input id="export" name="export" type="file" accept=".csv,text/csv,text/plain" className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border file:border-edge file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-bone" />
          </div>
          <div>
            <label className="label" htmlFor="paste">
              Or paste the rows
            </label>
            <textarea id="paste" name="paste" className="field min-h-[44px]" rows={1} placeholder="time,wc,ec" />
          </div>
          <button type="submit" className="btn-ghost">
            Upload and draw
          </button>
        </form>
      </section>

      {/* ── Entries ── */}
      <section id="entries" className="mt-12 scroll-mt-28">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl text-bone">Entries by date</h2>
          <span className="text-xs text-muted">Newest first.</span>
        </div>
        <div className="mt-3">
          <EntryLog checkins={checkins} timezone={facility.timezone} editBase={entryHref} />
        </div>
      </section>

      {/* ── The run ── */}
      <section id="run" className="mt-12 grid scroll-mt-28 gap-6 lg:grid-cols-2">
        <div className="card p-5">
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
                    <span className="hint">Feeds the grams per square foot on the quarterly report.</span>
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
              <p className="mt-2 text-sm text-muted">{room.kind === "flower" ? "No active run. Start one when the room flips." : "Runs are tracked on flower rooms."}</p>
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
                  </div>
                  <div>
                    <label className="label" htmlFor="plannedHarvest">
                      Planned harvest (optional)
                    </label>
                    <input id="plannedHarvest" name="plannedHarvest" type="date" className="field" />
                    <span className="hint">Blank uses the {room.flowerDays}-day flower duration on the profile.</span>
                  </div>
                  <button type="submit" className="btn-primary w-full">
                    Start the run
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <div className="card p-5">
          <p className="eyebrow">Past runs</p>
          {past.length === 0 && <p className="mt-2 text-sm text-muted">None recorded yet.</p>}
          <ul className="mt-2 space-y-2 text-sm">
            {past.map((c) => (
              <li key={c.id} className="text-muted">
                <span className="text-bone">{c.genetic || "Run"}</span>, {fmtDay(c.flipDate)} to {c.harvestedOn ? fmtDay(c.harvestedOn) : "?"}
                {c.outcome?.dryGrams && room.canopySqft ? `, ${(c.outcome.dryGrams / room.canopySqft).toFixed(1)} g/sq ft` : c.outcome?.dryGrams ? `, ${c.outcome.dryGrams} g dry` : ""}
                {c.outcome?.note ? `. ${c.outcome.note}` : ""}
              </li>
            ))}
          </ul>
          {latest && (
            <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
              Last entry {fmtWhen(latest.at, facility.timezone)} by the {latest.submittedBy === "rgs" ? "consultant" : "grower"}.
            </p>
          )}
          {lightsOn === null && room.kind === "flower" && (
            <p className="mt-2 text-xs text-muted">
              The lighting and irrigation schedule is not on the profile yet.{" "}
              <Link href={`${here}/edit#schedule`} className="font-semibold text-flare hover:underline">
                Add the schedule
              </Link>
            </p>
          )}
        </div>
      </section>
    </Shell>
  );
}

function Note({ text, bad = false }: { text: string; bad?: boolean }) {
  return bad ? (
    <p className="error mt-3" role="alert">
      {text}
    </p>
  ) : (
    <p className="mt-3 rounded-lg border border-ok/50 bg-ink-panel px-4 py-3 text-sm text-bone" role="status">
      {text}
    </p>
  );
}
