import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSchedule, fmtClock, parseHHMM } from "../schedule";
import { DEFAULT_TASKS, periodFor, runoffFromZones, taskStates, tally, tickKey, zonesDone } from "../tasks";
import { flowerDayOf, parseSensorCsv, parseWallTime } from "../sensorcsv";
import { vpdKpa } from "../vpd";
import type { Checkin, Room } from "../types";

test("clock helpers", () => {
  assert.equal(parseHHMM("06:30"), 390);
  assert.equal(parseHHMM("24:00"), null);
  assert.equal(fmtClock(390), "06:30");
  assert.equal(fmtClock(391.5), "06:31:30");
  assert.equal(fmtClock(1450), "00:10");
});

test("schedule: P1 and P2 shot by shot, with on and off times and volumes from the drippers", () => {
  const b = buildSchedule(
    { lightsOn: "06:00", lightsOff: "18:00", p1: { start: "07:00", shots: 6, shotMin: 2, everyMin: 30 }, p2: { start: "11:00", shots: 4, shotMin: 1, everyMin: 90 } },
    2,
    0.5,
    1.6
  );
  assert.equal(b.feeds, 10);
  assert.equal(b.events[0].on, "07:00");
  assert.equal(b.events[0].off, "07:02");
  assert.equal(b.events[5].on, "09:30");
  assert.equal(b.events[6].phase, "P2");
  assert.equal(b.events[9].on, "15:30");
  assert.equal(b.events[9].off, "15:31");
  // 2 drippers at 0.5 GPH is 63.09 mL a minute per plant.
  assert.equal(Math.round(b.p1!.shotMl), 126);
  assert.equal(Math.round(b.p2!.shotMl), 63);
  assert.equal(Math.round(b.dailyMl), 6 * 126 + 4 * 63 + 1); // 1009.4, rounding of the parts
  assert.equal(Math.round(b.events[9].cumMl), Math.round(b.dailyMl));
  assert.equal(b.photoperiodMin, 720);
  assert.equal(Math.round(b.substratePct!), 17);
  assert.deepEqual(b.warnings, []);
});

test("schedule: warnings for overlap, P2 inside P1, and a shot after lights off; overnight lights wrap", () => {
  const b = buildSchedule(
    { lightsOn: "06:00", lightsOff: "18:00", p1: { start: "07:00", shots: 3, shotMin: 5, everyMin: 3 }, p2: { start: "07:05", shots: 2, shotMin: 2, everyMin: 660 } },
    2,
    0.5
  );
  assert.equal(b.warnings.length, 3);
  const night = buildSchedule({ lightsOn: "20:00", lightsOff: "08:00", p1: { start: "21:00", shots: 2, shotMin: 2, everyMin: 240 } }, 2, 0.5);
  assert.deepEqual(night.events.map((e) => e.on), ["21:00", "01:00"]);
  assert.equal(night.photoperiodMin, 720);
  assert.deepEqual(night.warnings, []);
  assert.equal(buildSchedule(undefined, 2, 0.5).feeds, 0);
});

const room = { id: "r1", feedZones: 2, emittersPerPlant: 2, emitterGph: 0.5 } as Room;
const entry = (day: string, extra: Partial<Checkin>): Checkin => ({ id: day, facilityId: "f", roomId: "r1", at: 0, day, observations: "", submittedBy: "client", ...extra });

test("zones: two plants or one row read a zone; a zero volume needs no EC", () => {
  assert.deepEqual(zonesDone(room, undefined), { done: 0, total: 2 });
  const e = entry("2026-11-16", {
    zones: [
      { zone: 1, source: "plant", n: 1, ec: 4.1, ph: 6, ml: 300 },
      { zone: 1, source: "plant", n: 2, ec: 4.3, ph: 6.1, ml: 0 },
      { zone: 2, source: "plant", n: 1, ec: 4.0, ml: 280 },
    ],
  });
  assert.deepEqual(zonesDone(room, e), { done: 1, total: 2 });
  e.zones!.push({ zone: 2, source: "row", n: 0, ec: 4.2, ph: 6, ml: 5200 });
  assert.deepEqual(zonesDone(room, e), { done: 2, total: 2 });
  const avg = runoffFromZones(e.zones!);
  assert.equal(avg.runoffEc, 4.15);
  assert.equal(avg.runoffMl, 193.33); // plant reads only: 300, 0, 280
});

test("tasks: the default list is his sheet, weekdays only, with one weekly line", () => {
  assert.equal(DEFAULT_TASKS.filter((t) => t.cadence === "weekdays").length, 11);
  assert.equal(periodFor(DEFAULT_TASKS[0], "2026-11-14"), null); // Saturday
  assert.equal(periodFor(DEFAULT_TASKS[0], "2026-11-16"), "2026-11-16");
  assert.equal(periodFor(DEFAULT_TASKS[11], "2026-11-18"), "2026-11-16");
});

test("tasks tick themselves from what was entered, and by hand", () => {
  const base = { room, day: "2026-11-16", ticks: new Set<string>(), uploads: [], openAssigned: 1, photosOn: false };
  const none = taskStates(DEFAULT_TASKS, { ...base, entries: [] });
  assert.deepEqual(tally(none), { done: 0, total: 12 });

  const e = entry("2026-11-16", {
    tempF: 79,
    rh: 60,
    dryback: 12,
    observations: "Even canopy.",
    zones: [
      { zone: 1, source: "plant", n: 1, ec: 4, ml: 300 },
      { zone: 1, source: "plant", n: 2, ec: 4, ml: 300 },
      { zone: 2, source: "plant", n: 1, ec: 4, ml: 300 },
    ],
  });
  const some = taskStates(DEFAULT_TASKS, { ...base, entries: [e], ticks: new Set([tickKey("r1", "p1", "2026-11-16"), tickKey("r1", "profile", "2026-11-16")]) });
  const by = Object.fromEntries(some.map((s) => [s.task.id, s]));
  assert.equal(by.health.how, "auto");
  assert.equal(by.dryback.how, "auto");
  assert.equal(by.graphs.how, "auto");
  assert.equal(by.runoff.done, false);
  assert.equal(by.runoff.hint, "1 of 2 zones");
  assert.equal(by.p1.how, "tick");
  assert.equal(by.profile.how, "tick");
  assert.equal(by.canopy.done, false); // photos are off, so it waits for a hand tick
  assert.equal(by.assigned.hint, "1 open");
  assert.deepEqual(tally(some), { done: 5, total: 12 });

  // An export uploaded the same day ticks the graphs line with no typed reading.
  const up = taskStates(DEFAULT_TASKS, { ...base, entries: [], uploads: [{ kind: "environment", day: "2026-11-16" }], openAssigned: 0 });
  assert.equal(up.find((s) => s.task.id === "graphs")!.done, true);
  assert.equal(up.find((s) => s.task.id === "assigned")!.done, true);
});

test("sensor exports: columns found by header, times read as wall clock, long files thinned", () => {
  assert.equal(parseWallTime("2026-11-14 06:30"), Date.UTC(2026, 10, 14, 6, 30));
  assert.equal(parseWallTime("11/14/2026 6:30 PM"), Date.UTC(2026, 10, 14, 18, 30));
  const csv = ["Timestamp,VWC (%),Pore EC (mS/cm),Substrate Temp (F),Notes", "2026-11-14 06:00,45.2,5.1,70,", "2026-11-14 06:15,47.9,4.9,70,x", "2026-11-14 06:30,,4.8,70,"].join("\n");
  const p = parseSensorCsv(csv);
  assert.equal(p.error, undefined);
  assert.equal(p.kind, "substrate");
  assert.deepEqual(Object.keys(p.cols), ["wc", "ec"]);
  assert.deepEqual(p.cols.wc, [45.2, 47.9, null]);
  assert.equal(flowerDayOf(p.t[0], "2026-11-14"), 1.25);

  const env = parseSensorCsv("Date;Air Temp;RH;VPD;CO2\n11/14/2026 8:00 AM;79.5;60;1.2;1100\n11/14/2026 9:00 AM;80;59;1.25;1150\n11/14/2026 10:00 AM;80;59;1.25;1150");
  assert.equal(env.kind, "environment");
  assert.deepEqual(Object.keys(env.cols).sort(), ["co2", "rh", "temp", "vpd"]);

  const long = ["time,vwc"].concat(Array.from({ length: 3000 }, (_, i) => `2026-11-14 ${String(Math.floor(i / 60) % 24).padStart(2, "0")}:${String(i % 60).padStart(2, "0")},${40 + (i % 20)}`)).join("\n");
  assert.ok(parseSensorCsv(long).t.length <= 720);
  assert.match(parseSensorCsv("a,b\n1,2\n3,4").error ?? "", /columns/);
});

test("air VPD", () => {
  assert.equal(vpdKpa(80, 60), 1.4);
  assert.equal(vpdKpa(undefined, 60), undefined);
});
