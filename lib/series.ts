import type { Checkin, Cycle, Room } from "./types";
import type { Series } from "./chart";
import { addDays, diffDays, flowerDay, weekStart } from "./dates";

/**
 * Readings into chart series, and the three overview figures (crop timeline,
 * check-in compliance, quarter KPIs). All pure; the pages call these and
 * draw.
 */

/** The check-ins that belong to one run, oldest first, with a flower day on each. */
export function runReadings(checkins: Checkin[], cycle: Cycle): { day: number; c: Checkin }[] {
  return checkins
    .filter((c) => c.cycleId === cycle.id || (c.cycleId === undefined && c.day >= cycle.flipDate && (!cycle.harvestedOn || c.day <= cycle.harvestedOn)))
    .map((c) => ({ day: c.dayOfFlower ?? flowerDay(cycle.flipDate, c.day) ?? 0, c }))
    .filter((r) => r.day > 0)
    .sort((a, b) => a.day - b.day || a.c.at - b.c.at);
}

const pick = (rs: { day: number; c: Checkin }[], k: keyof Checkin) =>
  rs.filter((r) => typeof r.c[k] === "number").map((r) => ({ x: r.day, y: r.c[k] as number }));

/** Feed EC and runoff EC over the run. The gap between them is the story. */
export function ecSeries(rs: { day: number; c: Checkin }[], room: Room): Series[] {
  return [
    { name: "Runoff EC", points: pick(rs, "runoffEc"), slot: "primary", ceiling: room.targets.runoffEcMax, dots: true },
    { name: "Feed EC", points: pick(rs, "feedEc"), slot: "secondary", band: room.targets.feedEc, dots: true },
  ];
}

export function runoffSeries(rs: { day: number; c: Checkin }[], room: Room): Series[] {
  return [{ name: "Runoff %", points: pick(rs, "runoffPct"), slot: "primary", band: room.targets.runoffPct, dots: true }];
}

export function tempSeries(rs: { day: number; c: Checkin }[], room: Room): Series[] {
  return [{ name: "Temperature °F", points: pick(rs, "tempF"), slot: "secondary", band: room.targets.tempF, dots: true }];
}

export function rhSeries(rs: { day: number; c: Checkin }[], room: Room): Series[] {
  return [{ name: "RH %", points: pick(rs, "rh"), slot: "third", band: room.targets.rh, dots: true }];
}

/* ------------------------------ timeline ------------------------------ */

export type Timeline = {
  day: number;
  total: number;
  /** 0 to 1, clamped. */
  frac: number;
  harvestOn: string;
  /** Days past the planned harvest with the run still open. */
  over: number;
};

export function timeline(room: Room, cycle: Cycle, today: string): Timeline {
  const total = Math.max(1, room.flowerDays);
  const day = flowerDay(cycle.flipDate, today) ?? 0;
  const harvestOn = cycle.plannedHarvest ?? addDays(cycle.flipDate, total - 1);
  const over = Math.max(0, diffDays(harvestOn, today));
  return { day, total, frac: Math.max(0, Math.min(1, day / total)), harvestOn, over };
}

/* ------------------------------ compliance ------------------------------ */

export const EXPECTED_PER_WEEK = 3;

export type WeekDots = { weekOf: string; count: number; current: boolean };

/**
 * The last `weeks` Monday-to-Sunday weeks ending with the current one, each
 * with how many check-ins the room sent. Three are expected; the dots fill
 * to the count and stop at three. The current week is marked so an empty
 * Monday morning does not read as a miss.
 */
export function compliance(checkins: Checkin[], today: string, weeks = 4): WeekDots[] {
  const thisMonday = weekStart(today);
  const out: WeekDots[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekOf = addDays(thisMonday, -7 * i);
    const end = addDays(weekOf, 6);
    const count = checkins.filter((c) => c.day >= weekOf && c.day <= end).length;
    out.push({ weekOf, count, current: i === 0 });
  }
  return out;
}

/* ------------------------------ quarter KPIs ------------------------------ */

export type Quarter = { label: string; from: string; to: string };

export function quarterOf(day: string): Quarter {
  const y = +day.slice(0, 4);
  const q = Math.floor((+day.slice(5, 7) - 1) / 3);
  const from = `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`;
  const to = addDays(q === 3 ? `${y + 1}-01-01` : `${y}-${String(q * 3 + 4).padStart(2, "0")}-01`, -1);
  return { label: `Q${q + 1} ${y}`, from, to };
}

export function previousQuarter(q: Quarter): Quarter {
  return quarterOf(addDays(q.from, -1));
}

export type Kpis = {
  quarter: Quarter;
  harvests: number;
  /** Mean grams per square foot across harvests that recorded a dry weight. */
  gPerSqft: number | null;
  /** Mean days from flip to harvest. */
  daysInFlower: number | null;
  /** Harvests that carried a dry weight, so the average is read with its sample. */
  weighed: number;
};

export function quarterKpis(cycles: Cycle[], rooms: Room[], quarter: Quarter): Kpis {
  const done = cycles.filter((c) => c.status === "harvested" && c.harvestedOn && c.harvestedOn >= quarter.from && c.harvestedOn <= quarter.to);
  const yields = done
    .map((c) => {
      const room = rooms.find((r) => r.id === c.roomId);
      const g = c.outcome?.dryGrams;
      return room && room.canopySqft > 0 && typeof g === "number" && g > 0 ? g / room.canopySqft : null;
    })
    .filter((v): v is number => v !== null);
  const days = done.map((c) => diffDays(c.flipDate, c.harvestedOn!) + 1).filter((n) => n > 0);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return { quarter, harvests: done.length, gPerSqft: mean(yields), daysInFlower: mean(days), weighed: yields.length };
}

/** Signed change, or null when either side is missing. */
export const delta = (now: number | null, before: number | null): number | null => (now === null || before === null ? null : now - before);
