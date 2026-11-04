import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { saveReport } from "@/app/f/actions";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { addDays, fmtDay } from "@/lib/dates";

export const metadata: Metadata = { title: "Edit report" };

export default async function EditReport({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { facility, viewer } = await requireFacility(slug);
  if (viewer !== "rgs") redirect(`/f/${facility.slug}/reports`);
  const r = await store.report(id);
  if (!r || r.facilityId !== facility.id) notFound();
  const base = `/f/${facility.slug}`;
  const actionsText = r.actions.map((a) => `${a.owner === "rgs" ? "rgs" : "grower"}: ${a.text}${a.due ? ` by ${a.due}` : ""}`).join("\n");

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/reports">
      <Link href={`${base}/reports/${r.id}`} className="text-sm text-muted hover:text-flare">
        Back to the report
      </Link>
      <p className="eyebrow mt-4">Edit · {r.status}</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">
        Week of {fmtDay(r.weekOf)} to {fmtDay(addDays(r.weekOf, 6))}
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] text-muted">
        The draft below was assembled from the week&apos;s readings and the calendar. One item per line. Edit until it
        says what you would say, then approve; the grower sees it only after that.
      </p>

      <form action={saveReport} className="mt-8 space-y-6">
        <input type="hidden" name="slug" value={facility.slug} />
        <input type="hidden" name="id" value={r.id} />
        <div>
          <label className="label" htmlFor="note">
            From your consultant (your words, at the top)
          </label>
          <textarea id="note" name="note" className="field min-h-[120px]" defaultValue={r.note} maxLength={8000} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <label className="label" htmlFor="behind">
              Week behind
            </label>
            <textarea id="behind" name="behind" className="field min-h-[260px]" defaultValue={r.behind.join("\n")} />
          </div>
          <div>
            <label className="label" htmlFor="ahead">
              Week ahead
            </label>
            <textarea id="ahead" name="ahead" className="field min-h-[260px]" defaultValue={r.ahead.join("\n")} />
          </div>
          <div>
            <label className="label" htmlFor="actions">
              Priority actions
            </label>
            <textarea id="actions" name="actions" className="field min-h-[160px]" defaultValue={actionsText} />
            <span className="hint">One per line: &quot;grower: verify emitter rates by 2026-11-08&quot; or &quot;rgs: review substrate trends&quot;.</span>
          </div>
          <div>
            <label className="label" htmlFor="exceptions">
              KPI exceptions
            </label>
            <textarea id="exceptions" name="exceptions" className="field min-h-[160px]" defaultValue={r.exceptions.join("\n")} />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-ghost">
            Save draft
          </button>
          {r.status === "approved" ? (
            <button type="submit" name="unapprove" value="yes" className="btn-ghost">
              Save and pull back to draft
            </button>
          ) : (
            <button type="submit" name="approve" value="yes" className="btn-primary">
              Save and approve
            </button>
          )}
        </div>
      </form>
    </Shell>
  );
}
