import { test } from "node:test";
import assert from "node:assert/strict";
import { irrigation } from "../irrigation";
import { quote, TIERS } from "../pricing";
import { evaluateRoom, summarize } from "../rules";
import { draftReport } from "../report";
import { addDays, diffDays, flowerDay, weekStart, isISODate } from "../dates";
import type { Checkin, Cycle, Room } from "../types";

test("irrigation matches the owner's worked example", () => {
  const r = irrigation({ emittersPerPlant: 2, emitterGph: 0.5, shotMin: 5, shotsPerDay: 8, runoffMl: 300 });
  assert.equal(Math.round(r.shotMl), 315);
  assert.equal(Math.round(r.dailyMl), 2524);
  assert.equal(Math.round(r.runoffPct! * 10) / 10, 11.9);
  assert.equal(Math.round(r.netMl!), 2224);
});

test("irrigation has no percentage without a runoff volume and no NaN on bad input", () => {
  assert.equal(irrigation({ emittersPerPlant: 2, emitterGph: 0.5, shotMin: 5, shotsPerDay: 8 }).runoffPct, null);
  const bad = irrigation({ emittersPerPlant: NaN, emitterGph: 0.5, shotMin: 5, shotsPerDay: 8, runoffMl: 10 });
  assert.equal(bad.dailyMl, 0);
  assert.equal(bad.runoffPct, null);
});

test("pricing takes the higher of the two tiers", () => {
  assert.equal(quote(300, 2).tier.monthly, 4000);
  assert.equal(quote(90, 5).tier.monthly, 4000);
  assert.equal(quote(600, 4).tier.monthly, 6000);
  assert.equal(quote(350, 10).tier.monthly, 8000);
  assert.equal(quote(100, 2).tier.monthly, 2000);
  assert.equal(quote(401, 5).tier.monthly, 6000);
  assert.equal(quote(0, 0).tier.slug, "essential");
  assert.equal(quote(300, 2).driver, "lights");
  assert.equal(quote(90, 5).driver, "rooms");
  assert.equal(quote(50, 1).driver, "both");
  assert.equal(TIERS.length, 4);
});

test("dates", () => {
  assert.equal(addDays("2026-11-04", 3), "2026-11-07");
  assert.equal(diffDays("2026-11-01", "2026-11-04"), 3);
  assert.equal(weekStart("2026-11-04"), "2026-11-02");
  assert.equal(weekStart("2026-11-08"), "2026-11-02");
  assert.equal(weekStart("2026-11-02"), "2026-11-02");
  assert.equal(flowerDay("2026-10-08", "2026-11-04"), 28);
  assert.equal(flowerDay("2026-11-10", "2026-11-04"), null);
  assert.ok(isISODate("2026-02-28"));
  assert.ok(!isISODate("2026-02-30"));
});

const room: Room = {
  id: "r1",
  facilityId: "f1",
  name: "Flower 01",
  kind: "flower",
  fixtureModel: "Ion 720W",
  fixtureCount: 42,
  canopySqft: 640,
  substrate: "Coco",
  containerGal: 3,
  plantsPerLight: 12,
  emittersPerPlant: 2,
  emitterGph: 0.5,
  vegDays: 21,
  flowerDays: 63,
  hvac: "",
  dehu: "",
  controller: "",
  sensorPlatform: "Aroya",
  genetics: "",
  targets: { tempF: [76, 82], rh: [55, 65], runoffEcMax: 4.5, runoffPct: [10, 20] },
  createdAt: 0,
};
const cycle: Cycle = { id: "c1", facilityId: "f1", roomId: "r1", genetic: "GMO", flipDate: "2026-10-08", status: "active", createdAt: 0 };
const ci = (day: string, extra: Partial<Checkin>): Checkin => ({
  id: `k${day}`,
  facilityId: "f1",
  roomId: "r1",
  cycleId: "c1",
  at: Date.parse(`${day}T12:00:00Z`),
  day,
  observations: "",
  submittedBy: "client",
  ...extra,
});

test("rules flag runoff, EC, temperature, missing and overdue against the room's own targets", () => {
  const flags = evaluateRoom({
    room,
    cycle,
    today: "2026-11-04",
    checkins: [ci("2026-11-04", { runoffPct: 25, runoffEc: 5.2, tempF: 85, rh: 58 })],
    events: [
      { id: "e1", facilityId: "f1", roomId: "r1", date: "2026-11-01", title: "Defoliation", kind: "task", owner: "client", source: "manual", createdBy: "rgs", createdAt: 0 },
    ],
  });
  const codes = flags.map((f) => f.code).sort();
  assert.deepEqual(codes, ["overdue", "runoff-ec", "runoff-pct", "temp"]);
});

test("rules: a quiet room on target produces no flags, and a stale room is missing", () => {
  const ok = evaluateRoom({ room, cycle, today: "2026-11-04", checkins: [ci("2026-11-03", { runoffPct: 12, runoffEc: 4.0, tempF: 79, rh: 60 })], events: [] });
  assert.deepEqual(ok, []);
  const stale = evaluateRoom({ room, cycle, today: "2026-11-10", checkins: [ci("2026-11-03", { runoffPct: 12 })], events: [] });
  assert.equal(stale[0].severity, "missing");
  const none = evaluateRoom({ room, cycle, today: "2026-11-10", checkins: [], events: [] });
  assert.equal(none[0].code, "no-checkin");
});

test("rules: drift is info only when the latest reading is still inside the target", () => {
  const flags = evaluateRoom({
    room,
    cycle,
    today: "2026-11-04",
    checkins: [ci("2026-11-04", { runoffPct: 19 }), ci("2026-11-02", { runoffPct: 11 }), ci("2026-10-31", { runoffPct: 12 }), ci("2026-10-29", { runoffPct: 13 })],
    events: [],
  });
  assert.equal(flags.length, 1);
  assert.equal(flags[0].code, "runoff-drift");
  assert.equal(flags[0].severity, "info");
});

test("rules: overdue names the oldest task, and milestones never count as overdue", () => {
  const ev = (id: string, date: string, title: string, kind: "task" | "flip" | "harvest") => ({
    id,
    facilityId: "f1",
    roomId: "r1",
    date,
    title,
    kind,
    owner: "client" as const,
    source: "manual" as const,
    createdBy: "rgs" as const,
    createdAt: 0,
  });
  const flags = evaluateRoom({
    room,
    cycle,
    today: "2026-11-05",
    checkins: [ci("2026-11-05", { runoffPct: 12 })],
    events: [ev("a", "2026-11-03", "Newer task", "task"), ev("b", "2026-11-01", "Older task", "task"), ev("c", "2026-10-08", "Flower 01 flipped", "flip")],
  });
  const over = flags.find((f) => f.code === "overdue")!;
  assert.equal(over.text, '2 tasks are past due, the oldest "Older task" by 4 days.');
  assert.equal(over.day, "2026-11-01");
});

test("rules: a planned harvest that has passed with the run open is a note, not a task", () => {
  const late: Cycle = { ...cycle, flipDate: "2026-08-01" }; // day 63 on 2026-10-02
  const flags = evaluateRoom({ room, cycle: late, today: "2026-10-05", checkins: [ci("2026-10-05", { runoffPct: 12 })], events: [] });
  const f = flags.find((x) => x.code === "harvest-passed")!;
  assert.equal(f.severity, "info");
  assert.match(f.text, /was 3 days ago and the run is still open/);
  assert.ok(!flags.some((x) => x.code === "overdue"));
});

test("rules: harvest inside the lookahead is info", () => {
  const near: Cycle = { ...cycle, flipDate: "2026-09-05" }; // day 63 on 2026-11-06
  const flags = evaluateRoom({ room, cycle: near, today: "2026-11-04", checkins: [ci("2026-11-04", { runoffPct: 12 })], events: [] });
  assert.equal(flags.find((f) => f.code === "harvest-soon")?.text, "Planned harvest in 2 days.");
});

test("summarize counts a room once at its worst severity", () => {
  const s = summarize(["r1", "r2", "r3"], [
    { roomId: "r1", roomName: "a", severity: "attention", code: "x", text: "" },
    { roomId: "r1", roomName: "a", severity: "missing", code: "y", text: "" },
    { roomId: "r2", roomName: "b", severity: "info", code: "z", text: "" },
  ]);
  assert.deepEqual(s, { rooms: 3, onTarget: 2, flagged: 0, missing: 1 });
});

test("the report draft reads the week back in plain sentences", () => {
  const d = draftReport({
    weekOf: "2026-10-26",
    rooms: [room],
    cycles: [cycle],
    checkins: [
      ci("2026-10-27", { runoffPct: 12, runoffEc: 4.8, feedEc: 3.0, tempF: 80, rh: 58, observations: "Slight tip burn on the left bench." }),
      ci("2026-10-29", { runoffPct: 14, runoffEc: 5.0, feedEc: 3.0, tempF: 81, rh: 57 }),
    ],
    events: [
      { id: "e1", facilityId: "f1", roomId: "r1", date: "2026-10-28", title: "Defoliation", kind: "task", owner: "client", source: "manual", createdBy: "rgs", createdAt: 0, doneAt: 1 },
      { id: "e2", facilityId: "f1", roomId: "r1", date: "2026-10-30", title: "EC review", kind: "review", owner: "rgs", source: "call", createdBy: "rgs", createdAt: 0 },
    ],
    upcoming: [{ id: "e3", facilityId: "f1", roomId: "r1", date: "2026-11-05", title: "Weekly call", kind: "call", owner: "rgs", source: "auto", createdBy: "rgs", createdAt: 0 }],
    flags: [{ roomId: "r1", roomName: "Flower 01", severity: "attention", code: "runoff-ec", text: "Runoff EC 5.0 above the room's 4.5 ceiling." }],
  });
  assert.match(d.behind[0], /Flower 01, GMO, day 19 to 25\. 2 check-ins\. Runoff averaged 13%, inside the 10 to 20% target\. Runoff EC averaged 4\.9 against a 3 feed, above the 4\.5 ceiling\./);
  assert.match(d.behind[0], /tip burn/);
  assert.match(d.behind[1], /Completed: Defoliation/);
  assert.match(d.behind[2], /Still open from the week: EC review/);
  assert.equal(d.actions[0].text, "EC review (Flower 01)");
  assert.match(d.ahead[0], /Nov 5: Weekly call/);
  assert.match(d.ahead[1], /opens next week on day 26 of 63/);
  assert.equal(d.exceptions.length, 1);
});
