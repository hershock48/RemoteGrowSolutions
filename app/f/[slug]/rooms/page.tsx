import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/Shell";
import { loadBoard } from "@/lib/board";
import { requireFacility } from "@/lib/load";
import { nowOf } from "@/lib/now";
import { store } from "@/lib/store";
import { flowerDay } from "@/lib/dates";
import { tally } from "@/lib/tasks";
import type { Range } from "@/lib/types";

export const metadata: Metadata = { title: "Rooms" };

/**
 * Every room on one screen, in the shape of the room table on Aroya's
 * dashboard, which Jake named as the reference (2026-11-16): one row a room,
 * one column a reading, a status at the end. A number outside the room's own
 * setpoint is amber; everything else is plain.
 *
 * Two columns are deliberately absent, by his note of 2026-11-04: runoff
 * percentage and genetics. Both live on the room's own page.
 */

const outside = (v: number | undefined, r?: Range) => v !== undefined && !!r && (v < r[0] || v > r[1]);
const show = (v: number | undefined, digits?: number) => (v === undefined ? "" : digits !== undefined ? v.toFixed(digits) : Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en-US") : String(Math.round(v * 10) / 10));

export default async function Rooms({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { facility, viewer, today } = await requireFacility(slug);
  const board = (await loadBoard(facility.id, today))!;
  const d = board.dash;
  const all = await store.rooms(facility.id);
  const archived = all.filter((r) => r.archivedAt);
  const base = `/f/${facility.slug}`;

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/rooms">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Rooms</p>
          <h1 className="mt-2 text-3xl sm:text-4xl">Every room, latest readings</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/compare`} className="btn-ghost">
            Compare rooms
          </Link>
          <Link href={`${base}/rooms/new`} className="btn-primary">
            Add a room
          </Link>
        </div>
      </div>

      <div className="relative mt-8 overflow-x-auto" tabIndex={0} role="region" aria-label="Rooms table, scrolls sideways on a phone">
        <table className="tbl min-w-[860px]">
          <thead>
            <tr>
              <th scope="col">Room</th>
              <th scope="col">Day</th>
              <th scope="col">Temp °F</th>
              <th scope="col">RH %</th>
              <th scope="col">VPD kPa</th>
              <th scope="col">CO₂ ppm</th>
              <th scope="col">WC %</th>
              <th scope="col">Runoff EC</th>
              <th scope="col">Tasks</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Enter data</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {d.rooms.length === 0 && (
              <tr>
                <td colSpan={11} className="text-muted">
                  No rooms yet.
                </td>
              </tr>
            )}
            {d.rooms.map((r) => {
              const c = d.activeCycle.get(r.id);
              const now = nowOf(d.recent.get(r.id) ?? []);
              const t = r.targets;
              const flags = d.flags.filter((f) => f.roomId === r.id && f.severity !== "info");
              const stale = flags.some((f) => f.severity === "missing");
              const rb = board.rooms.find((x) => x.room.id === r.id);
              const tasks = rb ? tally(rb.today) : null;
              const status = !c && r.kind === "flower" ? { dot: "dot-info", word: "No run" } : r.kind !== "flower" && now.day === undefined ? { dot: "dot-info", word: "Advisory" } : now.day === undefined ? { dot: "dot-miss", word: "No data" } : stale ? { dot: "dot-miss", word: "No recent data" } : flags.length ? { dot: "dot-warn", word: "Out of range" } : { dot: "dot-ok", word: "In range" };
              const cell = (v: number | undefined, bad: boolean, digits?: number) => <td className={v === undefined ? "!text-muted" : bad ? "font-semibold !text-warn" : ""}>{v === undefined ? "·" : show(v, digits)}</td>;
              return (
                <tr key={r.id}>
                  <th scope="row" className="whitespace-nowrap !border-line/70 !py-2.5 !text-sm !font-normal !normal-case !tracking-normal">
                    <Link href={`${base}/rooms/${r.id}`} className="font-semibold text-bone hover:text-flare">
                      {r.name}
                    </Link>
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{r.kind === "mom" ? "mother" : r.kind}</span>
                  </th>
                  <td className="whitespace-nowrap text-muted">{c ? `${flowerDay(c.flipDate, today) ?? 0} of ${r.flowerDays}` : ""}</td>
                  {cell(now.tempF, outside(now.tempF, t.tempF))}
                  {cell(now.rh, outside(now.rh, t.rh))}
                  {cell(now.vpd, outside(now.vpd, t.vpd), 2)}
                  {cell(now.co2, outside(now.co2, t.co2))}
                  {cell(now.substrateWc, false)}
                  {cell(now.runoffEc, now.runoffEc !== undefined && t.runoffEcMax !== undefined && now.runoffEc > t.runoffEcMax)}
                  <td className="whitespace-nowrap text-muted">{tasks ? `${tasks.done}/${tasks.total}` : ""}</td>
                  <td className="whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <span className={`dot ${status.dot}`} aria-hidden="true" />
                      {status.word}
                    </span>
                  </td>
                  <td className="text-right">
                    <Link href={`${base}/checkin?room=${r.id}`} className="btn-small whitespace-nowrap" aria-label={`Enter data for ${r.name}`}>
                      Enter data
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">The latest value entered for each reading. Amber is outside that room&apos;s own setpoint. A dot in a cell means nothing has been entered.</p>

      {archived.length > 0 && (
        <p className="mt-6 text-sm text-muted">
          Archived:{" "}
          {archived.map((r, i) => (
            <span key={r.id}>
              {i > 0 ? ", " : ""}
              <Link href={`${base}/rooms/${r.id}`} className="hover:text-flare">
                {r.name}
              </Link>
            </span>
          ))}
          .
        </p>
      )}
    </Shell>
  );
}
