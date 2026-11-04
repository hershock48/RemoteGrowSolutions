import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { saveCall } from "@/app/f/actions";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";

export const metadata: Metadata = { title: "Write up a call" };

export default async function NewCall({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ edit?: string; err?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { facility, viewer, today } = await requireFacility(slug);
  if (viewer !== "rgs") redirect(`/f/${facility.slug}/notes`);
  const base = `/f/${facility.slug}`;
  const existing = sp.edit ? await store.call(sp.edit) : null;
  if (existing && existing.facilityId !== facility.id) redirect(`${base}/notes`);
  const actionsText = existing?.actions.map((a) => `${a.owner === "rgs" ? "rgs" : "grower"}: ${a.text}${a.due ? ` by ${a.due}` : ""}`).join("\n") ?? "";

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/notes">
      <Link href={`${base}/notes`} className="text-sm text-muted hover:text-flare">
        All call notes
      </Link>
      <p className="eyebrow mt-4">{existing ? "Edit" : "New"}</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">Write up the call</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-muted">
        Two versions from one call. The internal record is yours: reasoning, data references, decision history. The
        client summary is theirs to keep. Action items with a date become calendar tasks when the note is first saved.
      </p>

      <form action={saveCall} className="mt-8 space-y-6">
        <input type="hidden" name="slug" value={facility.slug} />
        {existing && <input type="hidden" name="id" value={existing.id} />}
        <div className="max-w-xs">
          <label className="label" htmlFor="heldOn">
            Call held on
          </label>
          <input id="heldOn" name="heldOn" type="date" className="field" defaultValue={existing?.heldOn ?? today} max={today} />
          {sp.err === "date" && <span className="error">That is not a date.</span>}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <label className="label" htmlFor="internal">
              Internal record
            </label>
            <textarea id="internal" name="internal" className="field min-h-[300px]" defaultValue={existing?.internal ?? ""} placeholder={"Week behind as discussed, the numbers that drove each recommendation, what was ruled out and why."} />
          </div>
          <div>
            <label className="label" htmlFor="client">
              Client summary
            </label>
            <textarea id="client" name="client" className="field min-h-[300px]" defaultValue={existing?.client ?? ""} placeholder={"Week behind. Recommendations. What to watch next week."} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="actions">
            Action items
          </label>
          <textarea id="actions" name="actions" className="field min-h-[140px]" defaultValue={actionsText} placeholder={"grower: verify emitter delivery rates by 2026-11-08\nrgs: review updated substrate trends"} />
          <span className="hint">One per line. Start with &quot;grower:&quot; or &quot;rgs:&quot;. End with a date to put it on the calendar.</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-ghost">
            Save
          </button>
          <button type="submit" name="approve" value="yes" className="btn-primary">
            Save and deliver the client summary
          </button>
        </div>
      </form>
    </Shell>
  );
}
