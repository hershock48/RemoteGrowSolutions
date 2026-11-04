import "server-only";

import { notFound, redirect } from "next/navigation";
import { isAdmin, viewerFor, type Viewer } from "./auth";
import { store } from "./store";
import { addDays, todayIn, weekStart } from "./dates";
import { evaluateRoom, SEVERITY_RANK, summarize, type Flag } from "./rules";
import type { CalEvent, Checkin, Cycle, Facility, Room } from "./types";

/**
 * Loaders the screens share, so the gate and the dashboard arithmetic are
 * written once.
 */

export type Access = { facility: Facility; viewer: Viewer; today: string };

/** Load the facility and decide who is looking, or send them to the right door. */
export async function requireFacility(slug: string): Promise<Access> {
  const facility = await store.facilityBySlug(slug.toLowerCase());
  if (!facility) {
    if (await isAdmin()) notFound();
    redirect(`/login?slug=${encodeURIComponent(slug)}`);
  }
  const viewer = await viewerFor(facility);
  if (!viewer) redirect(`/login?slug=${encodeURIComponent(facility.slug)}`);
  return { facility, viewer, today: todayIn(facility.timezone) };
}

export async function requireAdmin(next = "/admin"): Promise<void> {
  if (!(await isAdmin())) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
}

export type Dashboard = {
  rooms: Room[];
  cycles: Cycle[];
  activeCycle: Map<string, Cycle>;
  recent: Map<string, Checkin[]>;
  flags: Flag[];
  summary: ReturnType<typeof summarize>;
  /** Open tasks before today plus everything dated this week. */
  events: CalEvent[];
  weekOf: string;
};

export async function loadDashboard(facility: Facility, today: string): Promise<Dashboard> {
  const weekOf = weekStart(today);
  const [rooms, cycles, recent, overdue, week] = await Promise.all([
    store.rooms(facility.id),
    store.cycles(facility.id),
    store.recentCheckins(facility.id),
    store.openEventsBefore(facility.id, weekOf),
    store.eventsBetween(facility.id, weekOf, addDays(weekOf, 6)),
  ]);
  const live = rooms.filter((r) => !r.archivedAt);
  const activeCycle = new Map<string, Cycle>();
  for (const c of cycles) if (c.status === "active" && !activeCycle.has(c.roomId)) activeCycle.set(c.roomId, c);
  const events = [...overdue, ...week.filter((e) => !overdue.some((o) => o.id === e.id))];
  const flags = live
    .flatMap((room) =>
      evaluateRoom({ room, cycle: activeCycle.get(room.id) ?? null, checkins: recent.get(room.id) ?? [], events, today })
    )
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const summary = summarize(
    live.filter((r) => r.kind === "flower").map((r) => r.id),
    flags
  );
  return { rooms: live, cycles, activeCycle, recent, flags, summary, events, weekOf };
}
