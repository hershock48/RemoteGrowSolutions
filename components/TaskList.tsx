import Link from "next/link";
import { toggleTask } from "@/app/f/actions";
import { fmtDay, weekdayShort } from "@/lib/dates";
import type { DayColumn } from "@/lib/board";
import { tally, type TaskState } from "@/lib/tasks";

/**
 * The checklist, in the shape of the laminated sheet it came from: a list for
 * today, and the week as columns of marks. A mark fills by itself when the
 * information it asks for has been entered; anything can be ticked by hand.
 *
 * `interactive` is the grower's and the room page's version, where each open
 * line is a button. The overview's cards pass false and get marks only.
 */

const mark = (done: boolean) => (done ? "border-ok bg-ok text-ink" : "border-edge text-transparent");

export function TodayList({
  states,
  slug,
  roomId,
  day,
  back,
  entryHref,
  interactive = true,
  dense = false,
}: {
  states: TaskState[];
  slug: string;
  roomId: string;
  day: string;
  back: string;
  entryHref: string;
  interactive?: boolean;
  dense?: boolean;
}) {
  if (!states.length) return <p className="text-sm text-muted">Nothing on the list today.</p>;
  return (
    <ul className={dense ? "space-y-1" : "divide-y divide-line"}>
      {states.map((s) => {
        const auto = s.task.auto !== "none";
        return (
          <li key={s.task.id} className={`flex items-start gap-3 ${dense ? "text-[13px]" : "py-2.5 text-[15px]"}`}>
            {interactive ? (
              <form action={toggleTask} className="flex">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="roomId" value={roomId} />
                <input type="hidden" name="taskId" value={s.task.id} />
                <input type="hidden" name="day" value={day} />
                <input type="hidden" name="back" value={back} />
                <button
                  type="submit"
                  disabled={s.how === "auto"}
                  aria-pressed={s.done}
                  aria-label={s.done ? `"${s.task.title}" is done${s.how === "auto" ? "" : ". Untick it"}` : `Tick "${s.task.title}"`}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border text-sm font-bold ${mark(s.done)} ${s.how === "auto" ? "" : "hover:border-flare"}`}
                >
                  ✓
                </button>
              </form>
            ) : (
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold ${mark(s.done)}`} aria-hidden="true">
                ✓
              </span>
            )}
            <span className={`min-w-0 flex-1 ${s.done ? "text-muted" : "text-bone"}`}>
              {s.task.title}
              {!interactive && <span className="sr-only">{s.done ? ", done" : ", not done"}</span>}
              {s.hint && !s.done && <span className="ml-2 text-xs text-warn">{s.hint}</span>}
              {s.task.cadence === "weekly" && <span className="ml-2 text-xs text-muted">this week</span>}
            </span>
            {interactive && auto && !s.done && s.task.auto !== "assigned" && (
              <Link href={entryHref} className="shrink-0 text-xs font-semibold text-flare hover:underline">
                Enter
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The week, as the sheet draws it: one column a day, one row a task. */
export function WeekGrid({ week, today }: { week: DayColumn[]; today: string }) {
  const days = week.filter((c) => c.states.length > 0);
  if (!days.length) return null;
  const rows = days[0].states.map((s) => s.task);
  return (
    <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="The week's checklist, scrolls sideways on a phone">
      <table className="w-full min-w-[460px] text-left text-[13px]">
        <thead>
          <tr>
            <th scope="col" className="border-b border-line py-2 pr-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Required action
            </th>
            {days.map((c) => (
              <th key={c.day} scope="col" className={`border-b border-line px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.1em] ${c.day === today ? "text-flare" : "text-muted"}`}>
                <span className="block">{weekdayShort(c.day)}</span>
                <span className="block font-normal normal-case tracking-normal">{fmtDay(c.day, { month: "numeric", day: "numeric" })}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((task) => (
            <tr key={task.id}>
              <th scope="row" className="border-b border-line/60 py-1.5 pr-3 font-normal text-bone/90">
                {task.title}
              </th>
              {days.map((c) => {
                const s = c.states.find((x) => x.task.id === task.id);
                const cls = c.future ? "border-line" : s?.done ? "border-ok bg-ok" : c.day === today ? "border-edge" : "border-miss/70";
                return (
                  <td key={c.day} className="border-b border-line/60 px-1 py-1.5 text-center">
                    <span className={`inline-block h-3.5 w-3.5 rounded-sm border ${cls}`} aria-hidden="true" />
                    <span className="sr-only">{c.future ? "not yet due" : s?.done ? "done" : "not done"}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A strip of the week for a card: one square a weekday, filled by how much of the day's list is done. */
export function WeekStrip({ week, today }: { week: DayColumn[]; today: string }) {
  const days = week.filter((c) => c.states.length > 0);
  return (
    <ol className="flex gap-1.5" aria-label="This week's checklist by day">
      {days.map((c) => {
        const { done, total } = tally(c.states);
        const cls = c.future ? "border-line text-muted" : done === total ? "border-ok bg-ok text-ink" : done > 0 ? "border-warn text-warn" : c.day === today ? "border-edge text-muted" : "border-miss/70 text-miss";
        return (
          <li key={c.day} className={`flex h-9 w-9 flex-col items-center justify-center rounded border text-[10px] font-semibold leading-none ${cls} ${c.day === today ? "ring-1 ring-flare ring-offset-1 ring-offset-ink-panel" : ""}`}>
            <span aria-hidden="true">{weekdayShort(c.day).slice(0, 2)}</span>
            <span aria-hidden="true" className="mt-0.5 font-normal">
              {c.future ? "" : `${done}/${total}`}
            </span>
            <span className="sr-only">
              {fmtDay(c.day, { weekday: "long" })}: {c.future ? "not yet due" : `${done} of ${total} done`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
