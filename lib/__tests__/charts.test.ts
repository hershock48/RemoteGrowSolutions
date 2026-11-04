import { test } from "node:test";
import assert from "node:assert/strict";
import { niceStep, ticks, yDomain, xDomain, scale, isOutside } from "../chart";
import { compliance, quarterOf, previousQuarter, quarterKpis, runReadings, ecSeries, timeline, delta } from "../series";
import type { Checkin, Cycle, Room } from "../types";

test("nice steps and ticks", () => {
  assert.equal(niceStep(10, 4), 2);
  assert.equal(niceStep(3, 4), 1);
  assert.equal(niceStep(0.9, 4), 0.2);
  assert.deepEqual(ticks([0, 10], 4), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(ticks([2.3, 5.1], 4), [2.5, 3, 3.5, 4, 4.5, 5]);
});

test("domains pad and include the band and ceiling, and never dip below zero for positive data", () => {
  const s = [{ name: "a", points: [{ x: 1, y: 3 }, { x: 2, y: 4 }], ceiling: 4.5, band: [2, 6] as [number, number] }];
  const [lo, hi] = yDomain(s);
  assert.ok(lo < 2 && lo >= 0, `lo ${lo}`);
  assert.ok(hi > 6, `hi ${hi}`);
  assert.deepEqual(xDomain(s, [10]), [1, 10]);
  assert.deepEqual(xDomain([{ name: "a", points: [{ x: 5, y: 1 }] }]), [4, 6]);
  const sx = scale([0, 10], [0, 100]);
  assert.equal(sx(5), 50);
  assert.ok(isOutside(s[0], { x: 1, y: 4.6 }));
  assert.ok(isOutside(s[0], { x: 1, y: 1 }));
  assert.ok(!isOutside(s[0], { x: 1, y: 3 }));
});

const room: Room = {
  id: "r1", facilityId: "f1", name: "Flower 01", kind: "flower", fixtureModel: "", fixtureCount: 42, canopySqft: 640, substrate: "Coco", containerGal: 3,
  plantsPerLight: 12, emittersPerPlant: 2, emitterGph: 0.5, vegDays: 21, flowerDays: 63, hvac: "", dehu: "", controller: "", sensorPlatform: "", genetics: "",
  targets: { tempF: [76, 82], rh: [55, 65], feedEc: [2.8, 3.2], runoffEcMax: 4.5, runoffPct: [10, 20] }, createdAt: 0,
};
const cycle: Cycle = { id: "c1", facilityId: "f1", roomId: "r1", genetic: "GMO", flipDate: "2026-10-08", status: "active", createdAt: 0 };
const ci = (day: string, extra: Partial<Checkin>): Checkin => ({ id: `k${day}`, facilityId: "f1", roomId: "r1", cycleId: "c1", at: Date.parse(`${day}T12:00:00Z`), day, observations: "", submittedBy: "client", ...extra });

test("run readings carry a flower day and the EC series pairs feed with runoff", () => {
  const rs = runReadings([ci("2026-10-12", { feedEc: 3, runoffEc: 4.1 }), ci("2026-10-10", { feedEc: 3, runoffEc: 3.9 }), ci("2026-10-05", { feedEc: 3 })], cycle);
  assert.deepEqual(rs.map((r) => r.day), [3, 5]);
  const [runoff, feed] = ecSeries(rs, room);
  assert.deepEqual(runoff.points, [{ x: 3, y: 3.9 }, { x: 5, y: 4.1 }]);
  assert.equal(feed.points.length, 2);
  assert.equal(runoff.ceiling, 4.5);
});

test("timeline clamps and reports overrun", () => {
  const t = timeline(room, cycle, "2026-11-04");
  assert.equal(t.day, 28);
  assert.equal(t.total, 63);
  assert.equal(Math.round(t.frac * 100), 44);
  assert.equal(t.over, 0);
  const late = timeline(room, { ...cycle, flipDate: "2026-08-01" }, "2026-10-05");
  assert.equal(late.frac, 1);
  assert.equal(late.over, 3);
});

test("compliance counts check-ins per Monday week, newest last, current marked", () => {
  const cs = [ci("2026-10-19", {}), ci("2026-10-21", {}), ci("2026-10-23", {}), ci("2026-10-28", {}), ci("2026-11-02", {})];
  const w = compliance(cs, "2026-11-04");
  assert.deepEqual(w.map((x) => x.weekOf), ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"]);
  assert.deepEqual(w.map((x) => x.count), [0, 3, 1, 1]);
  assert.equal(w[3].current, true);
  assert.equal(w[0].current, false);
});

test("quarters and KPIs", () => {
  const q = quarterOf("2026-11-04");
  assert.deepEqual(q, { label: "Q4 2026", from: "2026-10-01", to: "2026-12-31" });
  assert.deepEqual(previousQuarter(q), { label: "Q3 2026", from: "2026-07-01", to: "2026-09-30" });
  assert.equal(quarterOf("2026-01-15").to, "2026-03-31");
  const cycles: Cycle[] = [
    { ...cycle, id: "a", status: "harvested", flipDate: "2026-08-01", harvestedOn: "2026-10-03", outcome: { dryGrams: 32000 } },
    { ...cycle, id: "b", status: "harvested", flipDate: "2026-08-20", harvestedOn: "2026-10-20", outcome: {} },
    { ...cycle, id: "c", status: "harvested", flipDate: "2026-05-01", harvestedOn: "2026-07-05", outcome: { dryGrams: 28800 } },
  ];
  const k = quarterKpis(cycles, [room], q);
  assert.equal(k.harvests, 2);
  assert.equal(k.weighed, 1);
  assert.equal(k.gPerSqft, 50);
  assert.equal(k.daysInFlower, (64 + 62) / 2);
  const p = quarterKpis(cycles, [room], previousQuarter(q));
  assert.equal(p.harvests, 1);
  assert.equal(p.gPerSqft, 45);
  assert.equal(delta(k.gPerSqft, p.gPerSqft), 5);
  assert.equal(delta(null, 1), null);
});
