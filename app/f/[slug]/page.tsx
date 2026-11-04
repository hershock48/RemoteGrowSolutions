import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/Shell";
import FlagList from "@/components/FlagList";
import { loadDashboard, requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { addDays, diffDays, fmtDay, fmtWhen, flowerDay } from "@/lib/dates";
import { READINESS } from "@/lib/site";

export const metadata: Metadata = { title: "Overview" };

export default async function Overview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { facility, viewer, today } = await requireFacility(slug);
  const d = await loadDashboard(facility, today);
  const reports = await store.reports(facility.id);
  const latestReport = reports.find((r) => viewer === "rgs" || r.status === "approved");
  const base = `/f/${facility.slug}`;
  const flowerRooms = d.rooms.filter((r) => r.kind === "flower");
  const upcoming = d.events.filter((e) => !e.doneAt && diffDays(today, e.date) >= 0).slice(0, 8);
  const overdue = d.events.filter((e) => !e.doneAt && diffDays(e.date, today) > 0);
  const ready = READINESS[facility.readiness];

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{fmtDay(today, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-2 text-3xl sm:text-4xl">{facility.name}</h1>
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

      {/* Summary */}
      <dl className="mt-8 grid gap-px overflow-hidden rounded-xl2 border border-line bg-line sm:grid-cols-4">
        <Stat label="Flower rooms" value={String(d.summary.rooms)} />
        <Stat label="On target" value={String(d.summary.onTarget)} tone="ok" />
        <Stat label="Need attention" value={String(d.summary.flagged)} tone={d.summary.flagged ? "warn" : undefined} />
        <Stat label="Missing check-ins" value={String(d.summary.missing)} tone={d.summary.missing ? "miss" : undefined} />
      </dl>

      {flowerRooms.length === 0 && (
        <p className="warn-band mt-6">
          No rooms yet.{" "}
          <Link href={`${base}/rooms/new`} className="font-semibold text-flare hover:underline">
            Add the first flower room
          </Link>{" "}
          and its targets, then start a check-in.
        </p>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <section className="min-w-0">
          <h2 className="text-xl text-bone">Rooms needing a look</h2>
          <div className="mt-4">
            <FlagList flags={d.flags} base={base} />
          </div>

          <h2 className="mt-10 text-xl text-bone">Rooms</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {d.rooms.map((r) => {
              const cycle = d.activeCycle.get(r.id);
              const latest = d.recent.get(r.id)?.[0];
              const day = cycle ? flowerDay(cycle.flipDate, today) : null;
              const worst = d.flags.filter((f) => f.roomId === r.id).sort((a, b) => (a.severity === "missing" ? -1 : b.severity === "missing" ? 1 : 0))[0];
              const dot = !worst ? "dot-ok" : worst.severity === "missing" ? "dot-miss" : worst.severity === "attention" ? "dot-warn" : "dot-ok";
              return (
                <li key={r.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`${base}/rooms/${r.id}`} className="font-display text-lg font-bold text-bone hover:text-flare">
                        {r.name}
                      </Link>
                      <p className="text-xs uppercase tracking-[0.12em] text-muted">
                        {r.kind}
                        {cycle ? ` · ${cycle.genetic || "run"} · day ${day ?? 0} of ${r.flowerDays}` : r.kind === "flower" ? " · no active run" : ""}
                      </p>
                    </div>
                    <span className={`dot mt-2 ${dot}`} aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    {latest
                      ? `Last check-in ${fmtWhen(latest.at, facility.timezone)}${latest.runoffPct !== undefined ? `, runoff ${latest.runoffPct.toFixed(1)}%` : ""}${latest.runoffEc !== undefined ? `, runoff EC ${latest.runoffEc}` : ""}.`
                      : "No check-ins yet."}
                  </p>
                  <Link href={`${base}/checkin?room=${r.id}`} className="btn-small mt-3">
                    Check in
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="space-y-8">
          <section className="card p-5">
            <p className="eyebrow">Facility status</p>
            <p className="mt-2 flex items-center gap-2 font-semibold text-bone">
              <span className={`dot ${facility.readiness === "qualified" ? "dot-ok" : facility.readiness === "conditional" ? "dot-warn" : "dot-miss"}`} aria-hidden="true" />
              {ready.name}
            </p>
            <p className="mt-1 text-sm text-muted">{facility.readinessNote || ready.body}</p>
          </section>

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
            <ul className="mt-3 divide-y divide-line card">
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
                  {latestReport.status === "approved" ? "Approved" : "Draft"} · {latestReport.behind.length} notes behind, {latestReport.ahead.length} ahead
                </p>
              </Link>
            ) : (
              <p className="card mt-3 p-4 text-sm text-muted">No report yet. The first one follows the first weekly call.</p>
            )}
          </section>
        </aside>
      </div>
    </Shell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "miss" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "miss" ? "text-miss" : "text-bone";
  return (
    <div className="bg-ink-panel px-5 py-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className={`mt-1 font-display text-3xl font-bold ${color}`}>{value}</dd>
    </div>
  );
}
