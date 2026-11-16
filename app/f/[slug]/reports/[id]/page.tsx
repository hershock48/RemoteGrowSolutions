import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import LineChart, { Legend } from "@/components/LineChart";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { addDays, flowerDay, fmtDay } from "@/lib/dates";
import { delta, ecSeries, previousQuarter, quarterKpis, quarterOf, runReadings } from "@/lib/series";
import { SITE } from "@/lib/site";
import type { Cycle } from "@/lib/types";

export const metadata: Metadata = { title: "Weekly report" };

/**
 * The deliverable. Words from the consultant, then the quarter's three
 * numbers an owner cares about, then one chart per room with the report's
 * week shaded on the run, then the drafted text. It prints as a document:
 * white paper, ink, charts in their print palette, a running footer.
 *
 * Charts and KPI tiles are computed when the page renders, from the data as
 * it stands. The text is what the consultant approved. If a reading is
 * edited after approval the chart moves and the text does not, which is
 * the honest outcome for a document that says "at the time of writing".
 */
export default async function ReportPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { facility, viewer } = await requireFacility(slug);
  const r = await store.report(id);
  if (!r || r.facilityId !== facility.id) notFound();
  if (r.status !== "approved" && viewer !== "rgs") notFound();
  const base = `/f/${facility.slug}`;
  const weekEnd = addDays(r.weekOf, 6);

  const [rooms, cycles, weekCheckins] = await Promise.all([store.rooms(facility.id), store.cycles(facility.id), store.checkinsBetween(facility.id, r.weekOf, weekEnd)]);
  const flower = rooms.filter((x) => x.kind === "flower" && !x.archivedAt);
  // The run each room was on at the end of the report's week.
  const runAt = (roomId: string): Cycle | null =>
    cycles
      .filter((c) => c.roomId === roomId && c.flipDate <= weekEnd && (c.status === "active" || !c.harvestedOn || c.harvestedOn >= r.weekOf))
      .sort((a, b) => b.flipDate.localeCompare(a.flipDate))[0] ?? null;
  const charts = (
    await Promise.all(
      flower.map(async (room) => {
        const cycle = runAt(room.id);
        if (!cycle || !weekCheckins.some((c) => c.roomId === room.id)) return null;
        const rs = runReadings(await store.checkinsForRoom(room.id, 200), cycle).filter((x) => x.c.day <= weekEnd);
        const series = ecSeries(rs, room);
        const d0 = Math.max(1, flowerDay(cycle.flipDate, r.weekOf) ?? 1);
        const d1 = Math.max(d0, flowerDay(cycle.flipDate, weekEnd) ?? d0);
        return { room, cycle, series, shade: [d0, d1] as [number, number] };
      })
    )
  ).filter((x): x is NonNullable<typeof x> => x !== null);

  const q = quarterOf(r.weekOf);
  const k = quarterKpis(cycles, rooms, q);
  const p = quarterKpis(cycles, rooms, previousQuarter(q));

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/reports">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`${base}/reports`} className="text-sm text-muted hover:text-flare">
          All reports
        </Link>
        <div className="flex gap-2">
          {viewer === "rgs" && (
            <Link href={`${base}/reports/${r.id}/edit`} className="btn-ghost">
              Edit
            </Link>
          )}
        </div>
      </div>
      {sp.saved && (
        <p className="no-print mt-3 text-sm text-ok" role="status">
          Saved.
        </p>
      )}

      <article className="print-sheet card mt-6 p-7 sm:p-10 print:mt-0 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="eyebrow">{SITE.name} · weekly report</p>
            <h1 className="mt-2 text-3xl sm:text-4xl">{facility.name}</h1>
            <p className="mt-2 text-[15px] text-muted">
              Week of {fmtDay(r.weekOf, { month: "long", day: "numeric" })} to {fmtDay(weekEnd, { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <span className={`pill ${r.status === "approved" ? "text-ok" : "text-warn"}`}>
            {r.status === "approved" ? `Approved ${r.approvedAt ? new Date(r.approvedAt).toLocaleDateString("en-US") : ""}` : "Draft, not yet sent"}
          </span>
        </header>

        {r.note && (
          <section className="mt-8 print-break">
            <h2 className="text-lg text-bone">From your consultant</h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-bone/90">{r.note}</p>
          </section>
        )}

        {/* ── The owner's numbers ── */}
        <section className="mt-8 print-break">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg text-bone">{q.label} so far</h2>
            <p className="text-xs text-muted">Changes are against all of {previousQuarter(q).label}, so a partial quarter reads low on harvests until it fills. Grams per square foot needs a dry weight recorded at harvest.</p>
          </div>
          <dl className="mt-3 grid gap-px overflow-hidden rounded-xl2 border border-line bg-line sm:grid-cols-3">
            <Kpi label="Harvests" value={String(k.harvests)} change={delta(k.harvests, p.harvests)} unit="" better="up" />
            <Kpi label="Grams per sq ft, average" value={k.gPerSqft === null ? "No weights yet" : k.gPerSqft.toFixed(1)} sub={k.gPerSqft !== null ? `${k.weighed} of ${k.harvests} weighed` : undefined} change={delta(k.gPerSqft, p.gPerSqft)} unit="" better="up" />
            <Kpi label="Days in flower, average" value={k.daysInFlower === null ? "No harvests yet" : k.daysInFlower.toFixed(0)} change={delta(k.daysInFlower, p.daysInFlower)} unit=" days" better="down" />
          </dl>
        </section>

        {/* ── One chart per room ── */}
        {charts.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg text-bone">Each run, with this week shaded</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {charts.map(({ room, cycle, series, shade }) => (
                <div key={room.id} className="card print-break p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-bone">
                      {room.name} <span className="font-normal text-muted">· {cycle.genetic || "run"}, day {shade[0]} to {shade[1]}</span>
                    </h3>
                    <Legend series={series} />
                  </div>
                  <div className="mt-2">
                    <LineChart series={series} width={480} height={200} yLabel="mS/cm" shade={shade} ariaLabel={`${room.name}: feed and runoff EC over the run, this week shaded`} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <Block title="Week behind" items={r.behind} />
          <Block title="Week ahead" items={r.ahead} />
        </div>

        <section className="mt-8 print-break">
          <h2 className="text-lg text-bone">Priority actions</h2>
          {r.actions.length === 0 ? (
            <p className="mt-2 text-sm text-muted">None carried.</p>
          ) : (
            <table className="tbl mt-3">
              <thead>
                <tr>
                  <th scope="col">Action</th>
                  <th scope="col">Owner</th>
                  <th scope="col">By</th>
                </tr>
              </thead>
              <tbody>
                {r.actions.map((a, i) => (
                  <tr key={i}>
                    <td>{a.text}</td>
                    <td className="text-muted">{a.owner === "rgs" ? "Consultant" : "Grower"}</td>
                    <td className="text-muted">{a.due ? fmtDay(a.due) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {r.exceptions.length > 0 && (
          <section className="mt-8 print-break">
            <h2 className="text-lg text-bone">KPI exceptions at the time of writing</h2>
            <ul className="mt-2 space-y-1.5 text-[15px] text-bone/90">
              {r.exceptions.map((x, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 dot dot-warn" aria-hidden="true" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-10 border-t border-line pt-4 text-xs text-muted">
          Targets are this facility&apos;s own, set at onboarding and on the weekly call. This report is yours to keep.
        </footer>
      </article>
      <div className="print-footer" aria-hidden="true">
        {SITE.name} · {facility.name} · week of {fmtDay(r.weekOf)} to {fmtDay(weekEnd, { month: "short", day: "numeric", year: "numeric" })}
      </div>
    </Shell>
  );
}

function Kpi({ label, value, sub, change, unit, better }: { label: string; value: string; sub?: string; change: number | null; unit: string; better: "up" | "down" }) {
  const good = change === null ? null : change === 0 ? null : (change > 0) === (better === "up");
  const arrow = change === null || change === 0 ? "" : change > 0 ? "▲" : "▼";
  return (
    <div className="bg-ink-panel px-5 py-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold text-bone">{value}</dd>
      <dd className="mt-0.5 text-xs text-muted">
        {sub ? `${sub}. ` : ""}
        {change === null ? "No prior quarter to compare." : change === 0 ? "Level with last quarter." : (
          <span className={good ? "text-ok" : "text-warn"}>
            {arrow} {Math.abs(change) % 1 === 0 ? Math.abs(change) : Math.abs(change).toFixed(1)}
            {unit} against last quarter
          </span>
        )}
      </dd>
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="print-break">
      <h2 className="text-lg text-bone">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing recorded.</p>
      ) : (
        <ul className="mt-3 space-y-3 text-[15px] leading-relaxed text-bone/90">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
