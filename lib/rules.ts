import type { CalEvent, Checkin, Cycle, Room } from "./types";
import { addDays, diffDays, flowerDay } from "./dates";
import { vpdKpa } from "./vpd";

/**
 * The exceptions engine. The consultant should open the dashboard to a short
 * list of rooms that need a look, not to every reading from every room. This
 * file decides what makes the list.
 *
 * Every comparison is against the ROOM'S OWN targets, set at onboarding and
 * changed on the weekly call. There is no universal threshold anywhere in
 * here, because a runoff number that is right for coco at day 20 is wrong for
 * rockwool at day 50, and a rule that flags both teaches the consultant to
 * ignore the list.
 *
 * Severity is three words the dashboard can colour:
 *   missing    a scheduled submission did not arrive
 *   attention  a reading or a task is outside what the room agreed to
 *   info       a milestone is coming; nothing is wrong
 */

export type Severity = "missing" | "attention" | "info";

export type Flag = {
  roomId: string;
  roomName: string;
  severity: Severity;
  code: string;
  text: string;
  /** The reading's day, when the flag comes from one. */
  day?: string;
};

/** Three check-ins a week means a gap longer than this is a missed submission. */
export const MISSING_AFTER_DAYS = 3;
/** How far ahead a milestone shows on the list. */
export const LOOKAHEAD_DAYS = 7;
/** A change in runoff percentage this large against the prior average is worth a sentence. */
export const DRIFT_POINTS = 5;

export type RoomInput = {
  room: Room;
  cycle: Cycle | null;
  /** Newest first. */
  checkins: Checkin[];
  events: CalEvent[];
  today: string;
};

const inRange = (v: number | undefined, r?: [number, number]) =>
  v === undefined || !r ? true : v >= r[0] && v <= r[1];

const one = (n: number) => (Math.round(n * 10) / 10).toString();

export function evaluateRoom({ room, cycle, checkins, events, today }: RoomInput): Flag[] {
  const flags: Flag[] = [];
  const base = { roomId: room.id, roomName: room.name };
  const active = cycle && cycle.status === "active";
  const latest = checkins[0];

  // Submission compliance, only for rooms with a run on.
  if (active && room.kind === "flower") {
    if (!latest) {
      flags.push({ ...base, severity: "missing", code: "no-checkin", text: "No check-in recorded this cycle." });
    } else {
      const gap = diffDays(latest.day, today);
      if (gap > MISSING_AFTER_DAYS) {
        flags.push({
          ...base,
          severity: "missing",
          code: "stale",
          text: `Last check-in was ${gap} days ago.`,
          day: latest.day,
        });
      }
    }
  }

  if (latest) {
    const t = room.targets;
    if (latest.runoffPct !== undefined && !inRange(latest.runoffPct, t.runoffPct)) {
      flags.push({
        ...base,
        severity: "attention",
        code: "runoff-pct",
        text: `Runoff ${one(latest.runoffPct)}% against a ${t.runoffPct[0]} to ${t.runoffPct[1]}% target.`,
        day: latest.day,
      });
    }
    if (latest.runoffEc !== undefined && t.runoffEcMax !== undefined && latest.runoffEc > t.runoffEcMax) {
      flags.push({
        ...base,
        severity: "attention",
        code: "runoff-ec",
        text: `Runoff EC ${one(latest.runoffEc)} above the room's ${one(t.runoffEcMax)} ceiling.`,
        day: latest.day,
      });
    }
    if (!inRange(latest.tempF, t.tempF)) {
      flags.push({
        ...base,
        severity: "attention",
        code: "temp",
        text: `Temperature ${latest.tempF}°F against ${t.tempF[0]} to ${t.tempF[1]}.`,
        day: latest.day,
      });
    }
    if (!inRange(latest.rh, t.rh)) {
      flags.push({
        ...base,
        severity: "attention",
        code: "rh",
        text: `RH ${latest.rh}% against ${t.rh[0]} to ${t.rh[1]}.`,
        day: latest.day,
      });
    }
    // VPD and CO2 only when the room carries a setpoint for them.
    const vpd = vpdKpa(latest.tempF, latest.rh);
    if (t.vpd && vpd !== undefined && !inRange(vpd, t.vpd)) {
      flags.push({ ...base, severity: "attention", code: "vpd", text: `VPD ${vpd} kPa against ${t.vpd[0]} to ${t.vpd[1]}.`, day: latest.day });
    }
    if (t.co2 && !inRange(latest.co2, t.co2)) {
      flags.push({ ...base, severity: "attention", code: "co2", text: `CO₂ ${latest.co2} ppm against ${t.co2[0]} to ${t.co2[1]}.`, day: latest.day });
    }
    if (t.ppfd && !inRange(latest.ppfd, t.ppfd)) {
      flags.push({
        ...base,
        severity: "attention",
        code: "ppfd",
        text: `PPFD ${latest.ppfd} against ${t.ppfd[0]} to ${t.ppfd[1]}.`,
        day: latest.day,
      });
    }
    if (t.feedEc && !inRange(latest.feedEc, t.feedEc)) {
      flags.push({
        ...base,
        severity: "attention",
        code: "feed-ec",
        text: `Feed EC ${one(latest.feedEc!)} against ${one(t.feedEc[0])} to ${one(t.feedEc[1])}.`,
        day: latest.day,
      });
    }

    // Drift: the newest runoff percentage against the mean of the three before it.
    const prior = checkins.slice(1, 4).map((c) => c.runoffPct).filter((v): v is number => v !== undefined);
    if (latest.runoffPct !== undefined && prior.length >= 2) {
      const mean = prior.reduce((a, b) => a + b, 0) / prior.length;
      const delta = latest.runoffPct - mean;
      if (Math.abs(delta) >= DRIFT_POINTS && inRange(latest.runoffPct, t.runoffPct)) {
        flags.push({
          ...base,
          severity: "info",
          code: "runoff-drift",
          text: `Runoff moved ${delta > 0 ? "up" : "down"} ${one(Math.abs(delta))} points against the prior average of ${one(mean)}%.`,
          day: latest.day,
        });
      }
    }
  }

  // Crop calendar: a harvest inside the lookahead window.
  if (active && cycle) {
    const harvestOn = cycle.plannedHarvest ?? addDays(cycle.flipDate, room.flowerDays - 1);
    const until = diffDays(today, harvestOn);
    if (until >= 0 && until <= LOOKAHEAD_DAYS) {
      flags.push({
        ...base,
        severity: "info",
        code: "harvest-soon",
        text: until === 0 ? "Planned harvest is today." : `Planned harvest in ${until} day${until === 1 ? "" : "s"}.`,
        day: harvestOn,
      });
    }
  }

  // A planned harvest that has passed with the run still open is its own note,
  // not an overdue task: the date was a plan, and the fix is to close the run
  // or move the date.
  if (active && cycle) {
    const harvestOn = cycle.plannedHarvest ?? addDays(cycle.flipDate, room.flowerDays - 1);
    const past = diffDays(harvestOn, today);
    if (past > 0) {
      flags.push({
        ...base,
        severity: "info",
        code: "harvest-passed",
        text: `Planned harvest was ${past} day${past === 1 ? "" : "s"} ago and the run is still open. Close it or move the date.`,
        day: harvestOn,
      });
    }
  }

  // Overdue tasks on this room. Flips and harvests are milestones the crop
  // clock writes, not work somebody forgot, so they never count here.
  const overdue = events
    .filter((e) => e.roomId === room.id && !e.doneAt && e.kind !== "flip" && e.kind !== "harvest" && diffDays(e.date, today) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (overdue.length) {
    const oldest = overdue[0];
    const ago = diffDays(oldest.date, today);
    flags.push({
      ...base,
      severity: "attention",
      code: "overdue",
      text:
        overdue.length === 1
          ? `"${oldest.title}" was due ${ago} day${ago === 1 ? "" : "s"} ago.`
          : `${overdue.length} tasks are past due, the oldest "${oldest.title}" by ${ago} day${ago === 1 ? "" : "s"}.`,
      day: oldest.date,
    });
  }

  return flags;
}

export type Summary = { rooms: number; onTarget: number; flagged: number; missing: number };

export function summarize(roomIds: string[], flags: Flag[]): Summary {
  const byRoom = new Map<string, Flag[]>();
  for (const f of flags) byRoom.set(f.roomId, [...(byRoom.get(f.roomId) ?? []), f]);
  let flagged = 0;
  let missing = 0;
  for (const id of roomIds) {
    const fs = byRoom.get(id) ?? [];
    if (fs.some((f) => f.severity === "missing")) missing += 1;
    else if (fs.some((f) => f.severity === "attention")) flagged += 1;
  }
  return { rooms: roomIds.length, onTarget: roomIds.length - flagged - missing, flagged, missing };
}

/** The day-of-flower a reading belongs to, from the room's active cycle. */
export function dayOf(cycle: Cycle | null, day: string): number | undefined {
  if (!cycle || cycle.status !== "active") return undefined;
  return flowerDay(cycle.flipDate, day) ?? undefined;
}

/** Severity order for sorting a mixed list: missing first, then attention, then info. */
export const SEVERITY_RANK: Record<Severity, number> = { missing: 0, attention: 1, info: 2 };
