import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/Shell";
import LineChart, { Legend } from "@/components/LineChart";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { fmtDay } from "@/lib/dates";
import { runReadings } from "@/lib/series";
import type { Series } from "@/lib/chart";

export const metadata: Metadata = { title: "Compare rooms" };

const SLOTS = ["primary", "secondary", "third", "fourth"] as const;

/**
 * Room against room: the same genetic in two rooms, or two rooms on the
 * same day, with runoff EC and runoff percent overlaid on the flower-day
 * axis. The Enterprise tier's reason to exist, and useful to anyone with two
 * rooms. A plain GET form, so a comparison is a URL that can be sent.
 */
export default async function Compare({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ r?: string | string[] }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { facility, viewer } = await requireFacility(slug);
  const [rooms, cycles] = await Promise.all([store.rooms(facility.id), store.cycles(facility.id)]);
  const flower = rooms.filter((r) => r.kind === "flower" && !r.archivedAt);
  const wanted = (Array.isArray(sp.r) ? sp.r : sp.r ? [sp.r] : []).filter((id) => flower.some((r) => r.id === id)).slice(0, 4);
  const chosen = wanted.length ? wanted : flower.slice(0, 2).map((r) => r.id);
  const base = `/f/${facility.slug}`;

  const picked = await Promise.all(
    chosen.map(async (id, i) => {
      const room = flower.find((r) => r.id === id)!;
      const cycle = cycles.filter((c) => c.roomId === id).sort((a, b) => b.flipDate.localeCompare(a.flipDate))[0] ?? null;
      const rs = cycle ? runReadings(await store.checkinsForRoom(id, 200), cycle) : [];
      const label = `${room.name}${cycle ? ` (${cycle.genetic || "run"}, flipped ${fmtDay(cycle.flipDate)})` : ""}`;
      const ec: Series = { name: label, slot: SLOTS[i], points: rs.filter((x) => typeof x.c.runoffEc === "number").map((x) => ({ x: x.day, y: x.c.runoffEc! })), dots: true };
      const pct: Series = { name: label, slot: SLOTS[i], points: rs.filter((x) => typeof x.c.runoffPct === "number").map((x) => ({ x: x.day, y: x.c.runoffPct! })), dots: true };
      return { room, cycle, ec, pct };
    })
  );
  const ecCeiling = Math.max(...picked.map((p) => p.room.targets.runoffEcMax ?? 0));
  const ecSeriesAll = picked.map((p, i) => (i === 0 && ecCeiling > 0 ? { ...p.ec, ceiling: ecCeiling } : p.ec));
  const pctSeriesAll = picked.map((p, i) => (i === 0 ? { ...p.pct, band: p.room.targets.runoffPct } : p.pct));

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/rooms">
      <Link href={`${base}/rooms`} className="text-sm text-muted hover:text-flare">
        All rooms
      </Link>
      <p className="eyebrow mt-4">Compare</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">Room against room</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-muted">
        Each room&apos;s latest run on one flower-day axis. Up to four. The ceiling and target band drawn are the first room&apos;s.
      </p>

      <form method="get" className="card mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4">
        {flower.map((r) => (
          <label key={r.id} className="flex items-center gap-2 text-sm text-bone">
            <input type="checkbox" name="r" value={r.id} defaultChecked={chosen.includes(r.id)} className="h-4 w-4 accent-ember" />
            {r.name}
          </label>
        ))}
        <button type="submit" className="btn-small ml-auto">
          Compare
        </button>
      </form>

      <section className="card mt-6 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl text-bone">Runoff EC</h2>
          <Legend series={ecSeriesAll} />
        </div>
        <div className="mt-4">
          <LineChart series={ecSeriesAll} yLabel="mS/cm" ariaLabel="Runoff EC by flower day, rooms overlaid" />
        </div>
      </section>
      <section className="card mt-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl text-bone">Runoff %</h2>
          <Legend series={pctSeriesAll} />
        </div>
        <div className="mt-4">
          <LineChart series={pctSeriesAll} yLabel="%" ariaLabel="Runoff percentage by flower day, rooms overlaid" />
        </div>
      </section>
    </Shell>
  );
}
