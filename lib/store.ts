import "server-only";

import type { CalEvent, CallNote, Checkin, Cycle, Facility, Inquiry, Report, Room } from "./types";
import { DEV_DATA_DIR, SCHEMA } from "./schema";

/**
 * Storage, in the anchor/devine shape (glaze/catalog/apps.md) with one change
 * for the data this product keeps.
 *
 * THE SHAPE: every record is a jsonb document beside the few columns a query
 * needs (facility, room, day). The TypeScript types in lib/types.ts are the
 * schema; adding a field is editing the type. The columns exist only so a
 * week of check-ins or a month of calendar can be fetched by range instead of
 * by reading everything.
 *
 * THE CHANGE: anchor's fallback when no database URL is set is an in-memory
 * Map, fine for a leads queue and wrong for a product whose whole value is
 * history. The fallback here is PGlite, Postgres compiled to WebAssembly,
 * running in-process. In development it persists to .data/ on disk, so a
 * week of fake check-ins survives a restart and the same SQL that runs in
 * production runs on the laptop. On a deployment with no database it runs in
 * memory, and every screen says so, because a dashboard that forgets is worse
 * than one that says it has nowhere to write.
 *
 *   postgres        a database URL is set (Vercel > Storage > Neon, free tier,
 *                   on the hosting the client already has). Tables create
 *                   themselves on first use under an advisory lock.
 *   pglite-file     no URL, not production. .data/rgs on disk.
 *   pglite-memory   no URL, production. Warn on every screen.
 *
 * Both drivers answer the same `query(sql, params)` so nothing above this
 * line knows which one it got. jsonb parameters are cast in the SQL
 * (`$n::jsonb`) because PGlite types a JS string as text and will not coerce
 * it on its own.
 */

export type Backend = "postgres" | "pglite-file" | "pglite-memory";

type Row = Record<string, unknown>;
type Querier = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Row[] }> };

/* ------------------------------ drivers ------------------------------ */

/** Scooplist's connectionVar through anchor: the Vercel/Neon integration injects prefixed names. */
export function connectionVar(): string | null {
  const env = process.env;
  if (env.DATABASE_URL) return "DATABASE_URL";
  if (env.POSTGRES_URL) return "POSTGRES_URL";
  const keys = Object.keys(env).sort();
  return keys.find((k) => k.endsWith("_DATABASE_URL") && env[k]) ?? keys.find((k) => k.endsWith("_POSTGRES_URL") && env[k]) ?? null;
}

export function backend(): Backend {
  if (connectionVar()) return "postgres";
  return process.env.NODE_ENV === "production" ? "pglite-memory" : "pglite-file";
}

type G = typeof globalThis & { __rgsDb?: Promise<Querier>; __rgsBackend?: Backend };

async function db(): Promise<Querier> {
  const g = globalThis as G;
  if (!g.__rgsDb) {
    g.__rgsDb = open().catch((err) => {
      // A failed init must not be cached (devine's rule): drop it so the next request retries.
      g.__rgsDb = undefined;
      throw err;
    });
  }
  return g.__rgsDb;
}

async function open(): Promise<Querier> {
  const which = backend();
  (globalThis as G).__rgsBackend = which;
  if (which === "postgres") {
    const { Pool } = await import("pg");
    const cs = process.env[connectionVar()!];
    const local = /localhost|127\.0\.0\.1|\[::1\]/.test(cs ?? "") || cs?.includes("sslmode=disable");
    const pool = new Pool({ connectionString: cs, ssl: local ? undefined : { rejectUnauthorized: false }, max: 3 });
    // Advisory lock: Next prerenders with several workers and IF NOT EXISTS is
    // not atomic against a concurrent creator (anchor's first facts deploy).
    await pool.query(`SELECT pg_advisory_xact_lock(4213702); ${SCHEMA}`).catch((err: { code?: string }) => {
      if (err.code === "23505" || err.code === "42P07") return;
      throw err;
    });
    return pool as unknown as Querier;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  let pg;
  if (which === "pglite-file") {
    // PGlite does not create the parent directory; the first run on a fresh clone would die on mkdir.
    const { mkdir } = await import("node:fs/promises");
    await mkdir(`${process.cwd()}/${DEV_DATA_DIR}`, { recursive: true });
    pg = new PGlite(`${process.cwd()}/${DEV_DATA_DIR}`);
  } else {
    pg = new PGlite();
  }
  await pg.exec(SCHEMA);
  return {
    query: async (sql, params) => {
      const r = await pg.query(sql, params as never[]);
      return { rows: r.rows as Row[] };
    },
  };
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const j = (v: unknown) => JSON.stringify(v);

/* ------------------------------ records ------------------------------ */

export const store = {
  get backend(): Backend {
    return (globalThis as G).__rgsBackend ?? backend();
  },

  /* facilities */
  async createFacility(f: Facility) {
    const d = await db();
    await d.query(`INSERT INTO facilities (id, slug, created_at, data) VALUES ($1, $2, $3, $4::jsonb)`, [f.id, f.slug, f.createdAt, j(f)]);
  },
  async saveFacility(f: Facility) {
    const d = await db();
    await d.query(`UPDATE facilities SET slug = $2, data = $3::jsonb WHERE id = $1`, [f.id, f.slug, j(f)]);
  },
  async facilityBySlug(slug: string): Promise<Facility | null> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM facilities WHERE slug = $1`, [slug]);
    return rows.length ? (rows[0].data as Facility) : null;
  },
  async facilityById(id: string): Promise<Facility | null> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM facilities WHERE id = $1`, [id]);
    return rows.length ? (rows[0].data as Facility) : null;
  },
  async listFacilities(): Promise<Facility[]> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM facilities ORDER BY created_at ASC`);
    return rows.map((r) => r.data as Facility);
  },

  /* rooms */
  async saveRoom(r: Room) {
    const d = await db();
    await d.query(
      `INSERT INTO rooms (id, facility_id, created_at, data) VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [r.id, r.facilityId, r.createdAt, j(r)]
    );
  },
  async room(id: string): Promise<Room | null> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM rooms WHERE id = $1`, [id]);
    return rows.length ? (rows[0].data as Room) : null;
  },
  async rooms(facilityId: string): Promise<Room[]> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM rooms WHERE facility_id = $1 ORDER BY created_at ASC`, [facilityId]);
    return rows.map((r) => r.data as Room);
  },

  /* cycles */
  async saveCycle(c: Cycle) {
    const d = await db();
    await d.query(
      `INSERT INTO cycles (id, facility_id, room_id, status, data) VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, data = EXCLUDED.data`,
      [c.id, c.facilityId, c.roomId, c.status, j(c)]
    );
  },
  async cycles(facilityId: string): Promise<Cycle[]> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM cycles WHERE facility_id = $1`, [facilityId]);
    return rows.map((r) => r.data as Cycle).sort((a, b) => b.createdAt - a.createdAt);
  },
  async activeCycle(roomId: string): Promise<Cycle | null> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM cycles WHERE room_id = $1 AND status = 'active'`, [roomId]);
    const list = rows.map((r) => r.data as Cycle).sort((a, b) => b.createdAt - a.createdAt);
    return list[0] ?? null;
  },
  async cycle(id: string): Promise<Cycle | null> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM cycles WHERE id = $1`, [id]);
    return rows.length ? (rows[0].data as Cycle) : null;
  },

  /* check-ins */
  async saveCheckin(c: Checkin) {
    const d = await db();
    await d.query(
      `INSERT INTO checkins (id, facility_id, room_id, day, at, data) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [c.id, c.facilityId, c.roomId, c.day, c.at, j(c)]
    );
  },
  async checkinsForRoom(roomId: string, limit = 60): Promise<Checkin[]> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM checkins WHERE room_id = $1 ORDER BY at DESC LIMIT $2`, [roomId, limit]);
    return rows.map((r) => r.data as Checkin);
  },
  /** Newest first, across the facility, inside [fromDay, toDay]. */
  async checkinsBetween(facilityId: string, fromDay: string, toDay: string): Promise<Checkin[]> {
    const d = await db();
    const { rows } = await d.query(
      `SELECT data FROM checkins WHERE facility_id = $1 AND day >= $2 AND day <= $3 ORDER BY at DESC`,
      [facilityId, fromDay, toDay]
    );
    return rows.map((r) => r.data as Checkin);
  },
  /** The latest few per room, newest first, for the rules engine. */
  async recentCheckins(facilityId: string, perRoom = 4): Promise<Map<string, Checkin[]>> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM checkins WHERE facility_id = $1 ORDER BY at DESC LIMIT 400`, [facilityId]);
    const out = new Map<string, Checkin[]>();
    for (const r of rows) {
      const c = r.data as Checkin;
      const list = out.get(c.roomId) ?? [];
      if (list.length < perRoom) {
        list.push(c);
        out.set(c.roomId, list);
      }
    }
    return out;
  },
  async checkin(id: string): Promise<Checkin | null> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM checkins WHERE id = $1`, [id]);
    return rows.length ? (rows[0].data as Checkin) : null;
  },

  /* calendar */
  async saveEvent(e: CalEvent) {
    const d = await db();
    await d.query(
      `INSERT INTO events (id, facility_id, date, data) VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, data = EXCLUDED.data`,
      [e.id, e.facilityId, e.date, j(e)]
    );
  },
  async deleteEvent(id: string) {
    const d = await db();
    await d.query(`DELETE FROM events WHERE id = $1`, [id]);
  },
  async event(id: string): Promise<CalEvent | null> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM events WHERE id = $1`, [id]);
    return rows.length ? (rows[0].data as CalEvent) : null;
  },
  async eventsBetween(facilityId: string, fromDate: string, toDate: string): Promise<CalEvent[]> {
    const d = await db();
    const { rows } = await d.query(
      `SELECT data FROM events WHERE facility_id = $1 AND date >= $2 AND date <= $3 ORDER BY date ASC`,
      [facilityId, fromDate, toDate]
    );
    return rows.map((r) => r.data as CalEvent);
  },
  /** Open tasks dated before a day: the overdue list. */
  async openEventsBefore(facilityId: string, day: string): Promise<CalEvent[]> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM events WHERE facility_id = $1 AND date < $2 ORDER BY date ASC`, [facilityId, day]);
    return rows.map((r) => r.data as CalEvent).filter((e) => !e.doneAt);
  },

  /* calls */
  async saveCall(n: CallNote) {
    const d = await db();
    await d.query(
      `INSERT INTO call_notes (id, facility_id, week_of, data) VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET week_of = EXCLUDED.week_of, data = EXCLUDED.data`,
      [n.id, n.facilityId, n.weekOf, j(n)]
    );
  },
  async calls(facilityId: string): Promise<CallNote[]> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM call_notes WHERE facility_id = $1 ORDER BY week_of DESC`, [facilityId]);
    return rows.map((r) => r.data as CallNote);
  },
  async call(id: string): Promise<CallNote | null> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM call_notes WHERE id = $1`, [id]);
    return rows.length ? (rows[0].data as CallNote) : null;
  },

  /* reports */
  async saveReport(r: Report) {
    const d = await db();
    await d.query(
      `INSERT INTO reports (id, facility_id, week_of, data) VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET week_of = EXCLUDED.week_of, data = EXCLUDED.data`,
      [r.id, r.facilityId, r.weekOf, j(r)]
    );
  },
  async reports(facilityId: string): Promise<Report[]> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM reports WHERE facility_id = $1 ORDER BY week_of DESC`, [facilityId]);
    return rows.map((r) => r.data as Report);
  },
  async report(id: string): Promise<Report | null> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM reports WHERE id = $1`, [id]);
    return rows.length ? (rows[0].data as Report) : null;
  },
  async reportForWeek(facilityId: string, weekOf: string): Promise<Report | null> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM reports WHERE facility_id = $1 AND week_of = $2`, [facilityId, weekOf]);
    return rows.length ? (rows[0].data as Report) : null;
  },

  /* inquiries from the public page */
  async saveInquiry(q: Inquiry) {
    const d = await db();
    await d.query(
      `INSERT INTO inquiries (id, created_at, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [q.id, q.createdAt, j(q)]
    );
  },
  async inquiries(): Promise<Inquiry[]> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM inquiries ORDER BY created_at DESC LIMIT 200`);
    return rows.map((r) => r.data as Inquiry);
  },
  async inquiry(id: string): Promise<Inquiry | null> {
    const d = await db();
    const { rows } = await d.query(`SELECT data FROM inquiries WHERE id = $1`, [id]);
    return rows.length ? (rows[0].data as Inquiry) : null;
  },
};
