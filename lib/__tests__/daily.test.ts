import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRoom, weekdaysMissed } from "../rules";
import { DEFAULT_TASKS, taskStates } from "../tasks";
import { levelOf, SERVICE_LEVELS } from "../site";
import { videoPath, videoPrefix, videoType, VIDEO_TYPES } from "../video";
import type { Checkin, Cycle, Room } from "../types";

/**
 * Jake's answers of 2026-11-16: data is due daily, there are three levels of
 * service, and a canopy video is attached to the room's day.
 */

const room = { id: "r1", facilityId: "f1", name: "Flower 01", kind: "flower", feedZones: 2, emittersPerPlant: 2, emitterGph: 0.5, vegDays: 21, flowerDays: 63, targets: { tempF: [76, 82], rh: [55, 65], runoffPct: [10, 20] } } as Room;
const cycle: Cycle = { id: "c1", facilityId: "f1", roomId: "r1", genetic: "GMO", flipDate: "2026-10-08", status: "active", createdAt: 0 };
const ci = (day: string, extra: Partial<Checkin> = {}): Checkin => ({ id: `k${day}`, facilityId: "f1", roomId: "r1", cycleId: "c1", at: 0, day, observations: "", submittedBy: "client", tempF: 79, rh: 60, ...extra });

test("daily: a weekday that ended with no entry is missed; the weekend and today are not", () => {
  // 2026-11-13 is a Friday, 11-16 a Monday.
  assert.deepEqual(weekdaysMissed("2026-11-13", "2026-11-16"), []);
  assert.deepEqual(weekdaysMissed("2026-11-16", "2026-11-16"), []);
  assert.deepEqual(weekdaysMissed("2026-11-16", "2026-11-17"), []);
  assert.deepEqual(weekdaysMissed("2026-11-16", "2026-11-18"), ["2026-11-17"]);
  assert.deepEqual(weekdaysMissed("2026-11-12", "2026-11-16"), ["2026-11-13"]);
  assert.equal(weekdaysMissed("2026-11-03", "2026-11-10").length, 4);
  // A date years back does not spin: the count stops at sixty days of looking.
  assert.ok(weekdaysMissed("2020-01-01", "2026-11-16").length <= 60);
});

test("daily: the room is flagged the morning after a missed weekday, in words that name the day", () => {
  const flag = (last: string, today: string) => evaluateRoom({ room, cycle, checkins: [ci(last)], events: [], today }).find((f) => f.code === "stale");
  assert.equal(flag("2026-11-13", "2026-11-16"), undefined); // Friday's entry, Monday morning
  assert.equal(flag("2026-11-16", "2026-11-17"), undefined); // yesterday's entry
  assert.equal(flag("2026-11-16", "2026-11-18")?.text, "No entry on Tuesday.");
  assert.equal(flag("2026-11-16", "2026-11-18")?.severity, "missing");
  assert.match(flag("2026-11-10", "2026-11-16")?.text ?? "", /^No entry for 3 weekdays\. The last one was Tue, Nov 10\.$/);
});

test("video: the canopy line ticks from a video as it does from a photo, and only when storage is on", () => {
  const base = { room, day: "2026-11-16", ticks: new Set<string>(), uploads: [], openAssigned: 0 };
  const canopy = (photosOn: boolean, e: Partial<Checkin>) => taskStates(DEFAULT_TASKS, { ...base, photosOn, entries: [ci("2026-11-16", e)] }).find((s) => s.task.id === "canopy")!;
  assert.equal(canopy(true, {}).done, false);
  assert.equal(canopy(true, { videoUrl: "https://store.example/v.mov" }).done, true);
  assert.equal(canopy(true, { photoUrl: "https://store.example/p.jpg" }).done, true);
  assert.equal(canopy(false, { videoUrl: "https://store.example/v.mov" }).done, false);
});

test("video: the type comes from the file, then from its name; anything else is refused", () => {
  assert.equal(videoType({ type: "video/quicktime", name: "IMG_0412.MOV" }), "video/quicktime");
  assert.equal(videoType({ type: "", name: "IMG_0412.MOV" }), "video/quicktime");
  assert.equal(videoType({ type: "", name: "walk.m4v" }), "video/mp4");
  assert.equal(videoType({ type: "application/octet-stream", name: "clip.mp4" }), "video/mp4");
  assert.equal(videoType({ type: "image/jpeg", name: "canopy.jpg" }), null);
  assert.equal(videoType({ type: "", name: "noending" }), null);
  // The path the route signs is the path the action later checks.
  for (const ext of Object.values(VIDEO_TYPES)) assert.ok(videoPath("demo", "room_1", "2026-11-16", ext).startsWith(videoPrefix("demo", "room_1", "2026-11-16")));
  assert.ok(!videoPath("demo", "room_10", "2026-11-16", "mp4").startsWith(videoPrefix("demo", "room_1", "2026-11-16")));
});

test("levels: three, in his order, and an unknown one reads as not set", () => {
  assert.deepEqual(SERVICE_LEVELS.map((l) => l.id), ["remote", "middle", "top"]);
  assert.equal(levelOf("middle")?.reviews, "Your rooms are reviewed three times a week.");
  assert.equal(levelOf(undefined), undefined);
  assert.equal(levelOf("platinum"), undefined);
});
