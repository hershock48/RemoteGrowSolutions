/**
 * Irrigation arithmetic. Pure functions, no rounding, so every screen rounds
 * the same way at the edge and never twice.
 *
 * Checked against the worked example in the owner's own planning notes:
 * 2 emitters at 0.5 GPH for 5 minutes, 8 shots a day, 300 mL collected gives a
 * 315 mL shot, 2,524 mL a day and 11.9% runoff. The test file holds it.
 *
 * Assumes nominal emitter flow, even distribution and a full day's collection.
 * Net input is applied minus collected runoff, which is not plant uptake. The
 * calculator says so on screen; this file only does the sums.
 */

export const ML_PER_GAL = 3785.41;

export type IrrigationInput = {
  emittersPerPlant: number;
  emitterGph: number;
  shotMin: number;
  shotsPerDay: number;
  /** Collected runoff per plant per day, mL. Optional: without it there is no percentage. */
  runoffMl?: number;
  /** Container volume in gallons, for the substrate percentage. Optional. */
  containerGal?: number;
};

export type IrrigationResult = {
  shotMl: number;
  dailyMl: number;
  runoffPct: number | null;
  netMl: number | null;
  /** Daily applied volume as a percentage of the container's volume. */
  substratePct: number | null;
};

export function shotMl(emittersPerPlant: number, emitterGph: number, shotMin: number): number {
  if (![emittersPerPlant, emitterGph, shotMin].every(isNum)) return 0;
  return emittersPerPlant * emitterGph * ML_PER_GAL * (shotMin / 60);
}

export function irrigation(input: IrrigationInput): IrrigationResult {
  const shot = shotMl(input.emittersPerPlant, input.emitterGph, input.shotMin);
  const daily = isNum(input.shotsPerDay) ? shot * input.shotsPerDay : 0;
  const hasRunoff = isNum(input.runoffMl) && daily > 0;
  const runoffPct = hasRunoff ? (input.runoffMl! / daily) * 100 : null;
  const netMl = hasRunoff ? daily - input.runoffMl! : null;
  const substratePct =
    isNum(input.containerGal) && input.containerGal! > 0 && daily > 0
      ? (daily / (input.containerGal! * ML_PER_GAL)) * 100
      : null;
  return { shotMl: shot, dailyMl: daily, runoffPct, netMl, substratePct };
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/** Display rounding: whole millilitres, one decimal of percent. */
export const ml = (n: number | null) => (n === null ? "" : Math.round(n).toLocaleString("en-US"));
export const pct = (n: number | null) => (n === null ? "" : `${(Math.round(n * 10) / 10).toFixed(1)}%`);
