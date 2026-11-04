"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hashPasscode, isAdmin, newSalt, PASSCODE_MIN, viewerFor, type Viewer } from "@/lib/auth";
import { addDays, isISODate, todayIn, weekStart } from "@/lib/dates";
import { int, num, q, safePath, SLUG, slugify, str } from "@/lib/forms";
import { irrigation } from "@/lib/irrigation";
import { loadDashboard } from "@/lib/load";
import { draftReport } from "@/lib/report";
import { dayOf } from "@/lib/rules";
import { DEFAULT_TARGETS, EQUIPMENT_CATEGORIES, SITE } from "@/lib/site";
import { newId, store } from "@/lib/store";
import type { ActionItem, CalEvent, CallNote, Checkin, Cycle, EventKind, Facility, Readiness, Report, Room, RoomKind, Targets } from "@/lib/types";

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

export async function saveCheckin(fd: FormData): Promise<void> {
  const { facility, viewer, today } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const room = await store.room(str(fd, "roomId", 40));
  if (!room || room.facilityId !== facility.id) redirect(`${base}/checkin${q({ err: "room" })}`);
  const back = `${base}/checkin?room=${room.id}`;

  const day = str(fd, "day", 10) || today;
  // A reading cannot belong to a day that has not happened in the facility's timezone.
  if (!isISODate(day) || day > today) redirect(`${back}&err=date`);
  const fields = ["tempF", "rh", "ppfd", "co2", "feedEc", "feedPh", "runoffEc", "runoffPh", "runoffMl", "shotMin", "shotsPerDay", "substrateWc", "substrateEc", "dryback"] as const;
  const values: Partial<Record<(typeof fields)[number], number>> = {};
  for (const f of fields) {
    const v = num(fd, f);
    if (bad(v)) redirect(`${back}&err=${f}`);
    if (v !== undefined) values[f] = v;
  }
  if (Object.keys(values).length === 0 && !str(fd, "observations", 1)) redirect(`${back}&err=empty`);

  const cycle = await store.activeCycle(room.id);
  const calc = irrigation({
    emittersPerPlant: room.emittersPerPlant,
    emitterGph: room.emitterGph,
    shotMin: values.shotMin ?? 0,
    shotsPerDay: values.shotsPerDay ?? 0,
    runoffMl: values.runoffMl,
  });

  const checkin: Checkin = {
    id: newId("chk"),
    facilityId: facility.id,
    roomId: room.id,
    cycleId: cycle?.id,
    at: Date.now(),
    day,
    dayOfFlower: dayOf(cycle, day),
    ...values,
    feedMl: calc.dailyMl > 0 ? calc.dailyMl : undefined,
    runoffPct: calc.runoffPct ?? undefined,
    observations: str(fd, "observations", 3000),
    submittedBy: viewer,
  };

  // The canopy photo rides to Vercel Blob when the hosting has a store. With
  // no token the check-in saves without it and the form says so beforehand.
  const photo = fd.get("photo");
  if (photo instanceof File && photo.size > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
    // Only an image, served as the image type WE name, at a URL nobody can
    // guess from the ids: a public blob host must never serve an uploaded
    // file with a content type the browser supplied.
    const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
    const ext = IMAGE_TYPES[photo.type];
    if (!ext || photo.size > 8 * 1024 * 1024) redirect(`${back}&err=photo`);
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
  redirect(`${base}/rooms/${room.id}${q({ saved: "checkin" })}`);
}

/* ------------------------------ calendar ------------------------------ */

export async function saveEvent(fd: FormData): Promise<void> {
  const { facility, viewer } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const date = str(fd, "date", 10);
  const week = str(fd, "week", 10);
  const back = `${base}/calendar${q({ week: isISODate(week) ? week : undefined })}`;
  if (!isISODate(date)) redirect(`${back}${back.includes("?") ? "&" : "?"}err=date`);
  const title = str(fd, "title", 120);
  if (!title) redirect(`${back}${back.includes("?") ? "&" : "?"}err=title`);
  const kind = str(fd, "kind", 12) as EventKind;
  const roomId = str(fd, "roomId", 40);
  const room = roomId ? await store.room(roomId) : null;
  const id = str(fd, "id", 40);
  const existing = id ? await store.event(id) : null;
  if (existing && existing.facilityId !== facility.id) redirect(back);
  const owner = str(fd, "owner", 6) === "rgs" ? "rgs" : "client";
  const e: CalEvent = {
    id: existing?.id ?? newId("ev"),
    facilityId: facility.id,
    roomId: room && room.facilityId === facility.id ? room.id : undefined,
    cycleId: existing?.cycleId,
    date,
    title,
    kind: (["task", "milestone", "transplant", "flip", "harvest", "call", "review"] as EventKind[]).includes(kind) ? kind : "task",
    owner,
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
  redirect(`${base}/calendar${q({ week: weekStart(date), saved: "1" })}`);
}

export async function toggleEvent(fd: FormData): Promise<void> {
  const { facility, viewer } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const e = await store.event(str(fd, "id", 40));
  const week = str(fd, "week", 10);
  const back = `${base}/calendar${q({ week: isISODate(week) ? week : undefined })}`;
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
  redirect(safePath(str(fd, "back", 200), back));
}

export async function deleteEvent(fd: FormData): Promise<void> {
  const { facility } = await gate(str(fd, "slug", 40));
  const base = `/f/${facility.slug}`;
  const e = await store.event(str(fd, "id", 40));
  const week = str(fd, "week", 10);
  if (e && e.facilityId === facility.id) await store.deleteEvent(e.id);
  revalidatePath(base, "layout");
  redirect(`${base}/calendar${q({ week: isISODate(week) ? week : undefined })}`);
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
