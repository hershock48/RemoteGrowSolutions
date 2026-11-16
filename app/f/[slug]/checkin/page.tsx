import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/Shell";
import CheckinForm from "@/components/CheckinForm";
import { loadDashboard, requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { addDays, flowerDay, fmtDay, isISODate } from "@/lib/dates";
import { buildSchedule } from "@/lib/schedule";

export const metadata: Metadata = { title: "Enter data" };

/**
 * Data entry for one room and one day. Reached from the room, never from a
 * tab of its own. With no room in the address it asks which one.
 */
export default async function Entry({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ room?: string; day?: string; err?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { facility, viewer, today } = await requireFacility(slug);
  const d = await loadDashboard(facility, today);
  const base = `/f/${facility.slug}`;
  const room = sp.room ? d.rooms.find((r) => r.id === sp.room) : undefined;
  const day = isISODate(sp.day ?? "") && sp.day! <= today ? sp.day! : today;

  if (!room) {
    return (
      <Shell facility={facility} viewer={viewer} backend={store.backend} current="/rooms">
        <p className="eyebrow">Enter data</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">Which room?</h1>
        {sp.err === "room" && <p className="error">That room is not on this facility.</p>}
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.rooms.map((r) => {
            const c = d.activeCycle.get(r.id);
            const latest = d.recent.get(r.id)?.[0];
            return (
              <li key={r.id}>
                <Link href={`${base}/checkin?room=${r.id}`} className="card block p-5 hover:border-flare">
                  <p className="font-display text-lg font-bold text-bone">{r.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {c ? `${c.genetic || "run"}, day ${flowerDay(c.flipDate, today) ?? 0}` : r.kind === "flower" ? "no active run" : r.kind}
                    {latest ? ` · last entry ${fmtDay(latest.day)}` : " · no entries yet"}
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
      </Shell>
    );
  }

  const existing = (await store.checkinForDay(room.id, day)) ?? undefined;
  const cycle = d.activeCycle.get(room.id);
  const built = buildSchedule(room.schedule, room.emittersPerPlant, room.emitterGph, room.containerGal);
  const dof = cycle ? (flowerDay(cycle.flipDate, day) ?? undefined) : undefined;
  const previous = d.recent.get(room.id)?.find((c) => c.day < day);

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/rooms">
      <p className="eyebrow">
        <Link href={`${base}/rooms/${room.id}`} className="hover:text-flare">
          {room.name}
        </Link>{" "}
        · enter data
      </p>
      <h1 className="mt-2 text-3xl sm:text-4xl">
        {dof ? `Day ${dof}` : room.name}
        <span className="ml-3 text-lg font-semibold text-muted">{fmtDay(day, { weekday: "long", month: "short", day: "numeric" })}</span>
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <span>{existing ? "This day already has an entry. What you save is added to it." : "Nothing entered for this day yet."}</span>
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="room" value={room.id} />
          <label htmlFor="pick-day" className="sr-only">
            Enter data for another day
          </label>
          <input id="pick-day" name="day" type="date" className="field !min-h-[40px] !w-auto !py-1.5" defaultValue={day} max={today} />
          <button type="submit" className="btn-small">
            Change day
          </button>
        </form>
        {day !== today && (
          <Link href={`${base}/checkin?room=${room.id}`} className="font-semibold text-flare hover:underline">
            Back to today
          </Link>
        )}
        {day === today && (
          <Link href={`${base}/checkin?room=${room.id}&day=${addDays(today, -1)}`} className="font-semibold text-flare hover:underline">
            Yesterday
          </Link>
        )}
      </div>

      <div className="mt-6">
        <CheckinForm
          key={`${room.id}-${day}`}
          slug={facility.slug}
          room={room}
          day={day}
          existing={existing}
          previous={previous}
          dayOfFlower={dof}
          photos={!!process.env.BLOB_READ_WRITE_TOKEN}
          scheduleMl={built.dailyMl}
          feeds={built.feeds}
          guideHref={`${base}/guide`}
          err={sp.err}
        />
      </div>
    </Shell>
  );
}
