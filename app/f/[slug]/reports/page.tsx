import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/Shell";
import { draftWeek } from "@/app/f/actions";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { addDays, fmtDay, weekStart } from "@/lib/dates";

export const metadata: Metadata = { title: "Reports" };

export default async function Reports({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { facility, viewer, today } = await requireFacility(slug);
  const all = await store.reports(facility.id);
  const reports = viewer === "rgs" ? all : all.filter((r) => r.status === "approved");
  const base = `/f/${facility.slug}`;
  const lastWeek = weekStart(addDays(today, -7));

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/reports">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Weekly reports</p>
          <h1 className="mt-2 text-3xl sm:text-4xl">Week behind, week ahead</h1>
          <p className="mt-3 max-w-2xl text-[15px] text-muted">
            Drafted from the week&apos;s check-ins, the calendar and the call, then read and approved by your consultant.
            Yours to keep.
          </p>
        </div>
        {viewer === "rgs" && (
          <form action={draftWeek} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="slug" value={facility.slug} />
            <div>
              <label className="label" htmlFor="weekOf">
                Draft the week of
              </label>
              <input id="weekOf" name="weekOf" type="date" className="field" defaultValue={lastWeek} />
            </div>
            <button type="submit" className="btn-primary">
              Draft report
            </button>
          </form>
        )}
      </div>

      <ul className="card mt-8 divide-y divide-line">
        {reports.length === 0 && <li className="px-5 py-4 text-sm text-muted">No reports yet.</li>}
        {reports.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4">
            <Link href={`${base}/reports/${r.id}`} className="font-semibold text-bone hover:text-flare">
              Week of {fmtDay(r.weekOf)} to {fmtDay(addDays(r.weekOf, 6), { month: "short", day: "numeric", year: "numeric" })}
            </Link>
            <span className={`pill ${r.status === "approved" ? "text-ok" : "text-warn"}`}>{r.status}</span>
            <span className="text-sm text-muted">
              {r.behind.length} behind · {r.ahead.length} ahead · {r.actions.length} actions
            </span>
            {viewer === "rgs" && (
              <Link href={`${base}/reports/${r.id}/edit`} className="ml-auto btn-small">
                Edit
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
