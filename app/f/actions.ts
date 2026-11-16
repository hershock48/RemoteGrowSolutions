"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hashPasscode, isAdmin, newSalt, PASSCODE_MIN, viewerFor, type Viewer } from "@/lib/auth";
import { addDays, isISODate, todayIn, weekStart } from "@/lib/dates";
import { int, num, q, safePath, SLUG, slugify, str } from "@/lib/forms";
import { irrigation } from "@/lib/irrigation";
import { buildSchedule, parseHHMM } from "@/lib/schedule";
import { DEFAULT_TASKS, periodFor, runoffFromZones, tickKey } from "@/lib/tasks";
import { parseSensorCsv } from "@/lib/sensorcsv";
import { loadDashboard } from "@/lib/load";
import { draftReport } from "@/lib/report";
import { dayOf } from "@/lib/rules";
import { DEFAULT_TARGETS, EQUIPMENT_CATEGORIES, SITE } from "@/lib/site";
import { open, seal, secretsReady } from "@/lib/secret";
import { newId, store } from "@/lib/store";
import { checkAroyaKey } from "@/lib/vendors";
import type { ActionItem, CalEvent, CallNote, Checkin, Cycle, EventKind, Facility, Phase, Readiness, Report, Room, RoomKind, Schedule, SensorConnection, TaskAuto, TaskTemplate, Targets, ZoneRead } from "@/lib/types";

/**
 * Every write behind the facility door. Each action loads the facility by
 * slug and asks who is calling; a client cookie for another facility, or no
 * cookie, is a redirect to the sign-in page. Consultant-only writes check
 * isAdmin() a second time. Nothing trusts a hidden field for authority.
 *
 * Outcomes travel in the query string, so every form here works with
 * JavaScript off and a validation miss lands back on the form with a sentence.
 */

async function gate(slug: string): Promise<{ facility: Facility; viewer: Viewer; today: string }> {
  const facility = await store.facilityBySlug(slug.toLowerCase());
  if (!facility) redirect("/login");
  const viewer = await viewerFor(facility);
  if (!viewer) redirect(`/login?slug=${encodeURIComponent(facility.slug)}`);
  return { facility, viewer, today: todayIn(facility.timezone) };
}

async function gateAdmin(slug: string) {
  const g = await gate(slug);
  if (g.viewer !== "rgs") redirect(`/f/${g.facility.slug}`);
  return g;
}

const bad = (n: number | undefined) => n !== undefined && Number.isNaN(n);
const range = (fd: FormData, lo: string, hi: string, fallback: [number, number]): [number, number] => {
  const a = num(fd, lo);
  const b = num(fd, hi);
  if (a === undefined || b === undefined || bad(a) || bad(b)) return fallback;
  return a <= b ? [a, b] : [b, a];
};

/* ------------------------------ rooms ------------------------------ */

export async function saveRoom(fd: FormData): Promise<void> {
  const slug = str(fd, "slug", 40);
  const { facility } = await gate(slug);
  const base = `/f/${facility.slug}`;
  const id = str(fd, "id", 40);
  const existing = id ? await store.room(id) : null;
  if (id && (!existing || existing.facilityId !== facility.id)) redirect(`${base}/rooms`);
  const back = id ? `${base}/rooms/${id}/edit` : `${base}/rooms/new`;

  const name = str(fd, "name", 60);
  if (!name) redirect(`${back}${q({ err: "name" })}`);
  const kind = str(fd, "kind", 10) as RoomKind;
  if (!["flower", "veg", "mom", "clone"].includes(kind)) redirect(`${back}${q({ err: "kind" })}`);
  const numbers = {
    fixtureCount: int(fd, "fixtureCount") ?? 0,
    canopySqft: num(fd, "canopySqft") ?? 0,
    containerGal: num(fd, "containerGal") ?? 0,
    plantsPerLight: num(fd, "plantsPerLight") ?? 0,
    emittersPerPlant: num(fd, "emittersPerPlant") ?? 0,
    emitterGph: num(fd, "emitterGph") ?? 0,
    vegDays: int(fd, "vegDays") ?? 0,
    flowerDays: int(fd, "flowerDays") ?? 63,
  };
  if (Object.values(numbers).some(bad)) redirect(`${back}${q({ err: "number" })}`);

  const targets: Targets = {
    tempF: range(fd, "tempLo", "tempHi", existing?.targets.tempF ?? DEFAULT_TARGETS.tempF),
    rh: range(fd, "rhLo", "rhHi", existing?.targets.rh ?? DEFAULT_TARGETS.rh),
    runoffPct: range(fd, "runoffLo", "runoffHi", existing?.targets.runoffPct ?? DEFAULT_TARGETS.runoffPct),
  };
  const ppfdLo = num(fd, "ppfdLo");
  const ppfdHi = num(fd, "ppfdHi");
  if (ppfdLo !== undefined && ppfdHi !== undefined && !bad(ppfdLo) && !bad(ppfdHi)) targets.ppfd = [Math.min(ppfdLo, ppfdHi), Math.max(ppfdLo, ppfdHi)];
  const feLo = num(fd, "feedEcLo");
  const feHi = num(fd, "feedEcHi");
  if (feLo !== undefined && feHi !== undefined && !bad(feLo) && !bad(feHi)) targets.feedEc = [Math.min(feLo, feHi), Math.max(feLo, feHi)];
  const rec = num(fd, "runoffEcMax");
  if (rec !== undefined && !bad(rec)) targets.runoffEcMax = rec;
  const optional = (lo: string, hi: string): [number, number] | undefined => {
    const a = num(fd, lo);
    const b = num(fd, hi);
    return a !== undefined && b !== undefined && !bad(a) && !bad(b) ? [Math.min(a, b), Math.max(a, b)] : undefined;
  };
  targets.vpd = optional("vpdLo", "vpdHi");
  targets.co2 = optional("co2Lo", "co2Hi");

  // The irrigation schedule. A phase needs a start, a shot count and a shot
  // length to exist; anything less and that phase is simply not set.
  const phase = (p: string): Phase | undefined => {
    const start = str(fd, `${p}Start`, 5);
    const shots = int(fd, `${p}Shots`);
    const shotMin = num(fd, `${p}ShotMin`);
    const everyMin = num(fd, `${p}Every`);
    if (parseHHMM(start) === null || !shots || !shotMin || bad(shots) || bad(shotMin) || bad(everyMin) || shots < 0 || shotMin < 0) return undefined;
    return { start, shots: Math.min(60, shots), shotMin, everyMin: Math.max(0, everyMin ?? 0) };
  };
  const lightsOn = str(fd, "lightsOn", 5);
  const lightsOff = str(fd, "lightsOff", 5);
  const schedule: Schedule | undefined =
    parseHHMM(lightsOn) !== null ? { lightsOn, lightsOff: parseHHMM(lightsOff) !== null ? lightsOff : lightsOn, p1: phase("p1"), p2: phase("p2") } : undefined;
  const benches = int(fd, "benches");
  const feedZones = int(fd, "feedZones");

  const room: Room = {
    id: existing?.id ?? newId("room"),
    facilityId: facility.id,
    name,
    kind,
    fixtureModel: str(fd, "fixtureModel", 80),
    substrate: str(fd, "substrate", 40),
    hvac: str(fd, "hvac", 160),
    dehu: str(fd, "dehu", 160),
    controller: str(fd, "controller", 120),
    sensorPlatform: str(fd, "sensorPlatform", 60),
    genetics: str(fd, "genetics", 200),
    ...numbers,
    targets,
    benches: benches && !bad(benches) && benches > 0 ? Math.min(24, benches) : undefined,
    feedZones: feedZones && !bad(feedZones) && feedZones > 0 ? Math.min(24, feedZones) : undefined,
    schedule,
    createdAt: existing?.createdAt ?? Date.now(),
    archivedAt: str(fd, "archived", 4) === "yes" ? (existing?.archivedAt ?? Date.now()) : undefined,
  };
  await store.saveRoom(room);
  revalidatePath(base, "layout");
  redirect(`${base}/rooms/${room.id}${q({ saved: "1" })}`);
}

/* ------------------------------ cycles ------------------------------ */

export async function startCycle(fd: FormData): Promise<void> {
  const { facility, today } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const room = await store.room(str(fd, "roomId", 40));
  if (!room || room.facilityId !== facility.id) redirect(`${base}/rooms`);
  const flipDate = str(fd, "flipDate", 10) || today;
  if (!isISODate(flipDate)) redirect(`${base}/rooms/${room.id}${q({ err: "date" })}`);
  const current = await store.activeCycle(room.id);
  if (current) {
    current.status = "harvested";
    current.harvestedOn = addDays(flipDate, -1);
    await store.saveCycle(current);
  }
  const planned = str(fd, "plannedHarvest", 10);
  const cycle: Cycle = {
    id: newId("cyc"),
    facilityId: facility.id,
    roomId: room.id,
    genetic: str(fd, "genetic", 120) || room.genetics,
    flipDate,
    plannedHarvest: isISODate(planned) ? planned : addDays(flipDate, Math.max(1, room.flowerDays) - 1),
    status: "active",
    createdAt: Date.now(),
  };
  await store.saveCycle(cycle);
  // The crop clock writes its own milestones. Source "auto" so they read as such.
  const who = (await isAdmin()) ? "rgs" : "client";
  const mk = (date: string, title: string, kind: EventKind): CalEvent => ({
    id: newId("ev"),
    facilityId: facility.id,
    roomId: room.id,
    cycleId: cycle.id,
    date,
    title,
    kind,
    owner: "client",
    source: "auto",
    createdBy: who,
    createdAt: Date.now(),
  });
  // The flip has happened by the time it is recorded, so it is born done.
  await store.saveEvent({ ...mk(flipDate, `${room.name} flipped`, "flip"), doneAt: Date.now(), doneBy: who });
  await store.saveEvent(mk(cycle.plannedHarvest!, `${room.name} planned harvest`, "harvest"));
  revalidatePath(base, "layout");
  redirect(`${base}/rooms/${room.id}${q({ saved: "1" })}`);
}

export async function endCycle(fd: FormData): Promise<void> {
  const { facility, today } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const cycle = await store.cycle(str(fd, "cycleId", 40));
  if (!cycle || cycle.facilityId !== facility.id) redirect(`${base}/rooms`);
  const on = str(fd, "harvestedOn", 10) || today;
  cycle.status = "harvested";
  cycle.harvestedOn = isISODate(on) ? on : today;
  const dry = num(fd, "dryGrams");
  cycle.outcome = { dryGrams: dry !== undefined && !bad(dry) ? dry : undefined, note: str(fd, "note", 1000) };
  await store.saveCycle(cycle);
  // The run's planned-harvest milestone is done now, on the day it was done.
  const who = (await isAdmin()) ? "rgs" : "client";
  for (const e of await store.eventsBetween(facility.id, addDays(cycle.flipDate, -1), addDays(cycle.harvestedOn, 400))) {
    if (e.cycleId === cycle.id && e.kind === "harvest" && !e.doneAt) {
      e.date = cycle.harvestedOn;
      e.doneAt = Date.now();
      e.doneBy = who;
      e.updatedAt = Date.now();
      await store.saveEvent(e);
    }
  }
  revalidatePath(base, "layout");
  redirect(`${base}/rooms/${cycle.roomId}${q({ saved: "1" })}`);
}

/* ------------------------------ check-ins ------------------------------ */

const READ_SLOTS = [
  ["a", "plant", 1],
  ["b", "plant", 2],
  ["row", "row", 0],
] as const;

/**
 * One entry per room per day. Entering more later the same day adds to it:
 * temperature in the morning, runoff in the afternoon, and both land on the
 * same record, which is what lets a task tick the moment its part is in. A
 * blank box keeps what was there; a zone that is re-entered replaces that
 * zone's reads.
 */
export async function saveCheckin(fd: FormData): Promise<void> {
  const { facility, viewer, today } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const room = await store.room(str(fd, "roomId", 40));
  if (!room || room.facilityId !== facility.id) redirect(`${base}/checkin${q({ err: "room" })}`);

  const day = str(fd, "day", 10) || today;
  const back = `${base}/checkin?room=${room.id}${isISODate(day) ? `&day=${day}` : ""}`;
  // A reading cannot belong to a day that has not happened in the facility's timezone.
  if (!isISODate(day) || day > today) redirect(`${base}/checkin?room=${room.id}&err=date`);

  const fields = ["tempF", "rh", "ppfd", "co2", "feedEc", "feedPh", "shotMin", "shotsPerDay", "substrateWc", "substrateEc", "dryback"] as const;
  const values: Partial<Record<(typeof fields)[number], number>> = {};
  for (const f of fields) {
    const v = num(fd, f);
    if (bad(v)) redirect(`${back}&err=${f}`);
    if (v !== undefined) values[f] = v;
  }

  const zoneCount = Math.max(1, Math.floor(room.feedZones ?? 1));
  const submitted: ZoneRead[] = [];
  for (let z = 1; z <= zoneCount; z++) {
    for (const [k, source, n] of READ_SLOTS) {
      const ec = num(fd, `z${z}_${k}_ec`);
      const ph = num(fd, `z${z}_${k}_ph`);
      const ml = num(fd, `z${z}_${k}_ml`);
      if (bad(ec) || bad(ph) || bad(ml)) redirect(`${back}&err=runoff`);
      if (ec !== undefined || ph !== undefined || ml !== undefined) submitted.push({ zone: z, source, n, ec, ph, ml });
    }
  }

  const existing = await store.checkinForDay(room.id, day);
  const touched = new Set(submitted.map((r) => r.zone));
  const zones = [...(existing?.zones ?? []).filter((r) => !touched.has(r.zone)), ...submitted].sort((a, b) => a.zone - b.zone || a.n - b.n);
  const typed = str(fd, "observations", 3000);
  const photo = fd.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (Object.keys(values).length === 0 && submitted.length === 0 && !typed && !hasPhoto) redirect(`${back}&err=empty`);

  const cycle = await store.activeCycle(room.id);
  const merged = { ...existing, ...values };
  // The day's volume comes from the room's schedule when it has one, so the
  // grower is not asked to retype what the controller already runs.
  const built = buildSchedule(room.schedule, room.emittersPerPlant, room.emitterGph, room.containerGal);
  const dailyMl =
    built.dailyMl > 0
      ? built.dailyMl
      : irrigation({ emittersPerPlant: room.emittersPerPlant, emitterGph: room.emitterGph, shotMin: merged.shotMin ?? 0, shotsPerDay: merged.shotsPerDay ?? 0 }).dailyMl;
  const agg = zones.length ? runoffFromZones(zones) : { runoffEc: existing?.runoffEc, runoffPh: existing?.runoffPh, runoffMl: existing?.runoffMl };

  const checkin: Checkin = {
    ...merged,
    id: existing?.id ?? newId("chk"),
    facilityId: facility.id,
    roomId: room.id,
    cycleId: existing?.cycleId ?? cycle?.id,
    at: Date.now(),
    day,
    dayOfFlower: existing?.dayOfFlower ?? dayOf(cycle, day),
    ...agg,
    feedMl: dailyMl > 0 ? dailyMl : undefined,
    runoffPct: agg.runoffMl !== undefined && dailyMl > 0 ? (agg.runoffMl / dailyMl) * 100 : undefined,
    zones: zones.length ? zones : undefined,
    observations: typed || existing?.observations || "",
    submittedBy: viewer,
  };

  // The canopy photo rides to Vercel Blob when the hosting has a store. With
  // no token the entry saves without it and the form says so beforehand.
  if (hasPhoto && process.env.BLOB_READ_WRITE_TOKEN) {
    // Only an image, served as the image type WE name, at a URL nobody can
    // guess from the ids: a public blob host must never serve an uploaded
    // file with a content type the browser supplied.
    const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
    const ext = IMAGE_TYPES[photo.type];
    if (!ext || photo.size > 4 * 1024 * 1024) redirect(`${back}&err=photo`);
    const { put } = await import("@vercel/blob");
    const blob = await put(`${facility.slug}/${room.id}/${day}-${checkin.id}.${ext}`, photo, {
      access: "public",
      contentType: photo.type,
      addRandomSuffix: true,
    });
    checkin.photoUrl = blob.url;
  }

  await store.saveCheckin(checkin);
  revalidatePath(base, "layout");
  redirect(`${base}/rooms/${room.id}${q({ saved: "checkin" })}#tasks`);
}

/* ------------------------------ the task list ------------------------------ */

/** Tick a task by hand, or untick it. The period is worked out here, never trusted from the form. */
export async function toggleTask(fd: FormData): Promise<void> {
  const { facility, viewer, today } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const room = await store.room(str(fd, "roomId", 40));
  if (!room || room.facilityId !== facility.id) redirect(base);
  const back = safePath(str(fd, "back", 200), `${base}/rooms/${room.id}#tasks`);
  const task = (facility.tasks?.length ? facility.tasks : DEFAULT_TASKS).find((t) => t.id === str(fd, "taskId", 40));
  const day = str(fd, "day", 10) || today;
  const period = task && isISODate(day) && day <= today ? periodFor(task, day) : null;
  if (!task || !period) redirect(back);
  await store.toggleTick({ id: tickKey(room.id, task.id, period), facilityId: facility.id, roomId: room.id, taskId: task.id, period, at: Date.now(), by: viewer });
  revalidatePath(base, "layout");
  redirect(back);
}

const CADENCES = ["weekdays", "daily", "weekly"] as const;
const AUTOS = ["none", "environment", "runoff", "photo", "notes", "substrate", "assigned"] as const;

/** The consultant's editor for a facility's list. A blank title removes the row. */
export async function saveTasks(fd: FormData): Promise<void> {
  const { facility } = await gateAdmin(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  if (str(fd, "reset", 4) === "yes") {
    await store.saveFacility({ ...facility, tasks: undefined, updatedAt: Date.now() });
    redirect(`${base}/profile${q({ saved: "tasks" })}#tasks`);
  }
  const tasks: TaskTemplate[] = [];
  for (let i = 0; i < 40; i++) {
    const title = str(fd, `title_${i}`, 140);
    if (!title) continue;
    const cadence = str(fd, `cadence_${i}`, 10) as TaskTemplate["cadence"];
    const auto = str(fd, `auto_${i}`, 12) as TaskAuto;
    tasks.push({
      id: str(fd, `id_${i}`, 40) || `t${Date.now().toString(36)}${i}`,
      title,
      cadence: (CADENCES as readonly string[]).includes(cadence) ? cadence : "weekdays",
      auto: (AUTOS as readonly string[]).includes(auto) ? auto : "none",
    });
  }
  await store.saveFacility({ ...facility, tasks: tasks.length ? tasks : undefined, updatedAt: Date.now() });
  revalidatePath(base, "layout");
  redirect(`${base}/profile${q({ saved: "tasks" })}#tasks`);
}

/* ------------------------------ sensor platforms ------------------------------ */

/**
 * Which platform a facility runs and how the consultant sees it: the address
 * of its live graphs, and the API key the vendor issued.
 *
 * There is no username or password box, and there will not be one: no vendor
 * offers a way for another app to sign in with them. An API key is what all
 * three issue instead. A key typed here is sealed before it is stored and is
 * never sent back to the page. Leaving the box empty keeps the key on file;
 * ticking "remove" deletes it. A deployment with no database (the demo)
 * stores no keys at all.
 */
export async function saveSensors(fd: FormData): Promise<void> {
  const { facility } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const canStore = secretsReady() && store.backend !== "pglite-memory";
  const before = facility.sensors ?? [];
  const sensors: SensorConnection[] = [];
  for (let i = 0; i < 4; i++) {
    const platform = str(fd, `platform_${i}`, 40);
    if (!platform) continue;
    const liveUrl = str(fd, `liveUrl_${i}`, 300);
    // The key on file stays with its row only while the row is still the same platform.
    const kept = before[i]?.platform === platform ? before[i].key : undefined;
    const typed = str(fd, `key_${i}`, 400);
    const remove = str(fd, `keyRemove_${i}`, 4) === "yes";
    const key = typed && canStore ? { sealed: seal(typed), last4: typed.slice(-4), savedAt: Date.now() } : remove ? undefined : kept;
    sensors.push({
      platform,
      account: str(fd, `account_${i}`, 120),
      access: str(fd, `access_${i}`, 40),
      // Only an https link is ever rendered as a link.
      liveUrl: /^https:\/\/[^\s]+$/i.test(liveUrl) ? liveUrl : "",
      note: str(fd, `note_${i}`, 300),
      ...(key ? { key } : {}),
    });
  }
  await store.saveFacility({ ...facility, sensors: sensors.length ? sensors : undefined, updatedAt: Date.now() });
  revalidatePath(base, "layout");
  redirect(`${base}/profile${q({ saved: "sensors" })}#sensors`);
}

/** Ask the vendor whether the key on file works. Aroya only: it is the one vendor whose check is documented in the open. */
export async function checkSensorKey(fd: FormData): Promise<void> {
  const { facility } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const i = Number(str(fd, "index", 2));
  const row = facility.sensors?.[i];
  if (!row?.key || row.platform !== "Aroya") redirect(`${base}/profile#sensors`);
  const plain = open(row.key.sealed);
  const check = plain
    ? await checkAroyaKey(plain)
    : { ok: false, text: "The key on file can no longer be read. Enter it again." };
  const sensors = (facility.sensors ?? []).map((s, j) => (j === i && s.key ? { ...s, key: { ...s.key, check: { at: Date.now(), ...check } } } : s));
  await store.saveFacility({ ...facility, sensors, updatedAt: Date.now() });
  revalidatePath(base, "layout");
  redirect(`${base}/profile${q({ saved: "keycheck" })}#sensors`);
}

/** A sensor export, uploaded as a file or pasted, drawn on the room page as a graph. */
export async function uploadSeries(fd: FormData): Promise<void> {
  const { facility, viewer } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const room = await store.room(str(fd, "roomId", 40));
  if (!room || room.facilityId !== facility.id) redirect(base);
  const back = `${base}/rooms/${room.id}`;
  const file = fd.get("export");
  let text = str(fd, "paste", 2_000_000);
  let label = "Pasted export";
  if (file instanceof File && file.size > 0) {
    if (file.size > 3 * 1024 * 1024) redirect(`${back}${q({ err: "export-size" })}#graphs`);
    text = await file.text();
    label = file.name.replace(/[^\w .()-]/g, "").slice(0, 80) || "Export";
  }
  if (!text.trim()) redirect(`${back}${q({ err: "export-empty" })}#graphs`);
  const parsed = parseSensorCsv(text);
  if (parsed.error) redirect(`${back}${q({ err: "export-read" })}#graphs`);
  await store.saveSeries({
    id: newId("ser"),
    facilityId: facility.id,
    roomId: room.id,
    kind: parsed.kind,
    label,
    uploadedAt: Date.now(),
    by: viewer,
    t: parsed.t,
    cols: parsed.cols,
  });
  revalidatePath(base, "layout");
  redirect(`${back}${q({ saved: "export" })}#graphs`);
}

export async function deleteSeries(fd: FormData): Promise<void> {
  const { facility } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const s = await store.series(str(fd, "id", 40));
  if (s && s.facilityId === facility.id) {
    await store.deleteSeries(s.id);
    revalidatePath(base, "layout");
    redirect(`${base}/rooms/${s.roomId}#graphs`);
  }
  redirect(base);
}

/* ------------------------------ scheduled items ------------------------------ */

/**
 * One-off dated work: a defoliation, a transplant, an action item from a
 * call. These used to live on their own calendar tab; they now sit under the
 * room they belong to (Jake, 2026-11-16: the timeframe and the room are not
 * to be separated at the tab level), so every form says where to go back to.
 */
export async function saveEvent(fd: FormData): Promise<void> {
  const { facility, viewer } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const roomId = str(fd, "roomId", 40);
  const room = roomId ? await store.room(roomId) : null;
  const owned = room && room.facilityId === facility.id ? room : null;
  const back = safePath(str(fd, "back", 200), owned ? `${base}/rooms/${owned.id}#tasks` : base);
  const [path, hash] = back.split("#");
  const withErr = (err: string) => `${path}${path.includes("?") ? "&" : "?"}err=${err}${hash ? `#${hash}` : ""}`;
  const date = str(fd, "date", 10);
  if (!isISODate(date)) redirect(withErr("date"));
  const title = str(fd, "title", 120);
  if (!title) redirect(withErr("title"));
  const kind = str(fd, "kind", 12) as EventKind;
  const id = str(fd, "id", 40);
  const existing = id ? await store.event(id) : null;
  if (existing && existing.facilityId !== facility.id) redirect(back);
  const e: CalEvent = {
    id: existing?.id ?? newId("ev"),
    facilityId: facility.id,
    roomId: owned?.id,
    cycleId: existing?.cycleId,
    date,
    title,
    kind: (["task", "milestone", "transplant", "flip", "harvest", "call", "review"] as EventKind[]).includes(kind) ? kind : "task",
    owner: str(fd, "owner", 6) === "rgs" ? "rgs" : "client",
    doneAt: existing?.doneAt,
    doneBy: existing?.doneBy,
    source: existing?.source ?? "manual",
    note: str(fd, "note", 1000) || undefined,
    createdBy: existing?.createdBy ?? viewer,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: existing ? Date.now() : undefined,
  };
  await store.saveEvent(e);
  revalidatePath(base, "layout");
  redirect(back);
}

export async function toggleEvent(fd: FormData): Promise<void> {
  const { facility, viewer } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const e = await store.event(str(fd, "id", 40));
  const back = safePath(str(fd, "back", 200), base);
  if (!e || e.facilityId !== facility.id) redirect(back);
  if (e.doneAt) {
    e.doneAt = undefined;
    e.doneBy = undefined;
  } else {
    e.doneAt = Date.now();
    e.doneBy = viewer;
  }
  e.updatedAt = Date.now();
  await store.saveEvent(e);
  revalidatePath(base, "layout");
  redirect(back);
}

export async function deleteEvent(fd: FormData): Promise<void> {
  const { facility } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const e = await store.event(str(fd, "id", 40));
  if (e && e.facilityId === facility.id) await store.deleteEvent(e.id);
  revalidatePath(base, "layout");
  redirect(safePath(str(fd, "back", 200), base));
}

/* ------------------------------ profile ------------------------------ */

export async function saveProfile(fd: FormData): Promise<void> {
  const { facility, viewer } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const name = str(fd, "name", 120);
  if (!name) redirect(`${base}/profile${q({ err: "name" })}`);
  const counts = {
    flowerRooms: int(fd, "flowerRooms") ?? facility.flowerRooms,
    lightsTotal: int(fd, "lightsTotal") ?? facility.lightsTotal,
    canopySqft: num(fd, "canopySqft") ?? facility.canopySqft,
    vegRooms: int(fd, "vegRooms") ?? facility.vegRooms,
    momRooms: int(fd, "momRooms") ?? facility.momRooms,
  };
  if (Object.values(counts).some(bad)) redirect(`${base}/profile${q({ err: "number" })}`);
  const tz = str(fd, "timezone", 60) || facility.timezone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    redirect(`${base}/profile${q({ err: "timezone" })}`);
  }
  const equipment: Record<string, string> = { ...facility.equipment };
  for (const c of EQUIPMENT_CATEGORIES) equipment[c.id] = str(fd, `eq_${c.id}`, 2000);
  const next: Facility = {
    ...facility,
    name,
    contact: str(fd, "contact", 120),
    email: str(fd, "email", 200),
    phone: str(fd, "phone", 40),
    state: str(fd, "state", 60),
    timezone: tz,
    ...counts,
    equipment,
    updatedAt: Date.now(),
  };
  if (viewer === "rgs") {
    const r = str(fd, "readiness", 12) as Readiness;
    if (["qualified", "conditional", "restricted"].includes(r)) next.readiness = r;
    next.readinessNote = str(fd, "readinessNote", 1000);
  }
  await store.saveFacility(next);
  revalidatePath(base, "layout");
  redirect(`${base}/profile${q({ saved: "1" })}`);
}

export async function resetPasscode(fd: FormData): Promise<void> {
  const { facility } = await gateAdmin(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const passcode = str(fd, "passcode", 200);
  if (passcode.length < PASSCODE_MIN) redirect(`${base}/profile${q({ err: "passcode" })}`);
  const salt = newSalt();
  await store.saveFacility({ ...facility, passcodeSalt: salt, passcodeHash: hashPasscode(salt, passcode), updatedAt: Date.now() });
  redirect(`${base}/profile${q({ saved: "passcode" })}`);
}

/* ------------------------------ calls ------------------------------ */

function parseActions(text: string): ActionItem[] {
  // One per line: "grower: verify emitter rates by 2026-11-08" or "rgs: review substrate trends".
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(rgs|grower|client)\s*:\s*(.+)$/i);
      const owner: "rgs" | "client" = m && m[1].toLowerCase() === "rgs" ? "rgs" : "client";
      let body = m ? m[2].trim() : l;
      let due: string | undefined;
      const d = body.match(/\b(\d{4}-\d{2}-\d{2})\b\.?$/);
      if (d && isISODate(d[1])) {
        due = d[1];
        body = body.slice(0, d.index).replace(/\s*(by|due|on)\s*$/i, "").trim();
      }
      return { text: body, owner, due };
    });
}

export async function saveCall(fd: FormData): Promise<void> {
  const { facility, today } = await gateAdmin(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const id = str(fd, "id", 40);
  const existing = id ? await store.call(id) : null;
  if (existing && existing.facilityId !== facility.id) redirect(`${base}/notes`);
  const heldOn = str(fd, "heldOn", 10) || today;
  if (!isISODate(heldOn)) redirect(`${base}/notes/new${q({ err: "date" })}`);
  const actions = parseActions(str(fd, "actions", 4000));
  const note: CallNote = {
    id: existing?.id ?? newId("call"),
    facilityId: facility.id,
    heldOn,
    weekOf: weekStart(heldOn),
    internal: str(fd, "internal", 20000),
    client: str(fd, "client", 20000),
    actions,
    approvedAt: str(fd, "approve", 4) === "yes" ? Date.now() : existing?.approvedAt,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  await store.saveCall(note);
  // Action items with a date become calendar tasks, once. Re-saving a call
  // does not duplicate them: the title carries the call id as its source key.
  if (!existing) {
    for (const a of actions) {
      if (!a.due) continue;
      await store.saveEvent({
        id: newId("ev"),
        facilityId: facility.id,
        date: a.due,
        title: a.text,
        kind: "task",
        owner: a.owner,
        source: "call",
        note: `From the call of ${heldOn}.`,
        createdBy: "rgs",
        createdAt: Date.now(),
      });
    }
  }
  revalidatePath(base, "layout");
  redirect(`${base}/notes${q({ saved: "1" })}`);
}

/* ------------------------------ reports ------------------------------ */

export async function draftWeek(fd: FormData): Promise<void> {
  const { facility, today } = await gateAdmin(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const w = str(fd, "weekOf", 10);
  const weekOf = isISODate(w) ? weekStart(w) : weekStart(addDays(today, -7));
  const existing = await store.reportForWeek(facility.id, weekOf);
  if (existing) redirect(`${base}/reports/${existing.id}/edit`);
  const end = addDays(weekOf, 6);
  const d = await loadDashboard(facility, today);
  const [checkins, events, upcoming] = await Promise.all([
    store.checkinsBetween(facility.id, weekOf, end),
    store.eventsBetween(facility.id, weekOf, end),
    store.eventsBetween(facility.id, addDays(end, 1), addDays(end, 7)),
  ]);
  const draft = draftReport({ weekOf, rooms: d.rooms, cycles: d.cycles, checkins, events, upcoming, flags: d.flags });
  const report: Report = {
    id: newId("rep"),
    facilityId: facility.id,
    weekOf,
    status: "draft",
    ...draft,
    note: "",
    createdAt: Date.now(),
  };
  await store.saveReport(report);
  redirect(`${base}/reports/${report.id}/edit`);
}

const lines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);

export async function saveReport(fd: FormData): Promise<void> {
  const { facility } = await gateAdmin(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const r = await store.report(str(fd, "id", 40));
  if (!r || r.facilityId !== facility.id) redirect(`${base}/reports`);
  r.behind = lines(str(fd, "behind", 20000));
  r.ahead = lines(str(fd, "ahead", 20000));
  r.exceptions = lines(str(fd, "exceptions", 20000));
  r.actions = parseActions(str(fd, "actions", 8000));
  r.note = str(fd, "note", 8000);
  r.updatedAt = Date.now();
  if (str(fd, "approve", 4) === "yes") {
    r.status = "approved";
    r.approvedAt = Date.now();
  } else if (str(fd, "unapprove", 4) === "yes") {
    r.status = "draft";
    r.approvedAt = undefined;
  }
  await store.saveReport(r);
  revalidatePath(base, "layout");
  redirect(`${base}/reports/${r.id}${q({ saved: "1" })}`);
}

/* ------------------------------ admin: facilities ------------------------------ */

export async function createFacility(fd: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login?next=/admin/facilities/new");
  const name = str(fd, "name", 120);
  const slug = slugify(str(fd, "slug", 40) || name);
  const passcode = str(fd, "passcode", 200);
  const back = "/admin/facilities/new";
  if (!name) redirect(`${back}${q({ err: "name" })}`);
  if (!SLUG.test(slug)) redirect(`${back}${q({ err: "slug" })}`);
  if (passcode.length < PASSCODE_MIN) redirect(`${back}${q({ err: "passcode" })}`);
  if (await store.facilityBySlug(slug)) redirect(`${back}${q({ err: "taken" })}`);
  const tz = str(fd, "timezone", 60) || SITE.timezone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    redirect(`${back}${q({ err: "timezone" })}`);
  }
  const salt = newSalt();
  const f: Facility = {
    id: newId("fac"),
    slug,
    name,
    contact: str(fd, "contact", 120),
    email: str(fd, "email", 200),
    phone: str(fd, "phone", 40),
    state: str(fd, "state", 60) || "Michigan",
    timezone: tz,
    flowerRooms: int(fd, "flowerRooms") || 0,
    lightsTotal: int(fd, "lightsTotal") || 0,
    canopySqft: 0,
    vegRooms: 0,
    momRooms: 0,
    equipment: {},
    readiness: "conditional",
    readinessNote: "",
    passcodeSalt: salt,
    passcodeHash: hashPasscode(salt, passcode),
    createdAt: Date.now(),
  };
  await store.createFacility(f);
  const inquiryId = str(fd, "inquiryId", 40);
  if (inquiryId) {
    const iq = await store.inquiry(inquiryId);
    if (iq) await store.saveInquiry({ ...iq, status: "onboarded" });
  }
  revalidatePath("/admin");
  redirect(`/f/${f.slug}/profile?saved=created`);
}

export async function loadDemoFacility(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login?next=/admin");
  const { seedDemoFacility } = await import("@/lib/store");
  console.log(`[rgs] ${await seedDemoFacility(todayIn(SITE.timezone))}`);
  revalidatePath("/admin");
  redirect("/admin?demo=loaded");
}

export async function setInquiryStatus(fd: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
  const iq = await store.inquiry(str(fd, "id", 40));
  const status = str(fd, "status", 12);
  if (iq && ["new", "contacted", "onboarded", "passed"].includes(status)) {
    await store.saveInquiry({ ...iq, status: status as typeof iq.status });
  }
  revalidatePath("/admin");
  redirect("/admin#inquiries");
}
