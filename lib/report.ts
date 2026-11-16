import type { ActionItem, CalEvent, Checkin, Cycle, Room } from "./types";
import type { Flag } from "./rules";
import { addDays, diffDays, fmtDay, flowerDay } from "./dates";

/**
 * The weekly report, drafted from the data.
 *
 * Week behind: what each room did against its targets, what got done, what
 * did not. Week ahead: what the calendar holds, what to watch. The consultant
 * reads it, edits it, adds the words only a person can add, and approves it.
 * Nothing goes to a client as a draft.
 *
 * THIS IS RULE-BASED, NOT A MODEL. Kevin's standing rule (September 2026) is
 * that no API key exists and model calls do not run from this code. So every
 * sentence here is assembled from a reading and a target, in the plainest
 * form that says the fact: subject, number, target. A model drafting on top
 * of this is a later layer, and this draft is what it would be given.
 */

export type WeekInput = {
  weekOf: string;
  rooms: Room[];
  cycles: Cycle[];
  /** Every check-in that falls inside the week. */
  checkins: Checkin[];
  /** Every event dated inside the week, done or not. */
  events: CalEvent[];
  /** Events in the seven days after the week. */
  upcoming: CalEvent[];
  /** Current flags, for the exceptions block. */
  flags: Flag[];
};

export type Draft = { behind: string[]; ahead: string[]; actions: ActionItem[]; exceptions: string[] };

const one = (n: number) => (Math.round(n * 10) / 10).toString();
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pick = (cs: Checkin[], k: keyof Checkin): number[] =>
  cs.map((c) => c[k]).filter((v): v is number => typeof v === "number");

export function draftReport(input: WeekInput): Draft {
  const { weekOf, rooms, cycles, checkins, events, upcoming, flags } = input;
  const weekEnd = addDays(weekOf, 6);
  const behind: string[] = [];
  const ahead: string[] = [];
  const actions: ActionItem[] = [];
  const exceptions: string[] = [];

  for (const room of rooms.filter((r) => !r.archivedAt)) {
    const cycle = cycles.find((c) => c.roomId === room.id && c.status === "active") ?? null;
    const cs = checkins.filter((c) => c.roomId === room.id).sort((a, b) => a.at - b.at);
    const t = room.targets;

    if (room.kind !== "flower" && cs.length === 0) continue;

    const head =
      cycle && room.kind === "flower"
        ? `${room.name}, ${cycle.genetic || "current run"}, day ${flowerDay(cycle.flipDate, weekOf) ?? 0} to ${flowerDay(cycle.flipDate, weekEnd) ?? 0}.`
        : `${room.name}.`;

    if (cs.length === 0) {
      behind.push(`${head} No check-ins this week.`);
      if (cycle) actions.push({ text: `${room.name}: resume the three weekly check-ins.`, owner: "client" });
      continue;
    }

    const parts: string[] = [`${cs.length} check-in${cs.length === 1 ? "" : "s"}.`];

    const rp = avg(pick(cs, "runoffPct"));
    if (rp !== null) {
      const inside = rp >= t.runoffPct[0] && rp <= t.runoffPct[1];
      parts.push(
        `Runoff averaged ${one(rp)}%, ${inside ? "inside" : rp < t.runoffPct[0] ? "under" : "over"} the ${t.runoffPct[0]} to ${t.runoffPct[1]}% target.`
      );
    }
    const rec = avg(pick(cs, "runoffEc"));
    if (rec !== null) {
      const fe = avg(pick(cs, "feedEc"));
      const vs = fe !== null ? ` against a ${one(fe)} feed` : "";
      const ceiling = t.runoffEcMax !== undefined ? (rec > t.runoffEcMax ? `, above the ${one(t.runoffEcMax)} ceiling` : `, under the ${one(t.runoffEcMax)} ceiling`) : "";
      parts.push(`Runoff EC averaged ${one(rec)}${vs}${ceiling}.`);
    }
    const temp = avg(pick(cs, "tempF"));
    const rh = avg(pick(cs, "rh"));
    if (temp !== null || rh !== null) {
      const bits: string[] = [];
      if (temp !== null) bits.push(`${one(temp)}°F (target ${t.tempF[0]} to ${t.tempF[1]})`);
      if (rh !== null) bits.push(`${one(rh)}% RH (target ${t.rh[0]} to ${t.rh[1]})`);
      parts.push(`Environment averaged ${bits.join(", ")}.`);
    }
    const notes = cs.map((c) => c.observations.trim()).filter(Boolean);
    if (notes.length) parts.push(`Grower noted: ${notes.map((n) => `"${n}"`).join(" ")}`);

    behind.push(`${head} ${parts.join(" ")}`);
  }

  // Tasks this week.
  const done = events.filter((e) => e.doneAt);
  const notDone = events.filter((e) => !e.doneAt && diffDays(e.date, weekEnd) >= 0);
  if (done.length) behind.push(`Completed: ${done.map((e) => `${e.title}${roomTag(e, rooms)}`).join("; ")}.`);
  if (notDone.length) {
    behind.push(`Still open from the week: ${notDone.map((e) => `${e.title}${roomTag(e, rooms)} (${fmtDay(e.date)})`).join("; ")}.`);
    for (const e of notDone) actions.push({ text: `${e.title}${roomTag(e, rooms)}`, owner: e.owner, due: e.date });
  }

  // Week ahead: the calendar, then the crop clock.
  for (const e of upcoming.sort((a, b) => a.date.localeCompare(b.date))) {
    ahead.push(`${fmtDay(e.date)}: ${e.title}${roomTag(e, rooms)} (${e.owner === "rgs" ? "consultant" : "grower"}).`);
  }
  for (const room of rooms.filter((r) => r.kind === "flower" && !r.archivedAt)) {
    const cycle = cycles.find((c) => c.roomId === room.id && c.status === "active");
    if (!cycle) continue;
    const harvestOn = cycle.plannedHarvest ?? addDays(cycle.flipDate, room.flowerDays - 1);
    const until = diffDays(weekEnd, harvestOn);
    if (until >= 0 && until <= 14) ahead.push(`${room.name} reaches its planned harvest ${fmtDay(harvestOn)}, ${until} days after this week closes.`);
    const d = flowerDay(cycle.flipDate, addDays(weekEnd, 1));
    if (d !== null) ahead.push(`${room.name} opens next week on day ${d} of ${room.flowerDays}.`);
  }

  for (const f of flags.filter((x) => x.severity !== "info")) exceptions.push(`${f.roomName}: ${f.text}`);

  return { behind, ahead, actions, exceptions };
}

function roomTag(e: CalEvent, rooms: Room[]): string {
  const r = e.roomId ? rooms.find((x) => x.id === e.roomId) : undefined;
  return r ? ` (${r.name})` : "";
}
