import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/Shell";
import FlagList from "@/components/FlagList";
import { loadDashboard, requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { addDays, diffDays, fmtDay, weekStart } from "@/lib/dates";
import { compliance, EXPECTED_PER_WEEK, timeline } from "@/lib/series";
import { READINESS } from "@/lib/site";
import type { Flag } from "@/lib/rules";

export const metadata: Metadata = { title: "Overview" };

/**
 * The morning screen, in order of weight: the rooms that need a look, then
 * every run as a bar from flip to harvest with its check-in compliance
 * beside it, then the week and the latest report, demoted. Dates lead with
 * the flower day. Status colours the left edge of every row, because the
 * counters were the only place status read from across a room.
 */
export default async function Overview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { facility, viewer, today } = await requireFacility(slug);
  const d = await loadDashboard(facility, today);
  const fourWeeksAgo = addDays(weekStart(today), -21);
  const [reports, calls, recent4] = await Promise.all([store.reports(facility.id), store.calls(facility.id), store.checkinsBetween(facility.id, fourWeeksAgo, today)]);
  const latestReport = reports.find((r) => viewer === "rgs" || r.status === "approved");
  const base = `/f/${facility.slug}`;
  const flower = d.rooms.filter((r) => r.kind === "flower");
  const others = d.rooms.filter((r) => r.kind !== "flower");
  const upcoming = d.events.filter((e) => !e.doneAt && diffDays(today, e.date) >= 0).slice(0, 6);
  const overdue = d.events.filter((e) => !e.doneAt && diffDays(e.date, today) > 0);
  const ready = READINESS[facility.readiness];
  const worstOf = (roomId: string): Flag["severity"] | "ok" => {
    const fs = d.flags.filter((f) => f.roomId === roomId);
    if (fs.some((f) => f.severity === "missing")) return "missing";
    if (fs.some((f) => f.severity === "attention")) return "attention";
    return "ok";
  };
  const EDGE = { ok: "border-l-ok", attention: "border-l-warn", missing: "border-l-miss", info: "border-l-edge" } as const;
  const FILL = { ok: "bg-ok", attention: "bg-warn", missing: "bg-miss", info: "bg-muted" } as const;

  // The first-week path. Shown until every step is done, then never again.
  const steps = [
    { name: "Add a room and its targets", done: d.rooms.length > 0, href: `${base}/rooms/new` },
    { name: "First check-in", done: [...d.recent.values()].some((l) => l.length > 0), href: `${base}/checkin` },
    { name: "First call written up", done: calls.length > 0, href: viewer === "rgs" ? `${base}/notes/new` : `${base}/notes` },
    { name: "First report approved", done: reports.some((r) => r.status === "approved"), href: `${base}/reports` },
  ];
  const onboarding = steps.some((s) => !s.done);

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{fmtDay(today, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-2 text-3xl sm:text-4xl">{facility.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            <span className={`dot ${facility.readiness === "qualified" ? "dot-ok" : facility.readiness === "conditional" ? "dot-warn" : "dot-miss"}`} aria-hidden="true" />
            <span className="font-semibold text-bone">{ready.name}.</span>
            <span>{facility.readinessNote || ready.body}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/checkin`} className="btn-primary">
            New check-in
          </Link>
          <Link href={`${base}/calendar`} className="btn-ghost">
            This week
          </Link>
        </div>
      </div>

      <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <Stat label="Flower rooms" value={d.summary.rooms} />
        <Stat label="On target" value={d.summary.onTarget} tone="text-ok" />
        <Stat label="Need attention" value={d.summary.flagged} tone={d.summary.flagged ? "text-warn" : undefined} />
        <Stat label="Missing check-ins" value={d.summary.missing} tone={d.summary.missing ? "text-miss" : undefined} />
      </dl>

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

      {/* ── The one big thing ── */}
      <section className="mt-10">
        <h2 className="text-2xl text-bone">Rooms needing a look</h2>
        <div className="mt-4">
          <FlagList flags={d.flags} base={base} large />
        </div>
      </section>

      {/* ── Every run as a bar ── */}
      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl text-bone">Runs</h2>
          <p className="text-xs text-muted">Bar: flip to planned harvest, today marked. Dots: check-ins received, {EXPECTED_PER_WEEK} expected a week, last four weeks.</p>
        </div>
        <ul className="mt-4 space-y-2">
          {flower.length === 0 && (
            <li className="card px-5 py-4 text-sm text-muted">
              No flower rooms yet.{" "}
              <Link href={`${base}/rooms/new`} className="font-semibold text-flare hover:underline">
                Add the first one.
              </Link>
            </li>
          )}
          {flower.map((r) => {
            const cycle = d.activeCycle.get(r.id);
            const tl = cycle ? timeline(r, cycle, today) : null;
            const sev = worstOf(r.id);
            const weeks = compliance(recent4.filter((c) => c.roomId === r.id), today);
            const latest = d.recent.get(r.id)?.[0];
            return (
              <li key={r.id} className={`card grid gap-x-6 gap-y-3 border-l-[3px] ${EDGE[sev]} px-5 py-4 md:grid-cols-[180px_1fr_auto] md:items-center`}>
                <div className="min-w-0">
                  <Link href={`${base}/rooms/${r.id}`} className="font-display text-lg font-bold text-bone hover:text-flare">
                    {r.name}
                  </Link>
                  <p className="text-[13px] text-muted">{cycle ? cycle.genetic || "Current run" : "No active run"}</p>
                </div>
                <div className="min-w-0">
                  {tl ? (
                    <>
                      <div className="flex items-baseline justify-between text-[13px]">
                        <span className="font-semibold text-bone">
                          Day {tl.day} <span className="font-normal text-muted">of {tl.total}</span>
                        </span>
                        <span className="text-muted">{tl.over ? `${tl.over} day${tl.over === 1 ? "" : "s"} past planned harvest` : `harvest ${fmtDay(tl.harvestOn)}`}</span>
                      </div>
                      <div className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-ink" role="img" aria-label={`${r.name} day ${tl.day} of ${tl.total}`}>
                        <div className={`h-full rounded-full ${FILL[sev]}`} style={{ width: `${tl.frac * 100}%` }} />
                        <div className="absolute top-0 h-full w-px bg-bone" style={{ left: `${tl.frac * 100}%` }} aria-hidden="true" />
                      </div>
                    </>
                  ) : (
                    <div className="h-2.5 w-full rounded-full border border-dashed border-line" aria-hidden="true" />
                  )}
                  <p className="mt-1.5 text-xs text-muted">
                    {latest ? `Last check-in ${latest.dayOfFlower ? `day ${latest.dayOfFlower}, ` : ""}${fmtDay(latest.day)}${latest.runoffPct !== undefined ? ` · runoff ${latest.runoffPct.toFixed(1)}%` : ""}${latest.runoffEc !== undefined ? ` · runoff EC ${latest.runoffEc}` : ""}` : "No check-ins yet"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <ol className="flex gap-2" aria-label={`${r.name} check-ins, last four weeks`}>
                    {weeks.map((w) => (
                      <li key={w.weekOf} className="flex gap-0.5" title={`Week of ${fmtDay(w.weekOf)}: ${w.count} of ${EXPECTED_PER_WEEK}${w.current ? " so far" : ""}`}>
                        {Array.from({ length: EXPECTED_PER_WEEK }, (_, i) => (
                          <span key={i} className={`inline-block h-2.5 w-2.5 rounded-full ${i < w.count ? "bg-ok" : w.current ? "border border-edge" : "border border-miss/60"}`} aria-hidden="true" />
                        ))}
                        <span className="sr-only">
                          Week of {fmtDay(w.weekOf)}: {w.count} of {EXPECTED_PER_WEEK}.
                        </span>
                      </li>
                    ))}
                  </ol>
                  <Link href={`${base}/checkin?room=${r.id}`} className="btn-small">
                    Check in
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
        {others.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            Advisory rooms:{" "}
            {others.map((r, i) => (
              <span key={r.id}>
                {i > 0 ? ", " : ""}
                <Link href={`${base}/rooms/${r.id}`} className="text-bone hover:text-flare">
                  {r.name}
                </Link>
              </span>
            ))}
            . Check in on them when there is something to report.
          </p>
        )}
      </section>

      {/* ── Demoted ── */}
      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg text-bone">Coming up</h2>
            <Link href={`${base}/calendar`} className="text-xs font-semibold text-flare hover:underline">
              Calendar
            </Link>
          </div>
          {overdue.length > 0 && (
            <p className="mt-2 text-sm text-miss">
              {overdue.length} past-due task{overdue.length === 1 ? "" : "s"}.
            </p>
          )}
          <ul className="card mt-3 divide-y divide-line">
            {upcoming.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nothing scheduled this week.</li>}
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                <span className="w-14 shrink-0 text-muted">{fmtDay(e.date)}</span>
                <span className="text-bone">
                  {e.title}
                  {e.roomId ? <span className="text-muted"> · {d.rooms.find((r) => r.id === e.roomId)?.name ?? ""}</span> : null}
                </span>
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

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dd className={`font-display text-2xl font-bold ${tone ?? "text-bone"}`}>{value}</dd>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
    </div>
  );
}
