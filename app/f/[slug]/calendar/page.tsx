import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/Shell";
import { deleteEvent, saveEvent, toggleEvent } from "@/app/f/actions";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { addDays, diffDays, flowerDay, fmtDay, isISODate, weekStart, weekdayShort } from "@/lib/dates";
import type { CalEvent, EventKind } from "@/lib/types";

export const metadata: Metadata = { title: "Calendar" };

const KINDS: { v: EventKind; label: string }[] = [
  { v: "task", label: "Task" },
  { v: "milestone", label: "Milestone" },
  { v: "transplant", label: "Transplant" },
  { v: "flip", label: "Flip" },
  { v: "harvest", label: "Harvest" },
  { v: "call", label: "Weekly call" },
  { v: "review", label: "Review" },
];

/**
 * The living calendar: one week at a time, seven columns, every room's
 * events with who owns them and whether they are done. The crop clock writes
 * flips and harvests itself when a run starts; the consultant's call notes
 * write dated action items; both sides add the rest by hand. Every change
 * records who made it and when.
 */
export default async function Calendar({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ week?: string; err?: string; saved?: string; edit?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { facility, viewer, today } = await requireFacility(slug);
  const week = isISODate(sp.week ?? "") ? weekStart(sp.week!) : weekStart(today);
  const end = addDays(week, 6);
  const [rooms, cycles, events, overdue] = await Promise.all([
    store.rooms(facility.id),
    store.cycles(facility.id),
    store.eventsBetween(facility.id, week, end),
    store.openEventsBefore(facility.id, week),
  ]);
  const base = `/f/${facility.slug}`;
  const here = `${base}/calendar?week=${week}`;
  const roomName = (id?: string) => (id ? rooms.find((r) => r.id === id)?.name ?? "" : "");
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const editing = sp.edit ? events.find((e) => e.id === sp.edit) : undefined;
  const active = cycles.filter((c) => c.status === "active");

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/calendar">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1 className="mt-2 text-3xl sm:text-4xl">
            {fmtDay(week)} to {fmtDay(end, { month: "short", day: "numeric", year: "numeric" })}
          </h1>
        </div>
        <nav aria-label="Week" className="flex gap-2">
          <Link href={`${base}/calendar?week=${addDays(week, -7)}`} className="btn-ghost">
            Previous
          </Link>
          <Link href={`${base}/calendar`} className="btn-ghost">
            This week
          </Link>
          <Link href={`${base}/calendar?week=${addDays(week, 7)}`} className="btn-ghost">
            Next
          </Link>
        </nav>
      </div>

      {overdue.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-miss">Past due</h2>
          <ul className="card mt-2 divide-y divide-line">
            {overdue.map((e) => (
              <EventRow key={e.id} e={e} slug={facility.slug} week={week} room={roomName(e.roomId)} today={today} back={here} />
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 grid gap-px overflow-hidden rounded-xl2 border border-line bg-line md:grid-cols-7">
        {days.map((d) => {
          const todays = events.filter((e) => e.date === d);
          const isToday = d === today;
          return (
            <section key={d} className={`min-h-[120px] bg-ink-panel p-3 ${isToday ? "ring-1 ring-inset ring-flare" : ""}`} aria-label={fmtDay(d, { weekday: "long", month: "long", day: "numeric" })}>
              <h2 className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                <span>{weekdayShort(d)}</span>
                <span className={isToday ? "text-flare" : ""}>{d.slice(8)}</span>
              </h2>
              <ul className="mt-2 space-y-1.5 text-[13px]">
                {active.map((c) => {
                  const fd = flowerDay(c.flipDate, d);
                  if (fd === null) return null;
                  return (
                    <li key={c.id} className="text-muted">
                      {roomName(c.roomId)} d{fd}
                    </li>
                  );
                })}
                {todays.map((e) => (
                  <li key={e.id}>
                    <Link href={`${here}&edit=${e.id}#edit`} className={`block rounded px-1.5 py-1 leading-snug hover:bg-ink ${e.doneAt ? "text-muted line-through" : "text-bone"}`}>
                      <span className={`dot mr-1.5 align-middle ${e.owner === "rgs" ? "dot-warn" : "dot-info"}`} aria-hidden="true" />
                      {e.title}
                      {e.roomId ? <span className="text-muted"> · {roomName(e.roomId)}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">
        <span className="dot dot-warn mr-1 align-middle" aria-hidden="true" /> RGS owns it ·{" "}
        <span className="dot dot-info mr-1 align-middle" aria-hidden="true" /> the grower owns it · d28 is the room&apos;s flower day.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-xl text-bone">This week&apos;s list</h2>
          {sp.saved && (
            <p className="mt-2 text-sm text-ok" role="status">
              Saved.
            </p>
          )}
          <ul className="card mt-3 divide-y divide-line">
            {events.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nothing scheduled.</li>}
            {events.map((e) => (
              <EventRow key={e.id} e={e} slug={facility.slug} week={week} room={roomName(e.roomId)} today={today} back={here} />
            ))}
          </ul>
        </section>

        <section id="edit" className="card scroll-mt-24 p-5">
          <h2 className="text-xl text-bone">{editing ? "Edit" : "Add to the calendar"}</h2>
          <form action={saveEvent} className="mt-4 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="slug" value={facility.slug} />
            <input type="hidden" name="week" value={week} />
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="sm:col-span-2">
              <label className="label" htmlFor="title">
                What
              </label>
              <input id="title" name="title" className="field" required maxLength={120} defaultValue={editing?.title ?? ""} placeholder="Defoliation, EC review, transplant" />
              {sp.err === "title" && <span className="error">Give it a name.</span>}
            </div>
            <div>
              <label className="label" htmlFor="date">
                When
              </label>
              <input id="date" name="date" type="date" className="field" required defaultValue={editing?.date ?? today} />
              {sp.err === "date" && <span className="error">That is not a date.</span>}
            </div>
            <div>
              <label className="label" htmlFor="kind">
                Kind
              </label>
              <select id="kind" name="kind" className="field" defaultValue={editing?.kind ?? "task"}>
                {KINDS.map((k) => (
                  <option key={k.v} value={k.v}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="roomId">
                Room
              </label>
              <select id="roomId" name="roomId" className="field" defaultValue={editing?.roomId ?? ""}>
                <option value="">Whole facility</option>
                {rooms
                  .filter((r) => !r.archivedAt)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="owner">
                Who does it
              </label>
              <select id="owner" name="owner" className="field" defaultValue={editing?.owner ?? "client"}>
                <option value="client">The grower</option>
                <option value="rgs">RGS</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="note">
                Note (optional)
              </label>
              <input id="note" name="note" className="field" maxLength={1000} defaultValue={editing?.note ?? ""} />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" className="btn-primary">
                {editing ? "Save" : "Add"}
              </button>
              {editing && (
                <Link href={here} className="btn-ghost">
                  Cancel
                </Link>
              )}
            </div>
          </form>
          {editing && (
            <form action={deleteEvent} className="mt-3">
              <input type="hidden" name="slug" value={facility.slug} />
              <input type="hidden" name="week" value={week} />
              <input type="hidden" name="id" value={editing.id} />
              <button type="submit" className="text-sm font-semibold text-miss hover:underline">
                Remove this event
              </button>
              <p className="mt-2 text-xs text-muted">
                Added by the {editing.createdBy === "rgs" ? "consultant" : "grower"} ({editing.source}) on {new Date(editing.createdAt).toLocaleDateString("en-US")}.
                {editing.updatedAt ? ` Last changed ${new Date(editing.updatedAt).toLocaleDateString("en-US")}.` : ""}
              </p>
            </form>
          )}
        </section>
      </div>
    </Shell>
  );
}

function EventRow({ e, slug, week, room, today, back }: { e: CalEvent; slug: string; week: string; room: string; today: string; back: string }) {
  const late = !e.doneAt && diffDays(e.date, today) > 0;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
      <form action={toggleEvent} className="flex items-center">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="week" value={week} />
        <input type="hidden" name="id" value={e.id} />
        <input type="hidden" name="back" value={back} />
        <button
          type="submit"
          aria-pressed={!!e.doneAt}
          aria-label={e.doneAt ? `Mark "${e.title}" not done` : `Mark "${e.title}" done`}
          className={`flex h-6 w-6 items-center justify-center rounded border ${e.doneAt ? "border-ok bg-ok text-ink" : "border-edge hover:border-flare"}`}
        >
          {e.doneAt ? "✓" : ""}
        </button>
      </form>
      <span className={`w-16 shrink-0 ${late ? "text-miss" : "text-muted"}`}>{fmtDay(e.date)}</span>
      <Link href={`${back}&edit=${e.id}#edit`} className={`flex-1 ${e.doneAt ? "text-muted line-through" : "text-bone"} hover:text-flare`}>
        {e.title}
        {room ? <span className="text-muted"> · {room}</span> : null}
      </Link>
      <span className="pill">{e.owner === "rgs" ? "RGS" : "Grower"}</span>
    </li>
  );
}
