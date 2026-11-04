import { fmtDay, fmtWhen } from "@/lib/dates";
import { ml } from "@/lib/irrigation";
import type { Checkin } from "@/lib/types";

/**
 * What the customer entered, date by date, in the groups the owner's own
 * write-up used: day, environment, lights, irrigation, runoff, substrate,
 * then what they saw. One card per entry, newest first, nothing derived
 * except the daily volume and the runoff percentage the form computed at
 * the time. This is the page the consultant opens to read a room.
 *
 * Markup: a group is a heading plus one <dl> of <div><dt/><dd/></div> pairs,
 * which is the only shape a definition list may take (the auditor flagged
 * the first draft, which had the group label inside the list).
 */
const fmt = (v: number | undefined, unit = "", d?: number) => (v === undefined ? null : `${d !== undefined ? v.toFixed(d) : v}${unit}`);

type Group = { name: string; items: [string, string][] };

export default function EntryLog({ checkins, timezone, limit = 40 }: { checkins: Checkin[]; timezone: string; limit?: number }) {
  if (!checkins.length) return <p className="card px-5 py-4 text-sm text-muted">No entries yet.</p>;
  const shown = checkins.slice(0, limit);
  return (
    <div className="space-y-3">
      {shown.map((c) => {
        const raw: { name: string; items: [string, string | null][] }[] = [
          {
            name: "Environment",
            items: [
              ["Temp", fmt(c.tempF, " °F")],
              ["RH", fmt(c.rh, "%")],
              ["CO₂", fmt(c.co2, " ppm")],
            ],
          },
          { name: "Lights", items: [["PPFD", fmt(c.ppfd)]] },
          {
            name: "Irrigation",
            items: [
              ["Feed EC", fmt(c.feedEc)],
              ["Feed pH", fmt(c.feedPh)],
              ["Shot", fmt(c.shotMin, " min")],
              ["Shots", fmt(c.shotsPerDay, " a day")],
              ["Daily", c.feedMl !== undefined ? `${ml(c.feedMl)} mL` : null],
            ],
          },
          {
            name: "Runoff",
            items: [
              ["EC", fmt(c.runoffEc)],
              ["pH", fmt(c.runoffPh)],
              ["Volume", fmt(c.runoffMl, " mL")],
              ["Percent", fmt(c.runoffPct, "%", 1)],
            ],
          },
          {
            name: "Substrate",
            items: [
              ["WC", fmt(c.substrateWc, "%")],
              ["EC", fmt(c.substrateEc)],
              ["Dryback", fmt(c.dryback, "%")],
            ],
          },
        ];
        const groups: Group[] = raw.map((g) => ({ name: g.name, items: g.items.filter((i): i is [string, string] => i[1] !== null) })).filter((g) => g.items.length);
        return (
          <article key={c.id} className="card p-4 sm:p-5">
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-display text-lg font-bold text-bone">
                {c.dayOfFlower !== undefined ? `Day ${c.dayOfFlower}` : fmtDay(c.day)}
                <span className="ml-2 text-sm font-normal text-muted">{fmtDay(c.day, { weekday: "short", month: "short", day: "numeric" })}</span>
              </h3>
              <span className="text-xs text-muted">
                Entered {fmtWhen(c.at, timezone)} by the {c.submittedBy === "rgs" ? "consultant" : "grower"}
              </span>
            </header>
            <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {groups.map((g) => (
                <section key={g.name} aria-label={g.name}>
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{g.name}</h4>
                  <dl>
                    {g.items.map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1 text-sm last:border-b-0">
                        <dt className="text-muted">{k}</dt>
                        <dd className="whitespace-nowrap font-semibold text-bone">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
            {(c.observations || c.photoUrl) && (
              <p className="mt-3 text-[15px] leading-relaxed text-bone/90">
                {c.observations}
                {c.photoUrl && (
                  <a href={c.photoUrl} target="_blank" rel="noopener" className="ml-2 text-flare hover:underline">
                    Canopy photo
                  </a>
                )}
              </p>
            )}
          </article>
        );
      })}
      {checkins.length > limit && <p className="text-xs text-muted">Showing the latest {limit} of {checkins.length} entries.</p>}
    </div>
  );
}
