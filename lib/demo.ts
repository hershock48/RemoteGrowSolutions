import { hashPasscode, newSalt } from "./passcode";
import { irrigation } from "./irrigation";
import { addDays, flowerDay, weekStart } from "./dates";
import { draftReport } from "./report";
import { evaluateRoom } from "./rules";
import type { CalEvent, CallNote, Checkin, Cycle, Facility, Inquiry, Report, Room, Targets } from "./types";

/**
 * One believable facility, written into whatever store it is handed: the
 * laptop's on-disk store by `npm run seed`, or the in-memory store a
 * deployment runs on when no database is attached (lib/store.ts). That
 * second case is what makes a bare Vercel preview a working demo instead of
 * an empty dashboard with a closed door.
 *
 * Sign-in: facility "demo", passcode "grow-demo". Not a secret.
 *
 * Everything is dated from `today`, so the runs sit at day 52, 38, 24 and 10
 * whenever it runs. Flower 02 drifts up on runoff EC, Flower 04 stops
 * submitting, one task is past due, last week has an approved report and a
 * written-up call, and each room has finished runs behind it for the
 * quarter figures.
 */

type Querier = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

export const DEMO_SLUG = "demo";
export const DEMO_PASSCODE = "grow-demo";

export async function seedDemo(q: Querier, today: string): Promise<string> {
  const id = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const j = (v: unknown) => JSON.stringify(v);
  const rnd = (lo: number, hi: number, d = 1) => Math.round((lo + Math.random() * (hi - lo)) * 10 ** d) / 10 ** d;
  const now = Date.now();
  const DAY = 86_400_000;

  // Wipe a previous demo, so the seed is repeatable.
  const prev = await q.query(`SELECT id FROM facilities WHERE slug = $1`, [DEMO_SLUG]);
  for (const r of prev.rows) {
    for (const t of ["rooms", "cycles", "checkins", "events", "call_notes", "reports"]) await q.query(`DELETE FROM ${t} WHERE facility_id = $1`, [r.id]);
    await q.query(`DELETE FROM facilities WHERE id = $1`, [r.id]);
  }

  const salt = newSalt();
  const facility: Facility = {
    id: id("fac"),
    slug: DEMO_SLUG,
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
    passcodeHash: hashPasscode(salt, DEMO_PASSCODE),
    createdAt: now - 30 * DAY,
  };
  await q.query(`INSERT INTO facilities (id, slug, created_at, data) VALUES ($1, $2, $3, $4::jsonb)`, [facility.id, facility.slug, facility.createdAt, j(facility)]);

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
  const flowerTargets: Targets = { tempF: [76, 82], rh: [55, 65], ppfd: [850, 1050], feedEc: [2.8, 3.2], runoffEcMax: 4.5, runoffPct: [10, 20] };

  const rooms: Room[] = [
    { ...roomBase, id: id("room"), name: "Flower 01", kind: "flower", targets: flowerTargets },
    { ...roomBase, id: id("room"), name: "Flower 02", kind: "flower", targets: flowerTargets },
    { ...roomBase, id: id("room"), name: "Flower 03", kind: "flower", targets: { ...flowerTargets, runoffPct: [15, 25] } },
    { ...roomBase, id: id("room"), name: "Flower 04", kind: "flower", targets: flowerTargets },
    { ...roomBase, id: id("room"), name: "Veg", kind: "veg", fixtureCount: 24, canopySqft: 480, substrate: "Coco", containerGal: 1, emittersPerPlant: 1, emitterGph: 0.5, targets: { tempF: [76, 80], rh: [65, 75], runoffPct: [10, 20] } },
    { ...roomBase, id: id("room"), name: "Mothers", kind: "mom", fixtureCount: 8, canopySqft: 160, substrate: "Coco", containerGal: 3, emittersPerPlant: 2, emitterGph: 0.5, targets: { tempF: [74, 80], rh: [60, 70], runoffPct: [10, 20] } },
  ];
  for (const r of rooms) await q.query(`INSERT INTO rooms (id, facility_id, created_at, data) VALUES ($1, $2, $3, $4::jsonb)`, [r.id, r.facilityId, r.createdAt, j(r)]);

  // Four flower rooms at four points in the cycle: day 52, day 38, day 24, day 10.
  const flips = [51, 37, 23, 9].map((back) => addDays(today, -back));
  const genetics = ["GMO", "Gelato 41", "Permanent Marker", "GMO"];
  const cycles: Cycle[] = rooms.slice(0, 4).map((r, i) => ({
    id: id("cyc"),
    facilityId: facility.id,
    roomId: r.id,
    genetic: genetics[i],
    flipDate: flips[i],
    plannedHarvest: addDays(flips[i], 62),
    status: "active",
    createdAt: now - (51 - i * 14) * DAY,
  }));
  const saveCycle = (c: Cycle) => q.query(`INSERT INTO cycles (id, facility_id, room_id, status, data) VALUES ($1, $2, $3, $4, $5::jsonb)`, [c.id, c.facilityId, c.roomId, c.status, j(c)]);
  for (const c of cycles) await saveCycle(c);

  // A finished run on Flower 01 with a note, for the history.
  await saveCycle({
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
  });

  // Two more finished runs per room so the quarter KPIs have something to
  // average: the run before the current one, and the one before that.
  const pastGenetics = ["Gelato 41", "Permanent Marker", "GMO", "Gelato 41"];
  for (let i = 0; i < 4; i++) {
    for (const back of [1, 2]) {
      if (i === 0 && back === 1) continue; // Flower 01 already has this one above.
      const harvestedOn = addDays(flips[i], -7 - (back - 1) * 77);
      const flipDate = addDays(harvestedOn, -(62 + (i % 2)));
      const gps = 44 + i * 1.5 + (back === 1 ? 3 : 0) + rnd(-1.5, 1.5, 1);
      await saveCycle({
        id: id("cyc"),
        facilityId: facility.id,
        roomId: rooms[i].id,
        genetic: pastGenetics[(i + back) % 4],
        flipDate,
        plannedHarvest: addDays(flipDate, 62),
        status: "harvested",
        harvestedOn,
        outcome: { dryGrams: Math.round(gps * 640), note: "" },
        createdAt: Date.parse(`${flipDate}T12:00:00Z`),
      });
    }
  }

  // Check-ins: Mon/Wed/Fri for the last three weeks, per flower room. Room 02
  // drifts high on runoff EC; Room 04 stops submitting six days ago.
  type Seed = Omit<CalEvent, "id" | "facilityId" | "createdBy" | "createdAt"> & { done?: boolean };
  const events: Seed[] = [];
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
      const c: Checkin = {
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
        runoffPct: calc.runoffPct ?? undefined,
        substrateWc: late ? rnd(42, 50, 0) : rnd(55, 62, 0),
        substrateEc: Math.round((feedEc * 1.4 + ecDrift) * 100) / 100,
        dryback: late ? rnd(14, 20, 0) : rnd(8, 12, 0),
        observations: back === 7 && i === 1 ? "Slight tip burn on the two benches nearest the door." : back === 2 && i === 0 ? "Fade starting on the GMO, on schedule." : "",
        submittedBy: "client",
      };
      await q.query(`INSERT INTO checkins (id, facility_id, room_id, day, at, data) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`, [c.id, c.facilityId, c.roomId, c.day, c.at, j(c)]);
    }
    const fdToday = flowerDay(cycle.flipDate, today) ?? 0;
    events.push(
      { date: cycle.flipDate, title: `${room.name} flipped`, kind: "flip", owner: "client", source: "auto", roomId: room.id, cycleId: cycle.id, done: true },
      { date: cycle.plannedHarvest!, title: `${room.name} planned harvest`, kind: "harvest", owner: "client", source: "auto", roomId: room.id, cycleId: cycle.id },
      { date: addDays(cycle.flipDate, 20), title: "Defoliation, day 21", kind: "task", owner: "client", source: "manual", roomId: room.id, cycleId: cycle.id, done: fdToday > 21 },
      { date: addDays(cycle.flipDate, 41), title: "Second defoliation, day 42", kind: "task", owner: "client", source: "manual", roomId: room.id, cycleId: cycle.id, done: fdToday > 43 }
    );
  }
  // Weekly calls, past and future; one past-due task; a transplant; a review.
  const thisMonday = weekStart(today);
  for (let w = -3; w <= 2; w++) events.push({ date: addDays(thisMonday, w * 7 + 3), title: "Weekly consultation", kind: "call", owner: "rgs", source: "auto", done: w < 0 });
  events.push({ date: addDays(today, -4), title: "Verify emitter delivery rates with a cup test", kind: "task", owner: "client", source: "call", roomId: rooms[1].id });
  events.push({ date: addDays(today, 5), title: "Transplant Permanent Marker clones to veg", kind: "transplant", owner: "client", source: "manual", roomId: rooms[4].id });
  events.push({ date: addDays(today, 2), title: "Review Flower 02 substrate EC trend", kind: "review", owner: "rgs", source: "call", roomId: rooms[1].id });
  for (const e of events) {
    const row: CalEvent = {
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
    await q.query(`INSERT INTO events (id, facility_id, date, data) VALUES ($1, $2, $3, $4::jsonb)`, [row.id, row.facilityId, row.date, j(row)]);
  }

  // Last week's call, written up.
  const lastCall = addDays(thisMonday, -4);
  const note: CallNote = {
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
  await q.query(`INSERT INTO call_notes (id, facility_id, week_of, data) VALUES ($1, $2, $3, $4::jsonb)`, [note.id, note.facilityId, note.weekOf, j(note)]);

  // Last week's report, drafted the same way the app drafts it, then approved.
  const weekOf = addDays(thisMonday, -7);
  const weekEnd = addDays(weekOf, 6);
  const rows = async (sql: string, params: unknown[]) => (await q.query(sql, params)).rows.map((r) => r.data);
  const inWeek = (await rows(`SELECT data FROM checkins WHERE facility_id = $1 AND day >= $2 AND day <= $3`, [facility.id, weekOf, weekEnd])) as Checkin[];
  const evWeek = (await rows(`SELECT data FROM events WHERE facility_id = $1 AND date >= $2 AND date <= $3`, [facility.id, weekOf, weekEnd])) as CalEvent[];
  const evNext = (await rows(`SELECT data FROM events WHERE facility_id = $1 AND date >= $2 AND date <= $3`, [facility.id, addDays(weekEnd, 1), addDays(weekEnd, 7)])) as CalEvent[];
  const recent = (await rows(`SELECT data FROM checkins WHERE facility_id = $1 AND day <= $2 ORDER BY day DESC, at DESC`, [facility.id, weekEnd])) as Checkin[];
  const flags = rooms.flatMap((room) =>
    evaluateRoom({ room, cycle: cycles.find((c) => c.roomId === room.id) ?? null, checkins: recent.filter((c) => c.roomId === room.id).slice(0, 4), events: [], today: weekEnd })
  );
  const draft = draftReport({ weekOf, rooms, cycles, checkins: inWeek, events: evWeek, upcoming: evNext, flags });
  const report: Report = {
    id: id("rep"),
    facilityId: facility.id,
    weekOf,
    status: "approved",
    ...draft,
    note: "A steady week except Flower 02, where runoff EC is drifting up while the feed has not moved. The two actions below settle whether that is delivery or recipe. Everything else is on schedule.",
    approvedAt: Date.parse(`${addDays(weekEnd, 1)}T15:00:00Z`),
    createdAt: Date.parse(`${addDays(weekEnd, 1)}T14:00:00Z`),
  };
  await q.query(`INSERT INTO reports (id, facility_id, week_of, data) VALUES ($1, $2, $3, $4::jsonb)`, [report.id, report.facilityId, report.weekOf, j(report)]);

  // Two inquiries for the consultant's inbox, unless they are already there.
  const existing = await q.query(`SELECT count(*)::int AS n FROM inquiries`);
  if (Number(existing.rows[0]?.n ?? 0) === 0) {
    const inquiries: Omit<Inquiry, "id" | "createdAt">[] = [
      { name: "Marcus Hill", email: "marcus@example.com", phone: "", facility: "Hill Family Farms", state: "Michigan", lights: "96", rooms: "2", sensors: "Growlink", note: "Two rooms, inconsistent yields between them, want a second set of eyes weekly.", status: "new" },
      { name: "Priya Natarajan", email: "", phone: "(555) 010-0144", facility: "Great Lakes Botanicals", state: "Michigan", lights: "420", rooms: "6", sensors: "Aroya", note: "", status: "contacted" },
    ];
    for (const i of inquiries) {
      const row: Inquiry = { id: id("inq"), ...i, createdAt: now - rnd(1, 9, 0) * DAY };
      await q.query(`INSERT INTO inquiries (id, created_at, data) VALUES ($1, $2, $3::jsonb)`, [row.id, row.createdAt, j(row)]);
    }
  }

  return `seeded facility "${DEMO_SLUG}" (passcode ${DEMO_PASSCODE}): ${rooms.length} rooms, ${cycles.length} active runs, ${events.length} events, report for week of ${weekOf}`;
}
