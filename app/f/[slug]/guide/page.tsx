import type { Metadata } from "next";
import Link from "next/link";
import Shell from "@/components/Shell";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { GUIDE } from "@/lib/site";

export const metadata: Metadata = { title: "Guide: runoff reads" };

/**
 * The guide a grower opens with a pitcher in one hand: how to take a runoff
 * read, by plant and by whole row, and where to put the numbers.
 *
 * WHERE THE WORDS COME FROM. The rules are Jake's (2026-11-16): at least two
 * plants per feed zone, spread out so the data is balanced; a whole-row
 * collection where the room allows one, in place of the plants or beside
 * them; EC, pH and volume for every zone of every room. The line about a
 * plant with no runoff is from his own paper log. The steps between those
 * rules are the ordinary method and are PLACEHOLDER until he has read them:
 * he records the video, and the written steps should match what he shows.
 */
export default async function Guide({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { facility, viewer } = await requireFacility(slug);
  const rooms = (await store.rooms(facility.id)).filter((r) => !r.archivedAt && r.kind === "flower");
  const base = `/f/${facility.slug}`;
  const video = GUIDE.videoUrl;
  const plays = /\.(mp4|webm)(\?.*)?$/i.test(video);

  return (
    <Shell facility={facility} viewer={viewer} backend={store.backend} current="/guide">
      <p className="eyebrow">Guide</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">Taking runoff reads</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-muted">
        EC, pH and volume, for every feed zone in every flower room. Read at least {GUIDE.minPlantsPerZone} plants in each zone, or collect a whole row where the bench drains to one point.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="card overflow-hidden">
            {video && plays ? (
              <video controls preload="metadata" className="aspect-video w-full bg-ink" src={video}>
                <track kind="captions" />
              </video>
            ) : video ? (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-ink p-6 text-center">
                <a href={video} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  Watch the demonstration
                </a>
              </div>
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-ink p-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-edge text-xl text-muted" aria-hidden="true">
                  ▶
                </span>
                <p className="font-display text-lg font-bold text-bone">Video demonstration</p>
                <p className="max-w-sm text-sm text-muted">Not recorded yet. The written steps below cover the same ground until it is here.</p>
              </div>
            )}
          </div>

          <section className="mt-8">
            <h2 className="text-xl text-bone">Individual plants</h2>
            <ol className="mt-3 space-y-3 text-[15px] leading-relaxed text-bone/90">
              {[
                `Pick at least ${GUIDE.minPlantsPerZone} plants in every feed zone and spread them out: one near the start of the line and one near the end, never side by side. Use the same plants every day so the numbers can be compared.`,
                "Before the first irrigation of the day, set an empty, clean collection tray or pitcher under each one so it catches everything that drains from that plant and nothing from its neighbours.",
                "Leave it in place through the whole day of irrigation, P1 and P2.",
                "After the last shot has drained, measure the volume collected, in millilitres.",
                "Stir the sample, then read EC and pH with a meter that has been calibrated.",
                "Enter EC, pH and mL for each plant under its zone, then empty and rinse the container.",
              ].map((s, i) => (
                <Step key={i} n={i + 1}>
                  {s}
                </Step>
              ))}
            </ol>
          </section>

          <section className="mt-8">
            <h2 className="text-xl text-bone">Whole-row collection</h2>
            <p className="mt-2 text-[15px] text-muted">Where a bench or row drains to a single point. Use it in place of the plant reads or, better, with them.</p>
            <ol className="mt-3 space-y-3 text-[15px] leading-relaxed text-bone/90">
              {[
                "Put the collection container at the drain end of the row before the first irrigation, sized to hold the whole day.",
                "After the last shot has drained, measure the total volume for the row.",
                "Stir, then read EC and pH from that one sample.",
                "Enter it on the zone as the whole-row read. The volume is the total for the row, so it is kept apart from the per-plant volumes and does not go into the runoff percentage.",
              ].map((s, i) => (
                <Step key={i} n={i + 1}>
                  {s}
                </Step>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <p className="eyebrow">Rules</p>
            <ul className="mt-3 space-y-2 text-sm text-bone/90">
              <li>Every feed zone in every flower room, each weekday.</li>
              <li>At least {GUIDE.minPlantsPerZone} plants per zone, spread out, or one whole-row collection.</li>
              <li>No runoff from a plant: enter 0 for the volume and leave EC and pH blank. It is recorded as 0 mL, N/A. Never skip the plant.</li>
              <li>Use the same plants and the same containers each day.</li>
              <li>The runoff line on the room ticks itself once every zone has its reads.</li>
            </ul>
          </section>

          <section className="card p-5">
            <p className="eyebrow">Enter runoff reads</p>
            {rooms.length === 0 && <p className="mt-3 text-sm text-muted">No flower rooms yet.</p>}
            <ul className="mt-3 space-y-2">
              {rooms.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-bone">
                    {r.name} <span className="text-muted">· {Math.max(1, Math.floor(r.feedZones ?? 1))} zone{Math.max(1, Math.floor(r.feedZones ?? 1)) === 1 ? "" : "s"}</span>
                  </span>
                  <Link href={`${base}/checkin?room=${r.id}`} className="btn-small">
                    Enter for {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </Shell>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-edge text-xs font-bold text-flare" aria-hidden="true">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
