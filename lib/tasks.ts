import type { Checkin, Room, TaskTemplate, ZoneRead } from "./types";
import { weekStart } from "./dates";

/**
 * The list a grower is prompted with, and the rule for when each item is
 * done.
 *
 * THE DEFAULT LIST IS JAKE'S OWN SHEET. He sent a laminated worksheet,
 * "Weekly Flower Room | Operations", used at a facility he co-manages
 * (2026-11-16), and asked for it to be the starting point with the
 * facility-specific and name-specific details taken out. So "all 10 trays"
 * is "every feed zone", "TrolMaster temp/RH graphs" is "temp and RH graphs",
 * and the person named on the dryback line is gone. The eleven daily lines
 * are otherwise his, in his order. The sheet runs Monday to Friday, so the
 * daily items are due on weekdays. The weekly item is the "Weekly room
 * profile" box at the top of the same sheet.
 *
 * A facility can carry its own list (Facility.tasks); this is what a new one
 * starts with.
 *
 * AN ITEM TICKS ITSELF when the information it asks for has been entered:
 * the runoff line when every feed zone has its reads, the graphs line when
 * the day has a temperature and humidity reading or an uploaded export, and
 * so on. Anything can also be ticked by hand, because "remote access
 * checked" is a true way to do the graphs line that no form can see.
 */

export const DEFAULT_TASKS: TaskTemplate[] = [
  { id: "canopy", title: "30-second canopy video or photo sent (entire room)", cadence: "weekdays", auto: "photo" },
  { id: "health", title: "Plant health and visual cues inspected and reported", cadence: "weekdays", auto: "notes" },
  { id: "dryback", title: "Dryback observations and changes sent", cadence: "weekdays", auto: "substrate" },
  { id: "runoff", title: "Runoff EC, pH and volume recorded for every feed zone", cadence: "weekdays", auto: "runoff" },
  { id: "graphs", title: "Temp and RH graphs sent, or remote access checked", cadence: "weekdays", auto: "environment" },
  { id: "p1", title: "P1 final irrigation event verified", cadence: "weekdays", auto: "none" },
  { id: "pitchers", title: "Collection pitchers emptied after the P1 check", cadence: "weekdays", auto: "none" },
  { id: "p2", title: "P2 delivery verified next morning", cadence: "weekdays", auto: "none" },
  { id: "feed", title: "Feed changes and irrigation issues communicated", cadence: "weekdays", auto: "none" },
  { id: "alarms", title: "Equipment alarms and environmental deviations reported", cadence: "weekdays", auto: "none" },
  { id: "assigned", title: "Assigned cultivation tasks completed and confirmed", cadence: "weekdays", auto: "assigned" },
  { id: "profile", title: "Room profile confirmed for the week: feed EC and pH, lighting, targets, P1 and P2 timing", cadence: "weekly", auto: "none" },
];

/** The line under his sheet's notes box, kept word for word. */
export const URGENT_LINE = "Urgent irrigation failures, equipment alarms, and significant crop issues must be communicated immediately.";

export const AUTO_LABEL: Record<TaskTemplate["auto"], string> = {
  none: "Ticked by hand",
  environment: "Ticks when temperature and RH are entered or an export is uploaded",
  runoff: "Ticks when every feed zone has its runoff reads",
  photo: "Ticks when a canopy video or photo is uploaded",
  notes: "Ticks when observations are written",
  substrate: "Ticks when dryback is entered or a substrate export is uploaded",
  assigned: "Ticks when nothing assigned to the room is still open",
};

const isWeekday = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`).getUTCDay();
  return d >= 1 && d <= 5;
};

/** The period a task belongs to on a given day, or null when it is not due that day. */
export function periodFor(task: TaskTemplate, day: string): string | null {
  if (task.cadence === "weekly") return weekStart(day);
  if (task.cadence === "weekdays") return isWeekday(day) ? day : null;
  return day;
}

/* ------------------------------ runoff by zone ------------------------------ */

const complete = (r: ZoneRead) => r.ml !== undefined && (r.ml === 0 || r.ec !== undefined);

/**
 * A zone is read when two plants in it have a volume and an EC, or one
 * whole-row collection does. A read of zero volume counts with no EC: his
 * sheet says to write 0 and never leave a reading unexplained.
 */
export function zonesDone(room: Room, entry: Checkin | undefined): { done: number; total: number } {
  const total = Math.max(1, Math.floor(room.feedZones ?? 1));
  if (!entry?.zones?.length) return { done: 0, total };
  let done = 0;
  for (let z = 1; z <= total; z++) {
    const reads = entry.zones.filter((r) => r.zone === z);
    const plants = reads.filter((r) => r.source === "plant" && complete(r)).length;
    const rows = reads.filter((r) => r.source === "row" && complete(r)).length;
    if (plants >= 2 || rows >= 1) done++;
  }
  return { done, total };
}

/** The single runoff figures a check-in carries are the averages of its zone reads. */
export function runoffFromZones(zones: ZoneRead[]): { runoffEc?: number; runoffPh?: number; runoffMl?: number } {
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : undefined);
  return {
    runoffEc: avg(zones.filter((r) => r.ec !== undefined).map((r) => r.ec!)),
    runoffPh: avg(zones.filter((r) => r.ph !== undefined).map((r) => r.ph!)),
    // Per-plant volume comes from plant reads only; a row total is not a per-plant number.
    runoffMl: avg(zones.filter((r) => r.source === "plant" && r.ml !== undefined).map((r) => r.ml!)),
  };
}

/* ------------------------------ task state ------------------------------ */

export const tickKey = (roomId: string, taskId: string, period: string) => `${roomId}:${taskId}:${period}`;

export type TaskState = { task: TaskTemplate; period: string; done: boolean; how: "auto" | "tick" | null; hint?: string };

export type TaskContext = {
  room: Room;
  /** The day being judged. */
  day: string;
  /** Every entry for this room in the week of `day`. */
  entries: Checkin[];
  ticks: Set<string>;
  /** Sensor exports for this room uploaded in the week, with the day they were uploaded. */
  uploads: { kind: "substrate" | "environment"; day: string }[];
  /** Scheduled items for this room dated on or before `day` and still open. */
  openAssigned: number;
  /** False when the deployment has nowhere to keep a photo, so the photo line is by hand. */
  photosOn: boolean;
};

export function taskStates(tasks: TaskTemplate[], ctx: TaskContext): TaskState[] {
  const out: TaskState[] = [];
  for (const task of tasks) {
    const period = periodFor(task, ctx.day);
    if (!period) continue;
    const inPeriod = (d: string) => (task.cadence === "weekly" ? weekStart(d) === period : d === period);
    const entries = ctx.entries.filter((e) => inPeriod(e.day));
    const uploads = ctx.uploads.filter((u) => inPeriod(u.day));
    let auto = false;
    let hint: string | undefined;
    switch (task.auto) {
      case "environment":
        auto = entries.some((e) => e.tempF !== undefined && e.rh !== undefined) || uploads.some((u) => u.kind === "environment");
        break;
      case "runoff": {
        const best = entries.map((e) => zonesDone(ctx.room, e)).sort((a, b) => b.done - a.done)[0] ?? zonesDone(ctx.room, undefined);
        auto = best.done >= best.total;
        if (!auto && best.done > 0) hint = `${best.done} of ${best.total} zones`;
        break;
      }
      case "photo":
        auto = ctx.photosOn && entries.some((e) => !!e.photoUrl || !!e.videoUrl);
        break;
      case "notes":
        auto = entries.some((e) => e.observations.trim().length > 0);
        break;
      case "substrate":
        auto = entries.some((e) => e.dryback !== undefined || e.substrateWc !== undefined) || uploads.some((u) => u.kind === "substrate");
        break;
      case "assigned":
        auto = ctx.openAssigned === 0;
        if (!auto) hint = `${ctx.openAssigned} open`;
        break;
    }
    const tick = ctx.ticks.has(tickKey(ctx.room.id, task.id, period));
    out.push({ task, period, done: auto || tick, how: auto ? "auto" : tick ? "tick" : null, hint });
  }
  return out;
}

export const tally = (states: TaskState[]) => ({ done: states.filter((s) => s.done).length, total: states.length });
