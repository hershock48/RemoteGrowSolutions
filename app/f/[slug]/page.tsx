import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/Shell";
import RoomVisual from "@/components/RoomVisual";
import { TodayList, WeekStrip } from "@/components/TaskList";
import { loadBoard } from "@/lib/board";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { addDays, diffDays, fmtDay, minutesNowIn } from "@/lib/dates";
import { isLit } from "@/lib/schedule";
import { timeline } from "@/lib/series";
import { READINESS } from "@/lib/site";
import { tally } from "@/lib/tasks";

export const metadata: Metadata = { title: "Home" };

/**
 * Home, the same on both sides: the facility profile first, then every
 * flower room as a card. A card is the room drawn from its profile, where
 * the run stands, four coloured marks (environment, feed, runoff, tasks) and
 * the checklist for today. Colour and ticks carry the status; nothing on this
 * page tells anybody what to do in words (Jake, 2026-11-16: no counters, no
 * "needs a look", no "1 of 3, 2 to go", and no tab for the week).
 */

type Tone = "ok" | "warn" | "miss" | "none";
const DOT: Record<Tone, string> = { ok: "dot-ok", warn: "dot-warn", miss: "dot-miss", none: "dot-info" };
const FILL: Record<Tone, string> = { ok: "bg-ok", warn: "bg-warn", miss: "bg-miss", none: "bg-muted" };
const ENVIRONMENT = ["temp", "rh", "vpd", "co2", "ppfd"];
const RUNOFF = ["runoff-pct", "runoff-ec"];

export default async function Home({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { facility, viewer, today } = await requireFacility(slug);
  const board = (await loadBoard(facility.id, today))!;
  const d = board.dash;
  const [reports, calls] = await Promise.all([store.reports(facility.id), store.calls(facility.id)]);
  const latestReport = reports.find((r) => viewer === "rgs" || r.status === "approved");
  const base = `/f/${facility.slug}`;
  const flower = d.rooms.filter((r) => r.kind === "flower");
  const others = d.rooms.filter((r) => r.kind !== "flower");
  const facilityWide = d.events.filter((e) => !e.roomId && !e.doneAt && diffDays(today, e.date) >= 0).slice(0, 4);
  const ready = READINESS[facility.readiness];
  const sensors = facility.sensors ?? [];
  const nowMin = minutesNowIn(facility.timezone);

  // The first-week path. Shown until every step is done, then never again.
  const steps = [
    { name: "Add a room and its profile", done: d.rooms.length > 0, href: `${base}/rooms/new` },
    { name: "First day of data entered", done: [...d.recent.values()].some((l) => l.length > 0), href: `${base}/rooms` },
    { name: "First call written up", done: calls.length > 0, href: viewer === "rgs" ? `${base}/notes/new` : `${base}/notes` },
    { name: "First report approved", done: reports.some((r) => r.status === "approved"), href: `${base}/reports` },
  ];
  const onboarding = steps.some((s) => !s.done);

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="">
      <p className="eyebrow">{fmtDay(today, { weekday: "long", month: "long", day: "numeric" })}</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">{facility.name}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted">
        <span className={`dot ${facility.readiness === "qualified" ? "dot-ok" : facility.readiness === "conditional" ? "dot-warn" : "dot-miss"}`} aria-hidden="true" />
        <span className="font-semibold text-bone">{ready.name}.</span>
        <span>{facility.readinessNote || ready.body}</span>
      </p>

      {/* ── The facility, first, on both sides ── */}
      <section className="card mt-6 grid gap-x-10 gap-y-5 p-5 sm:p-6 md:grid-cols-[1.2fr_1fr]" aria-label="Facility profile">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="eyebrow">Facility profile</p>
            <Link href={`${base}/profile`} className="py-1 text-xs font-semibold text-flare hover:underline">
              Edit the profile
            </Link>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Contact</dt>
            <dd className="text-bone">{[facility.contact, facility.phone, facility.email].filter(Boolean).join(" · ") || "Not filled in yet"}</dd>
            <dt className="text-muted">Where</dt>
            <dd className="text-bone">{facility.state || "Not filled in yet"}</dd>
            <dt className="text-muted">Rooms</dt>
            <dd className="text-bone">
              {facility.flowerRooms} flower{facility.vegRooms ? `, ${facility.vegRooms} veg` : ""}{facility.momRooms ? `, ${facility.momRooms} mother` : ""}
            </dd>
            <dt className="text-muted">Lights</dt>
            <dd className="text-bone">
              {facility.lightsTotal} flowering{facility.canopySqft ? ` over ${facility.canopySqft.toLocaleString("en-US")} sq ft` : ""}
            </dd>
            <dt className="text-muted">Irrigation</dt>
            <dd className="text-bone">{facility.equipment.irrigation || "Not filled in yet"}</dd>
          </dl>
        </div>
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="eyebrow">Sensor platforms</p>
            <Link href={`${base}/profile#sensors`} className="py-1 text-xs font-semibold text-flare hover:underline">
              {sensors.length ? "Edit the platforms" : "Add a platform"}
            </Link>
          </div>
          {sensors.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {sensors.map((s, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="flex items-center gap-2 font-semibold text-bone">
                    <span className={`dot ${s.liveUrl || s.key ? "dot-ok" : "dot-warn"}`} aria-hidden="true" />
                    {s.platform}
                  </span>
                  <span className="text-muted">
                    {s.access || "Access not set up"}
                    {s.key ? " · API key on file" : ""}
                  </span>
                  {s.liveUrl && (
                    <a href={s.liveUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-flare hover:underline">
                      Open {s.platform} live graphs
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">{facility.equipment.sensors || "No platform recorded yet. Aroya, Growlink and TrolMaster are set up on the profile."}</p>
          )}
        </div>
      </section>

      {onboarding && (
        <ol className="card mt-6 grid gap-px overflow-hidden bg-line sm:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.name} className="flex items-center gap-3 bg-ink-panel px-4 py-3">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.done ? "bg-ok text-ink" : "border border-edge text-muted"}`} aria-hidden="true">
                {s.done ? "✓" : i + 1}
              </span>
              {s.done ? (
                <span className="text-sm text-muted">{s.name}</span>
              ) : (
                <Link href={s.href} className="text-sm font-semibold text-bone hover:text-flare">
                  {s.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}

      {/* ── Every flower room ── */}
      <section className="mt-10" aria-label="Flower rooms">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl text-bone">Flower rooms</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Colour key">
            <li className="flex items-center gap-1.5">
              <span className="dot dot-ok" aria-hidden="true" />
              in range, done
            </li>
            <li className="flex items-center gap-1.5">
              <span className="dot dot-warn" aria-hidden="true" />
              out of range, open
            </li>
            <li className="flex items-center gap-1.5">
              <span className="dot dot-miss" aria-hidden="true" />
              no data
            </li>
          </ul>
        </div>
        {flower.length === 0 && (
          <p className="card mt-4 px-5 py-4 text-sm text-muted">
            No flower rooms yet.{" "}
            <Link href={`${base}/rooms/new`} className="font-semibold text-flare hover:underline">
              Add the first one.
            </Link>
          </p>
        )}
        <ul className="mt-4 grid gap-4 xl:grid-cols-2">
          {flower.map((room) => {
            const rb = board.rooms.find((r) => r.room.id === room.id);
            const flags = d.flags.filter((f) => f.roomId === room.id);
            const has = (codes: string[]) => flags.some((f) => codes.includes(f.code));
            const stale = flags.some((f) => f.severity === "missing");
            const latest = d.recent.get(room.id)?.[0];
            const t = rb ? tally(rb.today) : { done: 0, total: 0 };
            const marks: { name: string; tone: Tone }[] = [
              { name: "Environment", tone: !latest || latest.tempF === undefined ? "miss" : has(ENVIRONMENT) ? "warn" : "ok" },
              { name: "Feed", tone: !latest || latest.feedEc === undefined ? "miss" : has(["feed-ec"]) ? "warn" : "ok" },
              { name: "Runoff", tone: !latest || latest.runoffEc === undefined ? "miss" : has(RUNOFF) ? "warn" : "ok" },
              { name: "Tasks", tone: !rb || t.total === 0 ? "none" : t.done === t.total ? "ok" : stale ? "miss" : "warn" },
            ];
            const tone: Tone = !rb ? "none" : stale ? "miss" : flags.some((f) => f.severity === "attention") ? "warn" : "ok";
            const tl = rb ? timeline(room, rb.cycle, today) : null;
            const out = flags.filter((f) => f.severity !== "info");
            return (
              <li key={room.id} className="card flex flex-col p-4 sm:p-5">
                <div className="grid gap-x-5 gap-y-3 sm:grid-cols-[210px_1fr] sm:items-start">
                  <Link href={`${base}/rooms/${room.id}`} aria-label={`Open ${room.name}`} className="block">
                    <RoomVisual room={room} tone={tone} compact progress={tl?.frac} lit={isLit(room.schedule, nowMin)} />
                  </Link>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h3 className="font-display text-xl font-bold">
                        <Link href={`${base}/rooms/${room.id}`} className="text-bone hover:text-flare">
                          {room.name}
                        </Link>
                      </h3>
                      <span className="text-[13px] text-muted">{rb ? rb.cycle.genetic || "Current run" : "No active run"}</span>
                    </div>
                    {tl ? (
                      <>
                        <div className="mt-1 flex items-baseline justify-between text-[13px]">
                          <span className="font-semibold text-bone">
                            Day {tl.day} <span className="font-normal text-muted">of {tl.total}</span>
                          </span>
                          <span className="text-muted">{tl.over ? `${tl.over} day${tl.over === 1 ? "" : "s"} past planned harvest` : `harvest ${fmtDay(tl.harvestOn)}`}</span>
                        </div>
                        <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink" role="img" aria-label={`${room.name} day ${tl.day} of ${tl.total}`}>
                          <div className={`h-full rounded-full ${FILL[tone]}`} style={{ width: `${tl.frac * 100}%` }} />
                        </div>
                      </>
                    ) : (
                      <p className="mt-1 text-[13px] text-muted">
                        <Link href={`${base}/rooms/${room.id}#run`} className="font-semibold text-flare hover:underline">
                          Start the run
                        </Link>{" "}
                        when the room flips.
                      </p>
                    )}
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]" aria-label={`${room.name} status`}>
                      {marks.map((m) => (
                        <li key={m.name} className="flex items-center gap-1.5 text-bone/90">
                          <span className={`dot ${DOT[m.tone]}`} aria-hidden="true" />
                          {m.name}
                          {m.name === "Tasks" && t.total > 0 && (
                            <span className="text-muted">
                              {t.done}/{t.total}
                            </span>
                          )}
                          <span className="sr-only">{m.tone === "ok" ? ": in range" : m.tone === "warn" ? ": open or out of range" : m.tone === "miss" ? ": no data" : ""}</span>
                        </li>
                      ))}
                    </ul>
                    {out.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-[13px] text-muted">
                        {out.map((f, i) => (
                          <li key={`${f.code}-${i}`} className="flex items-start gap-2">
                            <span className={`dot mt-[6px] ${f.severity === "missing" ? "dot-miss" : "dot-warn"}`} aria-hidden="true" />
                            {f.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                {rb && (
                  <div className="mt-4 border-t border-line pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <WeekStrip week={rb.week} today={today} />
                      <Link href={`${base}/checkin?room=${room.id}`} className={viewer === "client" && t.done < t.total ? "btn-primary !min-h-[40px] !px-4 !py-2 text-xs" : "btn-small"}>
                        Enter data for {room.name}
                      </Link>
                    </div>
                    <div className="mt-3 sm:columns-2 sm:gap-6">
                      <TodayList states={rb.today} slug={facility.slug} roomId={room.id} day={today} back={base} entryHref={`${base}/checkin?room=${room.id}`} interactive={false} dense />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {others.length > 0 && (
          <p className="mt-4 text-sm text-muted">
            Advisory rooms:{" "}
            {others.map((r, i) => (
              <span key={r.id}>
                {i > 0 ? ", " : ""}
                <Link href={`${base}/rooms/${r.id}`} className="text-bone hover:text-flare">
                  {r.name}
                </Link>
              </span>
            ))}
            .
          </p>
        )}
      </section>

      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-lg text-bone">Facility dates</h2>
          <ul className="card mt-3 divide-y divide-line">
            {facilityWide.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nothing scheduled.</li>}
            {facilityWide.map((e) => (
              <li key={e.id} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                <span className="w-14 shrink-0 text-muted">{fmtDay(e.date)}</span>
                <span className="text-bone">{e.title}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg text-bone">Latest report</h2>
            <Link href={`${base}/reports`} className="text-xs font-semibold text-flare hover:underline">
              All reports
            </Link>
          </div>
          {latestReport ? (
            <Link href={`${base}/reports/${latestReport.id}`} className="card mt-3 block p-4 hover:border-flare">
              <p className="font-semibold text-bone">
                Week of {fmtDay(latestReport.weekOf)} to {fmtDay(addDays(latestReport.weekOf, 6))}
              </p>
              <p className="mt-1 text-sm text-muted">
                {latestReport.status === "approved" ? "Approved" : "Draft, not yet sent"} · {latestReport.actions.length} action{latestReport.actions.length === 1 ? "" : "s"}
              </p>
            </Link>
          ) : (
            <p className="card mt-3 p-4 text-sm text-muted">No report yet. The first one follows the first weekly call.</p>
          )}
        </section>
      </div>
    </Shell>
  );
}
