import type { Phase, Schedule } from "./types";
import { ML_PER_GAL, shotMl } from "./irrigation";

/**
 * The irrigation schedule, worked out shot by shot: when each one turns on
 * and off, what it delivers per plant, and what the day adds up to.
 *
 * P1 is the ramp from lights on to field capacity; P2 is the maintenance
 * phase after it. Each phase is a start time, a number of shots, how long a
 * shot runs and how far apart they are. Shot size is not typed: it comes
 * from the drippers per plant and the dripper size on the room's profile,
 * so changing a dripper changes every volume on the page.
 *
 * Pure arithmetic. Clock times wrap past midnight, and the room's day is
 * measured from lights on, so a room that runs its lights overnight reads
 * the same as one that runs them by day.
 */

const DAY = 1440;

export function parseHHMM(s: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  const h = +m[1];
  const mi = +m[2];
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}

/** Minutes since midnight to "HH:MM", with seconds only when there are some. */
export function fmtClock(min: number): string {
  const total = ((Math.round(min * 60) % 86400) + 86400) % 86400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}${sec ? `:${p(sec)}` : ""}`;
}

/**
 * Whether the lights are on at a wall-clock minute of the facility day.
 * Undefined when the room has no lighting schedule, so the caller can leave
 * the question out instead of guessing.
 */
export function isLit(s: Schedule | undefined, nowMin: number): boolean | undefined {
  const on = parseHHMM(s?.lightsOn);
  const off = parseHHMM(s?.lightsOff);
  if (on === null || off === null || on === off) return undefined;
  return (nowMin - on + DAY) % DAY < (off - on + DAY) % DAY;
}

export type ShotEvent = {
  phase: "P1" | "P2";
  n: number;
  /** Minutes after lights on. */
  rel: number;
  on: string;
  off: string;
  ml: number;
  cumMl: number;
};

export type PhaseTotals = { shots: number; shotMl: number; totalMl: number; first: string; lastOff: string };

export type Built = {
  events: ShotEvent[];
  p1: PhaseTotals | null;
  p2: PhaseTotals | null;
  dailyMl: number;
  feeds: number;
  /** Daily volume as a percentage of the container. */
  substratePct: number | null;
  photoperiodMin: number | null;
  warnings: string[];
};

const validPhase = (p: Phase | undefined): p is Phase =>
  !!p && parseHHMM(p.start) !== null && p.shots > 0 && p.shotMin > 0 && p.everyMin >= 0 && Number.isFinite(p.shots + p.shotMin + p.everyMin);

export function buildSchedule(s: Schedule | undefined, emittersPerPlant: number, emitterGph: number, containerGal?: number): Built {
  const empty: Built = { events: [], p1: null, p2: null, dailyMl: 0, feeds: 0, substratePct: null, photoperiodMin: null, warnings: [] };
  if (!s) return empty;
  const on = parseHHMM(s.lightsOn) ?? 0;
  const offAbs = parseHHMM(s.lightsOff);
  const photoperiodMin = offAbs === null ? null : (offAbs - on + DAY) % DAY || DAY;
  const warnings: string[] = [];
  const events: ShotEvent[] = [];
  const totals: Record<"P1" | "P2", PhaseTotals | null> = { P1: null, P2: null };

  for (const [name, p] of [["P1", s.p1], ["P2", s.p2]] as const) {
    if (!validPhase(p)) continue;
    const start = parseHHMM(p.start)!;
    const each = shotMl(emittersPerPlant, emitterGph, p.shotMin);
    const shots = Math.min(60, Math.floor(p.shots));
    if (shots > 1 && p.everyMin < p.shotMin) warnings.push(`${name} shots are ${p.everyMin} minutes apart but run ${p.shotMin}, so they overlap.`);
    for (let i = 0; i < shots; i++) {
      const at = start + i * p.everyMin;
      events.push({ phase: name, n: i + 1, rel: (at - on + DAY * 4) % DAY, on: fmtClock(at), off: fmtClock(at + p.shotMin), ml: each, cumMl: 0 });
    }
    totals[name] = { shots, shotMl: each, totalMl: each * shots, first: fmtClock(start), lastOff: fmtClock(start + (shots - 1) * p.everyMin + p.shotMin) };
  }

  events.sort((a, b) => a.rel - b.rel);
  let cum = 0;
  for (const e of events) {
    cum += e.ml;
    e.cumMl = cum;
  }

  const p1Events = events.filter((e) => e.phase === "P1");
  const p2Events = events.filter((e) => e.phase === "P2");
  if (p1Events.length && p2Events.length && s.p1 && p2Events[0].rel < p1Events[p1Events.length - 1].rel + s.p1.shotMin) {
    warnings.push("P2 starts before the last P1 shot has finished.");
  }
  if (photoperiodMin !== null && events.length) {
    const last = events[events.length - 1];
    const lastLen = last.phase === "P1" ? s.p1!.shotMin : s.p2!.shotMin;
    if (last.rel + lastLen > photoperiodMin) warnings.push("The last shot ends after lights off.");
    if (events[0].rel > photoperiodMin) warnings.push("The first shot is outside the lights-on window.");
  }

  const dailyMl = cum;
  const substratePct = containerGal && containerGal > 0 && dailyMl > 0 ? (dailyMl / (containerGal * ML_PER_GAL)) * 100 : null;
  return { events, p1: totals.P1, p2: totals.P2, dailyMl, feeds: events.length, substratePct, photoperiodMin, warnings };
}
