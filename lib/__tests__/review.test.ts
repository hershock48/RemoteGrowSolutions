import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRoom } from "../rules";
import { nowOf } from "../now";
import { buildSchedule, isLit } from "../schedule";
import { cellNumber, colsOfKind, parseSensorCsv } from "../sensorcsv";
import { safePath } from "../forms";
import type { Checkin, Cycle, Room } from "../types";

/**
 * One test for each defect the review of 2026-11-16 found in the pure logic,
 * so none of them can come back unnoticed.
 */

const room: Room = {
  id: "r1",
  facilityId: "f1",
  name: "Flower 01",
  kind: "flower",
  fixtureModel: "",
  fixtureCount: 42,
  canopySqft: 640,
  substrate: "Rockwool",
  containerGal: 1.6,
  plantsPerLight: 12,
  emittersPerPlant: 2,
  emitterGph: 0.5,
  vegDays: 21,
  flowerDays: 63,
  hvac: "",
  dehu: "",
  controller: "",
  sensorPlatform: "",
  genetics: "",
  targets: { tempF: [76, 82], rh: [55, 65], runoffPct: [10, 20], runoffEcMax: 4.5, vpd: [1.1, 1.5], co2: [1000, 1300] },
  createdAt: 0,
};
const cycle: Cycle = { id: "c1", facilityId: "f1", roomId: "r1", genetic: "GMO", flipDate: "2026-10-08", status: "active", createdAt: 0 };
const ci = (day: string, extra: Partial<Checkin>): Checkin => ({ id: `k${day}`, facilityId: "f1", roomId: "r1", cycleId: "c1", at: Date.parse(`${day}T12:00:00Z`), day, observations: "", submittedBy: "client", ...extra });

test("rules: a later partial entry does not hide an earlier reading that is out of range", () => {
  // Friday: runoff EC over the ceiling. Saturday: only temperature and RH.
  const checkins = [ci("2026-11-14", { tempF: 79, rh: 60 }), ci("2026-11-13", { runoffEc: 5.4, runoffPct: 14, tempF: 78, rh: 61 })];
  const flags = evaluateRoom({ room, cycle, checkins, events: [], today: "2026-11-14" });
  const ec = flags.find((f) => f.code === "runoff-ec");
  assert.ok(ec, "the runoff EC flag is still raised");
  assert.equal(ec!.day, "2026-11-13", "and it names the day the reading came from");
  assert.equal(nowOf(checkins).runoffEc, 5.4, "the gauges read the same value");
});

test("rules: a reading older than a week before the newest entry no longer speaks for the room", () => {
  const checkins = [ci("2026-11-14", { tempF: 79, rh: 60 }), ci("2026-11-02", { runoffEc: 5.4 })];
  const flags = evaluateRoom({ room, cycle, checkins, events: [], today: "2026-11-14" });
  assert.equal(flags.find((f) => f.code === "runoff-ec"), undefined);
});

test("rules: VPD comes from one entry, never the temperature of one day and the RH of another", () => {
  const checkins = [ci("2026-11-14", { tempF: 90 }), ci("2026-11-13", { tempF: 79, rh: 60 })];
  const flags = evaluateRoom({ room, cycle, checkins, events: [], today: "2026-11-14" });
  assert.equal(flags.find((f) => f.code === "vpd"), undefined, "79°F at 60% is inside 1.1 to 1.5");
  assert.ok(flags.find((f) => f.code === "temp"), "and the 90°F reading is flagged on its own");
});

test("sensor export: a gap is a gap, not a zero", () => {
  for (const gap of ["", "N/A", "n/a", "null", "NaN", "--", "-"]) assert.equal(cellNumber(gap), null, `"${gap}"`);
  assert.equal(cellNumber("0"), 0);
  assert.equal(cellNumber("58.2 %"), 58.2);
  assert.equal(cellNumber("-1.5"), -1.5);
  const p = parseSensorCsv("time,wc\n2026-11-15 06:00,55\n2026-11-15 06:15,N/A\n2026-11-15 06:30,54");
  assert.deepEqual(p.cols.wc, [55, null, 54]);
});

test("sensor export: a decimal comma is a decimal when the columns are split another way", () => {
  assert.equal(cellNumber("23,5", ";"), 23.5);
  const p = parseSensorCsv("time;temp;rh\n2026-11-15 06:00;23,5;60,2\n2026-11-15 06:15;23,7;59,8\n2026-11-15 06:30;24,0;59,1");
  assert.deepEqual(p.cols.temp, [23.5, 23.7, 24]);
  assert.deepEqual(p.cols.rh, [60.2, 59.8, 59.1]);
});

test("sensor export: one file with substrate and climate columns splits into both kinds", () => {
  const p = parseSensorCsv("time,VWC,EC,Air Temp,RH\n2026-11-15 06:00,55,4.1,78,60\n2026-11-15 06:15,56,4.0,79,59\n2026-11-15 06:30,57,3.9,79,59");
  assert.deepEqual(Object.keys(colsOfKind(p.cols, "substrate")).sort(), ["ec", "wc"]);
  assert.deepEqual(Object.keys(colsOfKind(p.cols, "environment")).sort(), ["rh", "temp"]);
});

test("schedule: a phase that runs past a full day from lights on is called out", () => {
  const b = buildSchedule({ lightsOn: "06:00", lightsOff: "18:00", p2: { start: "20:00", shots: 12, shotMin: 2, everyMin: 60 } }, 2, 0.5);
  assert.ok(b.warnings.some((w) => /past a full day/.test(w)));
  const ok = buildSchedule({ lightsOn: "20:00", lightsOff: "08:00", p1: { start: "21:00", shots: 5, shotMin: 3, everyMin: 30 }, p2: { start: "01:00", shots: 3, shotMin: 2, everyMin: 120 } }, 2, 0.5);
  assert.equal(ok.warnings.length, 0, "an ordinary overnight schedule raises nothing");
  assert.deepEqual(ok.events.map((e) => e.on), ["21:00", "21:30", "22:00", "22:30", "23:00", "01:00", "03:00", "05:00"]);
});

test("lights: on or off at a wall-clock minute, across midnight, and unknown without a schedule", () => {
  const day = { lightsOn: "06:00", lightsOff: "18:00" };
  const night = { lightsOn: "20:00", lightsOff: "08:00" };
  assert.equal(isLit(day, 12 * 60), true);
  assert.equal(isLit(day, 19 * 60), false);
  assert.equal(isLit(night, 23 * 60), true);
  assert.equal(isLit(night, 3 * 60), true);
  assert.equal(isLit(night, 12 * 60), false);
  assert.equal(isLit(undefined, 0), undefined);
  assert.equal(isLit({ lightsOn: "06:00", lightsOff: "06:00" }, 0), undefined);
});

test("redirect targets: a path on this site, and nothing a browser would read as another host", () => {
  assert.equal(safePath("/f/demo/rooms/r1#tasks", "/x"), "/f/demo/rooms/r1#tasks");
  for (const bad of ["//evil.example", "/\\evil.example", "/\t/evil.example", "https://evil.example", "/a\nb", ""]) assert.equal(safePath(bad, "/x"), "/x", JSON.stringify(bad));
});
