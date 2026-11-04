import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/Shell";
import CheckinForm from "@/components/CheckinForm";
import { loadDashboard, requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { flowerDay } from "@/lib/dates";

export const metadata: Metadata = { title: "Check-in" };

export default async function Checkin({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ room?: string; err?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { facility, viewer, today } = await requireFacility(slug);
  const d = await loadDashboard(facility, today);
  const base = `/f/${facility.slug}`;
  const room = sp.room ? d.rooms.find((r) => r.id === sp.room) : undefined;

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/checkin">
      <p className="eyebrow">Check-in</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">{room ? room.name : "Which room?"}</h1>

      {!room ? (
        <>
          <p className="mt-3 max-w-2xl text-[15px] text-muted">
            Three a week per flower room. Pick the room; the form already knows its emitters and targets.
          </p>
          {sp.err === "room" && <p className="error">That room is not on this facility.</p>}
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.rooms.map((r) => {
              const c = d.activeCycle.get(r.id);
              const latest = d.recent.get(r.id)?.[0];
              const stale = d.flags.some((f) => f.roomId === r.id && f.severity === "missing");
              return (
                <li key={r.id}>
                  <Link href={`${base}/checkin?room=${r.id}`} className="card block p-5 hover:border-flare">
                    <p className="flex items-center justify-between gap-2 font-display text-lg font-bold text-bone">
                      {r.name}
                      {stale && <span className="dot dot-miss" aria-label="check-in overdue" />}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {c ? `${c.genetic || "run"}, day ${flowerDay(c.flipDate, today) ?? 0}` : r.kind === "flower" ? "no active run" : r.kind}
                      {latest ? ` · last ${latest.day}` : " · no readings yet"}
                    </p>
                  </Link>
                </li>
              );
            })}
            {d.rooms.length === 0 && (
              <li className="text-muted">
                No rooms yet.{" "}
                <Link href={`${base}/rooms/new`} className="text-flare hover:underline">
                  Add one
                </Link>
                .
              </li>
            )}
          </ul>
        </>
      ) : (
        <div className="mt-6">
          <CheckinForm
            slug={facility.slug}
            room={room}
            today={today}
            previous={d.recent.get(room.id)?.[0]}
            dayOfFlower={d.activeCycle.get(room.id) ? (flowerDay(d.activeCycle.get(room.id)!.flipDate, today) ?? undefined) : undefined}
            photos={!!process.env.BLOB_READ_WRITE_TOKEN}
            err={sp.err}
          />
        </div>
      )}
    </Shell>
  );
}
