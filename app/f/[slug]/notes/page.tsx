import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/Shell";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { fmtDay, fmtDayLong } from "@/lib/dates";

export const metadata: Metadata = { title: "Call notes" };

/**
 * The weekly call, written down. The grower sees the client version once the
 * consultant approves it; the consultant sees both. The client version is
 * the deliverable the grower keeps for good, which is why it is printable
 * and never carries the internal record.
 */
export default async function Notes({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { facility, viewer } = await requireFacility(slug);
  const all = await store.calls(facility.id);
  const notes = viewer === "rgs" ? all : all.filter((n) => n.approvedAt);
  const base = `/f/${facility.slug}`;

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/notes">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Call notes</p>
          <h1 className="mt-2 text-3xl sm:text-4xl">What was decided, and who does what</h1>
          <p className="mt-3 max-w-2xl text-[15px] text-muted">
            A written summary of every weekly call: recommendations, action items and what is coming. These are yours to
            keep, whether or not the subscription continues.
          </p>
        </div>
        {viewer === "rgs" && (
          <Link href={`${base}/notes/new`} className="btn-primary">
            Write up a call
          </Link>
        )}
      </div>
      {sp.saved && (
        <p className="mt-4 text-sm text-ok" role="status">
          Saved.
        </p>
      )}

      <div className="mt-8 space-y-6">
        {notes.length === 0 && <p className="card px-5 py-4 text-sm text-muted">No call notes yet.</p>}
        {notes.map((n) => (
          <article key={n.id} className="card p-6 sm:p-8">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl text-bone">Call of {fmtDayLong(n.heldOn)}</h2>
              <div className="flex items-center gap-2">
                <span className={`pill ${n.approvedAt ? "text-ok" : "text-warn"}`}>{n.approvedAt ? "Delivered" : "Not yet delivered"}</span>
                {viewer === "rgs" && (
                  <Link href={`${base}/notes/new?edit=${n.id}`} className="btn-small">
                    Edit
                  </Link>
                )}
              </div>
            </header>
            {n.client ? <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-bone/90">{n.client}</p> : <p className="mt-4 text-sm text-muted">No client summary written yet.</p>}
            {n.actions.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">Action items</h3>
                <ul className="mt-2 space-y-1.5 text-[15px]">
                  {n.actions.map((a, i) => (
                    <li key={i} className="flex flex-wrap gap-x-2">
                      <span className="pill">{a.owner === "rgs" ? "Consultant" : "Grower"}</span>
                      <span className="text-bone/90">{a.text}</span>
                      {a.due && <span className="text-muted">by {fmtDay(a.due)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {viewer === "rgs" && n.internal && (
              <details className="mt-5 rounded-lg border border-line bg-ink p-4">
                <summary className="cursor-pointer text-sm font-semibold text-flare">Internal record (consultant only)</summary>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{n.internal}</p>
              </details>
            )}
          </article>
        ))}
      </div>
    </Shell>
  );
}
