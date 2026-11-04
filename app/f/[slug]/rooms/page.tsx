import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/Shell";
import { loadDashboard, requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { flowerDay, fmtWhen } from "@/lib/dates";

export const metadata: Metadata = { title: "Rooms" };

export default async function Rooms({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { facility, viewer, today } = await requireFacility(slug);
  const d = await loadDashboard(facility, today);
  const all = await store.rooms(facility.id);
  const archived = all.filter((r) => r.archivedAt);
  const base = `/f/${facility.slug}`;

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/rooms">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Rooms</p>
          <h1 className="mt-2 text-3xl sm:text-4xl">Every room, its profile and its run</h1>
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

      <div className="mt-8 overflow-x-auto" tabIndex={0} role="region" aria-label="Rooms table, scrolls sideways on a phone">
        <table className="tbl min-w-[640px]">
          <thead>
            <tr>
              <th scope="col">Room</th>
              <th scope="col">Kind</th>
              <th scope="col">Run</th>
              <th scope="col">Lights</th>
              <th scope="col">Last check-in</th>
              <th scope="col">Runoff</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {d.rooms.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted">
                  No rooms yet.
                </td>
              </tr>
            )}
            {d.rooms.map((r) => {
              const c = d.activeCycle.get(r.id);
              const latest = d.recent.get(r.id)?.[0];
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`${base}/rooms/${r.id}`} className="font-semibold hover:text-flare">
                      {r.name}
                    </Link>
                  </td>
                  <td className="capitalize text-muted">{r.kind}</td>
                  <td className="text-muted">{c ? `${c.genetic || "run"}, day ${flowerDay(c.flipDate, today) ?? 0}` : r.kind === "flower" ? "none" : ""}</td>
                  <td className="text-muted">{r.fixtureCount || ""}</td>
                  <td className="text-muted">{latest ? fmtWhen(latest.at, facility.timezone) : "never"}</td>
                  <td className="text-muted">{latest?.runoffPct !== undefined ? `${latest.runoffPct.toFixed(1)}%` : ""}</td>
                  <td className="text-right">
                    <Link href={`${base}/checkin?room=${r.id}`} className="btn-small">
                      Check in
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {archived.length > 0 && (
        <p className="mt-6 text-sm text-muted">
          Archived: {archived.map((r, i) => (
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
