import type { Checkin } from "./types";
import { vpdKpa } from "./vpd";

/**
 * Where a room stands now: the most recent value entered for each reading.
 *
 * An entry for a day can be partial (temperature in the morning, runoff in
 * the afternoon), so "now" is taken reading by reading from the newest entry
 * that carries it, never from the newest entry alone. VPD is worked out from
 * the temperature and RH of one and the same entry, so it is never a mix of
 * two days.
 */
export type Now = {
  tempF?: number;
  rh?: number;
  vpd?: number;
  co2?: number;
  substrateWc?: number;
  substrateEc?: number;
  feedEc?: number;
  runoffEc?: number;
  runoffPct?: number;
  /** The newest day any reading came from. */
  day?: string;
};

const KEYS = ["tempF", "rh", "co2", "substrateWc", "substrateEc", "feedEc", "runoffEc", "runoffPct"] as const;

/** `checkins` newest first. */
export function nowOf(checkins: Checkin[]): Now {
  const out: Now = {};
  for (const k of KEYS) {
    const hit = checkins.find((c) => typeof c[k] === "number");
    if (hit) out[k] = hit[k] as number;
  }
  const both = checkins.find((c) => c.tempF !== undefined && c.rh !== undefined);
  if (both) out.vpd = vpdKpa(both.tempF, both.rh);
  out.day = checkins[0]?.day;
  return out;
}
