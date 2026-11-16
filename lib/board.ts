import "server-only";

import { cache } from "react";
import { loadDashboard, type Dashboard } from "./load";
import { store } from "./store";
import { addDays, todayIn, weekStart } from "./dates";
import { DEFAULT_TASKS, taskStates, type TaskState } from "./tasks";
import type { Checkin, Cycle, Facility, Room, TaskTemplate } from "./types";

/**
 * The task board: for every flower room with a run on, what is done and what
 * is not, today and for each day of the week. Both the overview's room cards
 * and each room's own page read from this, and so does the quiet bar at the
 * bottom of a grower's screen, so it is loaded once per request and shared.
 */

export type DayColumn = { day: string; future: boolean; states: TaskState[] };

export type RoomBoard = {
  room: Room;
  cycle: Cycle;
  /** Today's daily items followed by the week's weekly ones. */
  today: TaskState[];
  /** Monday to Sunday. Weekend columns are empty when the list is weekdays only. */
  week: DayColumn[];
  weekly: TaskState[];
  entryToday: Checkin | null;
};

export type Board = { facility: Facility; dash: Dashboard; tasks: TaskTemplate[]; rooms: RoomBoard[]; openToday: number; today: string; photosOn: boolean };

export const loadBoard = cache(async (facilityId: string, today: string): Promise<Board | null> => {
  const facility = await store.facilityById(facilityId);
  if (!facility) return null;
  const dash = await loadDashboard(facility, today);
  const weekOf = weekStart(today);
  const weekEnd = addDays(weekOf, 6);
  const [entries, ticks, uploads, dated] = await Promise.all([
    store.checkinsBetween(facility.id, weekOf, weekEnd),
    store.ticksBetween(facility.id, weekOf, weekEnd),
    // Half a day of slack either side of the week, for the facility's offset from UTC.
    store.seriesSince(facility.id, Date.parse(`${weekOf}T00:00:00Z`) - 14 * 3_600_000),
    // Scheduled items from the last two months, done ones included, so the
    // "assigned" line can be judged as it stood on each day of the week.
    store.eventsBetween(facility.id, addDays(weekOf, -60), weekEnd),
  ]);
  // Anything still open from further back comes from the dashboard's own list.
  const assigned = [...dated, ...dash.events.filter((e) => !dated.some((x) => x.id === e.id))].filter((e) => e.kind !== "flip" && e.kind !== "harvest");
  const doneDay = (ms: number) => todayIn(facility.timezone, new Date(ms));
  const tasks = facility.tasks?.length ? facility.tasks : DEFAULT_TASKS;
  const daily = tasks.filter((t) => t.cadence !== "weekly");
  const weeklyTasks = tasks.filter((t) => t.cadence === "weekly");
  const tickSet = new Set(ticks.map((t) => t.id));
  const photosOn = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const uploadDays = uploads.map((u) => ({ roomId: u.roomId, kind: u.kind, day: todayIn(facility.timezone, new Date(u.uploadedAt)) }));

  const rooms: RoomBoard[] = [];
  for (const room of dash.rooms) {
    const cycle = dash.activeCycle.get(room.id);
    if (room.kind !== "flower" || !cycle) continue;
    const mine = entries.filter((e) => e.roomId === room.id);
    const ctx = (day: string) => ({
      room,
      day,
      entries: mine,
      ticks: tickSet,
      uploads: uploadDays.filter((u) => u.roomId === room.id),
      // Open ON THAT DAY: dated on or before it, and not yet done by its end.
      // Counting what is open now turned Monday green when Monday's item was
      // ticked on Wednesday.
      openAssigned: assigned.filter((e) => e.roomId === room.id && e.date <= day && (!e.doneAt || doneDay(e.doneAt) > day)).length,
      photosOn,
    });
    const week: DayColumn[] = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekOf, i);
      return { day, future: day > today, states: day > today ? taskStates(daily, { ...ctx(day), entries: [], ticks: new Set(), uploads: [] }).map((s) => ({ ...s, done: false, how: null })) : taskStates(daily, ctx(day)) };
    });
    const weekly = taskStates(weeklyTasks, ctx(today));
    const todayCol = week.find((c) => c.day === today)!;
    rooms.push({ room, cycle, today: [...todayCol.states, ...weekly], week, weekly, entryToday: mine.find((e) => e.day === today) ?? null });
  }
  const openToday = rooms.reduce((n, r) => n + r.today.filter((s) => !s.done).length, 0);
  return { facility, dash, tasks, rooms, openToday, today, photosOn };
});
