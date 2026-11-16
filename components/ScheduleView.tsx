import { ml, pct } from "@/lib/irrigation";
import { buildSchedule, fmtClock, parseHHMM } from "@/lib/schedule";
import type { Room } from "@/lib/types";

/**
 * The irrigation schedule, read out: the drippers it is calculated from, P1
 * and P2 as a strip across the lights-on window, every shot with the time it
 * turns on and off and what it delivers per plant, and the day's totals.
 */
export default function ScheduleView({ room, editHref }: { room: Room; editHref: string }) {
  const b = buildSchedule(room.schedule, room.emittersPerPlant, room.emitterGph, room.containerGal);
  const perMin = room.emittersPerPlant * room.emitterGph * 63.09;

  if (!room.schedule || b.feeds === 0) {
    return (
      <div className="rounded-lg border border-dashed border-edge/70 px-4 py-4 text-sm text-muted">
        <p>
          {room.emittersPerPlant} dripper{room.emittersPerPlant === 1 ? "" : "s"} per plant at {room.emitterGph} GPH each delivers {ml(perMin)} mL a minute per plant.
        </p>
        <p className="mt-1">
          No P1 and P2 schedule is on this room yet.{" "}
          <a href={editHref} className="font-semibold text-flare hover:underline">
            Add lights on and off, and the P1 and P2 timing
          </a>{" "}
          and every shot is listed here with its on and off time and volume.
        </p>
      </div>
    );
  }

  const span = b.photoperiodMin ?? 720;
  const on = parseHHMM(room.schedule.lightsOn) ?? 0;
  const Wd = 640;
  const x = (rel: number) => 8 + (Math.min(rel, span) / span) * (Wd - 16);
  const hours = Array.from({ length: Math.floor(span / 120) + 1 }, (_, i) => i * 120);

  return (
    <div>
      <dl className="grid gap-px overflow-hidden rounded-xl2 border border-line bg-line sm:grid-cols-4">
        <Stat label="Drippers" value={`${room.emittersPerPlant} × ${room.emitterGph} GPH`} sub={`${ml(perMin)} mL a minute per plant`} />
        <Stat label="Feeds a day" value={String(b.feeds)} sub={`${b.p1?.shots ?? 0} in P1, ${b.p2?.shots ?? 0} in P2`} />
        <Stat label="Total volume" value={`${ml(b.dailyMl)} mL`} sub="per plant, per day" />
        <Stat label="Of the container" value={b.substratePct === null ? "No container size" : pct(b.substratePct)} sub={room.containerGal ? `${room.containerGal} gal` : "add it on the profile"} />
      </dl>

      <svg viewBox={`0 0 ${Wd} 74`} className="chart mt-4 h-auto w-full" role="img" aria-label={`Irrigation across the lights-on window: ${b.feeds} shots from ${b.events[0].on} to ${b.events[b.events.length - 1].off}`}>
        <rect x={8} y={18} width={Wd - 16} height={26} rx={4} style={{ fill: "var(--chart-shade)" }} />
        {hours.map((h) => (
          <g key={h}>
            <line x1={x(h)} x2={x(h)} y1={18} y2={48} style={{ stroke: "var(--chart-grid)" }} strokeWidth={1} />
            <text x={x(h)} y={62} textAnchor={h === 0 ? "start" : h >= span - 60 ? "end" : "middle"} fontSize={11} style={{ fill: "var(--chart-axis)" }}>
              {fmtClock(on + h)}
            </text>
          </g>
        ))}
        {b.events.map((e, i) => (
          <rect key={i} x={x(e.rel) - 2} y={e.phase === "P1" ? 20 : 26} width={4} height={e.phase === "P1" ? 22 : 16} rx={1} style={{ fill: e.phase === "P1" ? "var(--chart-secondary)" : "var(--chart-fourth)" }} />
        ))}
        <text x={8} y={12} fontSize={11} style={{ fill: "var(--chart-axis)" }}>
          Lights on {room.schedule.lightsOn}
        </text>
        <text x={Wd - 8} y={12} textAnchor="end" fontSize={11} style={{ fill: "var(--chart-axis)" }}>
          Lights off {room.schedule.lightsOff}
        </text>
      </svg>

      {b.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-warn">
          {b.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {(["P1", "P2"] as const).map((name) => {
          const t = name === "P1" ? b.p1 : b.p2;
          const events = b.events.filter((e) => e.phase === name);
          return (
            <div key={name} className="rounded-lg border border-line">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
                <h4 className="font-display text-base font-bold text-bone">
                  <span className={`dot mr-2 align-middle ${name === "P1" ? "bg-flare" : "bg-ember-hot"}`} aria-hidden="true" />
                  {name}
                  <span className="ml-2 text-xs font-normal text-muted">{name === "P1" ? "ramp to field capacity" : "maintenance"}</span>
                </h4>
                <span className="text-xs text-muted">{t ? `${t.shots} × ${ml(t.shotMl)} mL = ${ml(t.totalMl)} mL` : "Not set"}</span>
              </div>
              {t ? (
                <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label={`${name} shots, scrolls sideways on a small phone`}>
                <table className="tbl [&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-3 sm:[&_th]:px-3">
                  <thead>
                    <tr>
                      <th scope="col">Shot</th>
                      <th scope="col">On</th>
                      <th scope="col">Off</th>
                      <th scope="col">mL</th>
                      <th scope="col">Day so far</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.n}>
                        <td className="text-muted">{e.n}</td>
                        <td className="font-semibold">{e.on}</td>
                        <td>{e.off}</td>
                        <td>{ml(e.ml)}</td>
                        <td className="text-muted">{ml(e.cumMl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              ) : (
                <p className="px-4 py-3 text-sm text-muted">No {name} timing on the profile.</p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">Volumes are nominal: dripper size times run time, per plant. Verify dripper output with a cup and a timer.</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-ink-panel px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-bold text-bone">{value}</dd>
      <dd className="text-xs text-muted">{sub}</dd>
    </div>
  );
}
