// Seeds the local development store with one believable facility, so the
// screens have something to show before a real grower types a number.
//
//   node --import ./lib/__tests__/resolve-ts.mjs scripts/seed.mjs
//
// Writes to .data/rgs (the same embedded Postgres the dev server opens), so
// run it with the server stopped. Idempotent in the only way that matters:
// it deletes the demo facility first and rebuilds it.
//
// Sign-in: facility "demo", passcode "grow-demo". Not a secret; it is in the
// README. The consultant door in development is "rgs-dev".

import { PGlite } from "@electric-sql/pglite";
import { SCHEMA, DEV_DATA_DIR } from "../lib/schema.ts";
import { hashPasscode, newSalt } from "../lib/passcode.ts";
import { irrigation } from "../lib/irrigation.ts";
import { addDays, flowerDay, todayIn, weekStart } from "../lib/dates.ts";
import { draftReport } from "../lib/report.ts";
import { evaluateRoom } from "../lib/rules.ts";

import { mkdir } from "node:fs/promises";
await mkdir(`${process.cwd()}/${DEV_DATA_DIR}`, { recursive: true });
const pg = new PGlite(`${process.cwd()}/${DEV_DATA_DIR}`);
await pg.exec(SCHEMA);

const id = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const j = (v) => JSON.stringify(v);
const today = todayIn("America/Detroit");
const now = Date.now();
const DAY = 86_400_000;

// Wipe the previous demo.
const prev = await pg.query(`SELECT id FROM facilities WHERE slug = 'demo'`);
for (const r of prev.rows) {
  for (const t of ["rooms", "cycles", "checkins", "events", "call_notes", "reports"]) await pg.query(`DELETE FROM ${t} WHERE facility_id = $1`, [r.id]);
  await pg.query(`DELETE FROM facilities WHERE id = $1`, [r.id]);
}

const salt = newSalt();
const facility = {
  id: id("fac"),
  slug: "demo",
  name: "Northstar Cultivation (demo)",
  contact: "Dana Reyes, head grower",
  email: "dana@example.com",
  phone: "(555) 010-0199",
  state: "Michigan",
  timezone: "America/Detroit",
  flowerRooms: 4,
  lightsTotal: 168,
  canopySqft: 2560,
  vegRooms: 1,
  momRooms: 1,
  equipment: {
    lighting: "Fluence SPYDR 2p, 42 per flower room, Growlink controller.",
    hvac: "Two 10-ton Quest split systems per room.",
    dehu: "Quest 506, two per flower room.",
    irrigation: "Growlink irrigation controller, 4 zones per room, 2 × 0.5 GPH Netafim emitters per plant.",
    substrate: "Grodan Hugo 6x6x6 on Grodan slabs; 1-gallon coco in veg.",
    nutrients: "Athena Pro Line, two-part, Dosatron injectors.",
    sensors: "Aroya Teros 12, four per room, API read access granted to RGS.",
    water: "City water through RO, starting EC 0.1, pH 6.0 after RO.",
    cultivation: "GMO, Gelato 41, Permanent Marker. 12 plants per light. 21-day veg, 63-day flower, one room flipping every two weeks.",
    operations: "Head grower plus three cultivation techs. Target 55 g/sq ft. 2025 average 48 g/sq ft.",
  },
  readiness: "conditional",
  readinessNote: "Mother room has no RH control and clone success is running at 72%. Corrective plan agreed on the first call; reviewed at week 4.",
  passcodeSalt: salt,
  passcodeHash: hashPasscode(salt, "grow-demo"),
  createdAt: now - 30 * DAY,
};
await pg.query(`INSERT INTO facilities (id, slug, created_at, data) VALUES ($1, $2, $3, $4::jsonb)`, [facility.id, facility.slug, facility.createdAt, j(facility)]);

const roomBase = {
  facilityId: facility.id,
  fixtureModel: "Fluence SPYDR 2p",
  fixtureCount: 42,
  canopySqft: 640,
  substrate: "Rockwool",
  containerGal: 1.6,
  plantsPerLight: 12,
  emittersPerPlant: 2,
  emitterGph: 0.5,
  vegDays: 21,
  flowerDays: 63,
  hvac: "2 × Quest 10-ton",
  dehu: "2 × Quest 506",
  controller: "Growlink",
  sensorPlatform: "Aroya",
  genetics: "GMO, Gelato 41",
  createdAt: now - 29 * DAY,
};
const flowerTargets = { tempF: [76, 82], rh: [55, 65], ppfd: [850, 1050], feedEc: [2.8, 3.2], runoffEcMax: 4.5, runoffPct: [10, 20] };

const rooms = [
  { ...roomBase, id: id("room"), name: "Flower 01", kind: "flower", targets: flowerTargets },
  { ...roomBase, id: id("room"), name: "Flower 02", kind: "flower", targets: flowerTargets },
  { ...roomBase, id: id("room"), name: "Flower 03", kind: "flower", targets: { ...flowerTargets, runoffPct: [15, 25] } },
  { ...roomBase, id: id("room"), name: "Flower 04", kind: "flower", targets: flowerTargets },
  { ...roomBase, id: id("room"), name: "Veg", kind: "veg", fixtureCount: 24, canopySqft: 480, substrate: "Coco", containerGal: 1, emittersPerPlant: 1, emitterGph: 0.5, targets: { tempF: [76, 80], rh: [65, 75], runoffPct: [10, 20] } },
  { ...roomBase, id: id("room"), name: "Mothers", kind: "mom", fixtureCount: 8, canopySqft: 160, substrate: "Coco", containerGal: 3, emittersPerPlant: 2, emitterGph: 0.5, targets: { tempF: [74, 80], rh: [60, 70], runoffPct: [10, 20] } },
];
for (const r of rooms) await pg.query(`INSERT INTO rooms (id, facility_id, created_at, data) VALUES ($1, $2, $3, $4::jsonb)`, [r.id, r.facilityId, r.createdAt, j(r)]);

// Four flower rooms at four points in the cycle: day 52, day 38, day 24, day 10.
const flips = [51, 37, 23, 9].map((back) => addDays(today, -back));
const genetics = ["GMO", "Gelato 41", "Permanent Marker", "GMO"];
const cycles = rooms.slice(0, 4).map((r, i) => ({
  id: id("cyc"),
  facilityId: facility.id,
  roomId: r.id,
  genetic: genetics[i],
  flipDate: flips[i],
  plannedHarvest: addDays(flips[i], 62),
  status: "active",
  createdAt: now - (51 - i * 14) * DAY,
}));
for (const c of cycles) await pg.query(`INSERT INTO cycles (id, facility_id, room_id, status, data) VALUES ($1, $2, $3, $4, $5::jsonb)`, [c.id, c.facilityId, c.roomId, c.status, j(c)]);

// A finished run on Flower 01, for the history.
const past = {
  id: id("cyc"),
  facilityId: facility.id,
  roomId: rooms[0].id,
  genetic: "Gelato 41",
  flipDate: addDays(flips[0], -70),
  plannedHarvest: addDays(flips[0], -8),
  status: "harvested",
  harvestedOn: addDays(flips[0], -7),
  outcome: { dryGrams: 29800, note: "46.6 g/sq ft. Runoff EC ran high from day 35." },
  createdAt: now - 121 * DAY,
};
await pg.query(`INSERT INTO cycles (id, facility_id, room_id, status, data) VALUES ($1, $2, $3, $4, $5::jsonb)`, [past.id, past.facilityId, past.roomId, past.status, j(past)]);

// Check-ins: Mon/Wed/Fri for the last three weeks, per flower room. Room 02
// drifts high on runoff EC; Room 04 stops submitting six days ago.
const rnd = (lo, hi, d = 1) => Math.round((lo + Math.random() * (hi - lo)) * 10 ** d) / 10 ** d;
const events = [];
for (let i = 0; i < 4; i++) {
  const room = rooms[i];
  const cycle = cycles[i];
  for (let back = 21; back >= 0; back--) {
    const day = addDays(today, -back);
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (![1, 3, 5].includes(dow)) continue;
    if (i === 3 && back < 6) continue; // Flower 04 goes quiet.
    const fd = flowerDay(cycle.flipDate, day);
    if (fd === null) continue;
    const late = fd > 45;
    const shotMin = late ? 4 : 5;
    const shots = late ? 5 : 8;
    const runoffMl = i === 2 ? rnd(380, 520, 0) : rnd(220, 420, 0);
    const calc = irrigation({ emittersPerPlant: 2, emitterGph: 0.5, shotMin, shotsPerDay: shots, runoffMl });
    const ecDrift = i === 1 ? (21 - back) * 0.06 : 0;
    const feedEc = late ? 2.6 : 3.0;
    const c = {
      id: id("chk"),
      facilityId: facility.id,
      roomId: room.id,
      cycleId: cycle.id,
      at: Date.parse(`${day}T13:30:00Z`) + i * 600_000,
      day,
      dayOfFlower: fd,
      tempF: rnd(77, 81),
      rh: late ? rnd(50, 58, 0) : rnd(56, 63, 0),
      ppfd: rnd(900, 1000, 0),
      co2: rnd(1000, 1200, 0),
      feedEc,
      feedPh: rnd(5.7, 5.9, 2),
      runoffEc: Math.round((feedEc * 1.35 + ecDrift + rnd(-0.2, 0.2, 2)) * 100) / 100,
      runoffPh: rnd(5.9, 6.3, 2),
      runoffMl,
      shotMin,
      shotsPerDay: shots,
      feedMl: calc.dailyMl,
      runoffPct: calc.runoffPct,
      substrateWc: late ? rnd(42, 50, 0) : rnd(55, 62, 0),
      substrateEc: Math.round((feedEc * 1.4 + ecDrift) * 100) / 100,
      dryback: late ? rnd(14, 20, 0) : rnd(8, 12, 0),
      observations: back === 7 && i === 1 ? "Slight tip burn on the two benches nearest the door." : back === 2 && i === 0 ? "Fade starting on the GMO, on schedule." : "",
      submittedBy: "client",
    };
    await pg.query(`INSERT INTO checkins (id, facility_id, room_id, day, at, data) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`, [c.id, c.facilityId, c.roomId, c.day, c.at, j(c)]);
  }
  events.push(
    { date: cycle.flipDate, title: `${room.name} flipped`, kind: "flip", owner: "client", source: "auto", roomId: room.id, cycleId: cycle.id, done: true },
    { date: cycle.plannedHarvest, title: `${room.name} planned harvest`, kind: "harvest", owner: "client", source: "auto", roomId: room.id, cycleId: cycle.id },
    { date: addDays(cycle.flipDate, 20), title: "Defoliation, day 21", kind: "task", owner: "client", source: "manual", roomId: room.id, cycleId: cycle.id, done: flowerDay(cycle.flipDate, today) > 21 },
    { date: addDays(cycle.flipDate, 41), title: "Second defoliation, day 42", kind: "task", owner: "client", source: "manual", roomId: room.id, cycleId: cycle.id, done: flowerDay(cycle.flipDate, today) > 43 }
  );
}
// Weekly calls, past and future; one past-due task; a transplant into Flower 04's successor.
const thisMonday = weekStart(today);
for (let w = -3; w <= 2; w++) events.push({ date: addDays(thisMonday, w * 7 + 3), title: "Weekly consultation", kind: "call", owner: "rgs", source: "auto", done: w < 0 });
events.push({ date: addDays(today, -4), title: "Verify emitter delivery rates with a cup test", kind: "task", owner: "client", source: "call", roomId: rooms[1].id });
events.push({ date: addDays(today, 5), title: "Transplant Permanent Marker clones to veg", kind: "transplant", owner: "client", source: "manual", roomId: rooms[4].id });
events.push({ date: addDays(today, 2), title: "Review Flower 02 substrate EC trend", kind: "review", owner: "rgs", source: "call", roomId: rooms[1].id });
for (const e of events) {
  const row = {
    id: id("ev"),
    facilityId: facility.id,
    roomId: e.roomId,
    cycleId: e.cycleId,
    date: e.date,
    title: e.title,
    kind: e.kind,
    owner: e.owner,
    source: e.source,
    doneAt: e.done ? Date.parse(`${e.date}T20:00:00Z`) : undefined,
    doneBy: e.done ? "client" : undefined,
    createdBy: e.source === "auto" || e.source === "call" ? "rgs" : "client",
    createdAt: now - 20 * DAY,
  };
  await pg.query(`INSERT INTO events (id, facility_id, date, data) VALUES ($1, $2, $3, $4::jsonb)`, [row.id, row.facilityId, row.date, j(row)]);
}

// Last week's call, written up.
const lastCall = addDays(thisMonday, -4);
const note = {
  id: id("call"),
  facilityId: facility.id,
  heldOn: lastCall,
  weekOf: weekStart(lastCall),
  internal:
    "Flower 02 runoff EC climbing roughly 0.3 a week against a flat 3.0 feed; substrate EC tracking the same line. Not a feed-recipe problem yet: shot count dropped to 7 on two days (missed first irrigation after the controller reset) so the slab is not flushing. Rule out emitter variance first (cup test), then restore 8 shots and re-read for a week before touching EC. Flower 01 on schedule into fade. Flower 04 clean at day 7. Mother room RH still uncontrolled; clone take 72%.",
  client:
    "Flower 02 is running higher runoff EC each week while the feed has stayed at 3.0. Before changing the recipe, confirm the emitters are delivering what the label says (cup test on six plants, two minutes each) and get the shot count back to eight every day. We will read it again next week. Flower 01 is on schedule into its fade. Flower 04 looks clean at day 7. The mother room needs humidity control before the next round of cuts.",
  actions: [
    { text: "Verify emitter delivery rates with a cup test", owner: "client", due: addDays(today, -4) },
    { text: "Restore eight shots a day on Flower 02", owner: "client" },
    { text: "Review Flower 02 substrate EC trend", owner: "rgs", due: addDays(today, 2) },
  ],
  approvedAt: Date.parse(`${lastCall}T22:00:00Z`),
  createdAt: Date.parse(`${lastCall}T21:00:00Z`),
};
await pg.query(`INSERT INTO call_notes (id, facility_id, week_of, data) VALUES ($1, $2, $3, $4::jsonb)`, [note.id, note.facilityId, note.weekOf, j(note)]);

// Last week's report, drafted the same way the app drafts it, then approved.
const weekOf = addDays(thisMonday, -7);
const weekEnd = addDays(weekOf, 6);
const inWeek = (await pg.query(`SELECT data FROM checkins WHERE facility_id = $1 AND day >= $2 AND day <= $3`, [facility.id, weekOf, weekEnd])).rows.map((r) => r.data);
const evWeek = (await pg.query(`SELECT data FROM events WHERE facility_id = $1 AND date >= $2 AND date <= $3`, [facility.id, weekOf, weekEnd])).rows.map((r) => r.data);
const evNext = (await pg.query(`SELECT data FROM events WHERE facility_id = $1 AND date >= $2 AND date <= $3`, [facility.id, addDays(weekEnd, 1), addDays(weekEnd, 7)])).rows.map((r) => r.data);
const recent = (await pg.query(`SELECT data FROM checkins WHERE facility_id = $1 AND day <= $2 ORDER BY at DESC`, [facility.id, weekEnd])).rows.map((r) => r.data);
const flags = rooms.flatMap((room) =>
  evaluateRoom({ room, cycle: cycles.find((c) => c.roomId === room.id) ?? null, checkins: recent.filter((c) => c.roomId === room.id).slice(0, 4), events: [], today: weekEnd })
);
const draft = draftReport({ weekOf, rooms, cycles, checkins: inWeek, events: evWeek, upcoming: evNext, flags });
const report = {
  id: id("rep"),
  facilityId: facility.id,
  weekOf,
  status: "approved",
  ...draft,
  note: "A steady week except Flower 02, where runoff EC is drifting up while the feed has not moved. The two actions below settle whether that is delivery or recipe. Everything else is on schedule.",
  approvedAt: Date.parse(`${addDays(weekEnd, 1)}T15:00:00Z`),
  createdAt: Date.parse(`${addDays(weekEnd, 1)}T14:00:00Z`),
};
await pg.query(`INSERT INTO reports (id, facility_id, week_of, data) VALUES ($1, $2, $3, $4::jsonb)`, [report.id, report.facilityId, report.weekOf, j(report)]);

// Two inquiries for the consultant's inbox.
for (const q of [
  { name: "Marcus Hill", email: "marcus@example.com", phone: "", facility: "Hill Family Farms", state: "Michigan", lights: "96", rooms: "2", sensors: "Growlink", note: "Two rooms, inconsistent yields between them, want a second set of eyes weekly.", status: "new" },
  { name: "Priya Natarajan", email: "", phone: "(555) 010-0144", facility: "Great Lakes Botanicals", state: "Michigan", lights: "420", rooms: "6", sensors: "Aroya", note: "", status: "contacted" },
]) {
  const row = { id: id("inq"), ...q, createdAt: now - rnd(1, 9, 0) * DAY };
  await pg.query(`INSERT INTO inquiries (id, created_at, data) VALUES ($1, $2, $3::jsonb)`, [row.id, row.createdAt, j(row)]);
}

await pg.close();
console.log(`seeded facility "demo" (passcode grow-demo): ${rooms.length} rooms, ${cycles.length} active runs, ${events.length} events, report for week of ${weekOf}`);
