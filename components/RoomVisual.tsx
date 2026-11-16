import { useId } from "react";
import type { Room } from "@/lib/types";

/**
 * The room, drawn from its own profile: a cutaway with two walls, rolling
 * benches on legs, a canopy on every bench, bar fixtures hung from rails, a
 * drip line down each bench in its feed zone's colour.
 *
 * FOUR THINGS IN IT ARE DATA, the rest is set dressing:
 *   benches, fixtures, plants, feed zones   the room profile
 *   plant size and colour                   the day of flower (`progress`)
 *   whether the lights are lit              the lighting schedule, now (`lit`)
 *   the floor's edge                        the room's status (`tone`)
 * So a room at day 10 looks different from one at day 52, and a room whose
 * lights are off is drawn dark. The wall units and the door are decoration
 * and say nothing about the real room.
 *
 * It is a schematic, never a survey. Fixtures and plants are spread evenly
 * and long runs are capped so a 60-light bench stays readable; the caption
 * under it carries the real counts.
 *
 * Painted back to front, one bench at a time (shadow, legs, tray, canopy,
 * light, rail, fixtures), so a near bench covers a far one the way it would
 * in the room. Server-rendered SVG, no script. Gradient ids come from useId
 * because a page can hold several of these.
 */

const ZONE = ["#F5A83C", "#8FD17A", "#F0722C", "#C9B8A6", "#FFEFA8", "#FF9E8C"];

export function benchesFor(room: Room): number {
  if (room.benches && room.benches > 0) return Math.min(12, Math.floor(room.benches));
  const lights = room.fixtureCount || 8;
  return Math.max(2, Math.min(8, Math.round(Math.sqrt(lights / 2.5))));
}

export default function RoomVisual({
  room,
  tone = "none",
  compact = false,
  progress,
  lit,
}: {
  room: Room;
  tone?: "ok" | "warn" | "miss" | "none";
  compact?: boolean;
  /** How far through flower the run is, 0 to 1. Sets the size and colour of the plants. */
  progress?: number;
  /** Whether the lights are on right now, from the schedule. Unknown draws them on. */
  lit?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const benches = benchesFor(room);
  const lights = room.fixtureCount || benches * 4;
  const plants = Math.round(lights * (room.plantsPerLight || 0));
  const zones = Math.max(1, Math.min(benches, Math.floor(room.feedZones ?? 1)));
  const lightsPerBench = Math.max(1, Math.round(lights / benches));
  const drawnLights = Math.min(lightsPerBench, compact ? 6 : 8);
  const perRow = Math.min(Math.max(5, Math.round((plants || lights * 8) / benches / 2)), compact ? 9 : 13);
  const on = lit !== false;
  const stage = progress === undefined ? 0.6 : Math.min(1, Math.max(0, progress));
  const late = stage > 0.72;

  // Model units: benches run along x, are spaced along y, z is up.
  const L = 12;
  const BW = 1.8;
  const GAP = 1.0;
  const depth = benches * BW + (benches + 1) * GAP;
  const W = L + 2;
  const BH = 0.9;
  const TRAY = 0.2;
  const PH = 0.45 + 1.0 * stage;
  const LZ = 3.5;
  const WALL = 4.7;
  const RAIL = WALL - 0.3;
  const C = 0.866;
  const S = 0.5;
  const width = 560;
  const padR = !compact && zones > 1 ? 40 : 8;
  const s = (width - 8 - padR) / ((W + depth) * C);
  const ox = 8 + depth * C * s;
  const oy = 8 + WALL * s;
  const height = Math.ceil(oy + (W + depth) * S * s + 8);
  const xy = (x: number, y: number, z = 0): [number, number] => [ox + (x - y) * C * s, oy + (x + y) * S * s - z * s];
  const P = (x: number, y: number, z = 0) => xy(x, y, z).map((v) => v.toFixed(1)).join(",");
  const poly = (pts: [number, number, number][]) => pts.map((p) => P(...p)).join(" ");
  const seg = (a: [number, number, number], b: [number, number, number]) => {
    const [x1, y1] = xy(...a);
    const [x2, y2] = xy(...b);
    return { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1) };
  };
  const edge = tone === "ok" ? "#8FD17A" : tone === "warn" ? "#F5A83C" : tone === "miss" ? "#FF9E8C" : "#77604F";

  const rows = Array.from({ length: benches }, (_, i) => {
    const y0 = GAP + i * (BW + GAP);
    return { i, y0, y1: y0 + BW, ym: y0 + BW / 2, zone: Math.floor((i * zones) / benches) };
  });
  const spacing = L / perRow;
  const plantRx = Math.min(spacing * 0.7, BW * 0.4) * C * s;
  const plantRy = PH * 0.33 * s + plantRx * 0.3;
  const hw = Math.min(0.62, (L / drawnLights) * 0.36);
  const units = compact ? [] : [W * 0.3, W * 0.72];

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${room.name}: ${benches} benches, ${lights} lights${plants ? `, about ${plants} plants` : ""}, ${zones} feed zone${zones === 1 ? "" : "s"}${lit === undefined ? "" : on ? ", lights on" : ", lights off"}`}
      >
        <defs>
          <linearGradient id={`${uid}f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={on ? "#1d1613" : "#12100f"} />
            <stop offset="1" stopColor="#0b0808" />
          </linearGradient>
          <linearGradient id={`${uid}wb`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#15100e" />
            <stop offset="1" stopColor={on ? "#261d18" : "#191412"} />
          </linearGradient>
          <linearGradient id={`${uid}wl`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#110d0b" />
            <stop offset="1" stopColor={on ? "#1e1713" : "#151110"} />
          </linearGradient>
          <radialGradient id={`${uid}p`} cx="0.36" cy="0.28" r="0.8">
            <stop offset="0" stopColor={!on ? "#3f6a3a" : late ? "#b6d98a" : "#9bdc82"} />
            <stop offset="0.55" stopColor={!on ? "#2a4a28" : late ? "#5d9a4a" : "#4f9a43"} />
            <stop offset="1" stopColor={!on ? "#1a2e1a" : "#2c6328"} />
          </radialGradient>
          <linearGradient id={`${uid}c`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFEFA8" stopOpacity="0.3" />
            <stop offset="1" stopColor="#FFEFA8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}t`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#57463a" />
            <stop offset="1" stopColor="#3b2f27" />
          </linearGradient>
        </defs>

        {/* ── the shell: two walls and the floor ── */}
        <polygon points={poly([[0, 0, 0], [W, 0, 0], [W, 0, WALL], [0, 0, WALL]])} fill={`url(#${uid}wb)`} stroke="#3a2d26" strokeWidth={1} />
        <polygon points={poly([[0, 0, 0], [0, depth, 0], [0, depth, WALL], [0, 0, WALL]])} fill={`url(#${uid}wl)`} stroke="#3a2d26" strokeWidth={1} />
        <line {...seg([0, 0, 0], [0, 0, WALL])} stroke="#4a3a30" strokeWidth={1} />

        {/* a door on the side wall and two air handlers on the back wall: decoration */}
        {!compact && depth > 5 && (
          <g>
            <polygon points={poly([[0, depth - 2.5, 0], [0, depth - 1.1, 0], [0, depth - 1.1, 2.7], [0, depth - 2.5, 2.7]])} fill="#0d0a09" stroke="#4a3a30" strokeWidth={0.8} />
            <circle cx={xy(0, depth - 1.35, 1.3)[0].toFixed(1)} cy={xy(0, depth - 1.35, 1.3)[1].toFixed(1)} r={1.4} fill="#8a7566" />
          </g>
        )}
        {units.map((ux) => (
          <g key={ux}>
            <polygon points={poly([[ux - 1, 0, 3.9], [ux + 1, 0, 3.9], [ux + 1, 0.5, 3.9], [ux - 1, 0.5, 3.9]])} fill="#3a302a" stroke="#5A4A3F" strokeWidth={0.6} />
            <polygon points={poly([[ux + 1, 0, 2.9], [ux + 1, 0.5, 2.9], [ux + 1, 0.5, 3.9], [ux + 1, 0, 3.9]])} fill="#241d19" stroke="#5A4A3F" strokeWidth={0.6} />
            <polygon points={poly([[ux - 1, 0.5, 2.9], [ux + 1, 0.5, 2.9], [ux + 1, 0.5, 3.9], [ux - 1, 0.5, 3.9]])} fill="#2e2622" stroke="#5A4A3F" strokeWidth={0.6} />
            {[3.15, 3.4, 3.65].map((z) => (
              <line key={z} {...seg([ux - 0.8, 0.5, z], [ux + 0.8, 0.5, z])} stroke="#6B5748" strokeWidth={0.7} />
            ))}
          </g>
        ))}

        <polygon points={poly([[0, 0, 0], [W, 0, 0], [W, depth, 0], [0, depth, 0]])} fill={`url(#${uid}f)`} stroke={edge} strokeWidth={tone === "none" ? 1 : 2.5} strokeLinejoin="round" />
        {!compact &&
          Array.from({ length: Math.floor(W / 2) }, (_, i) => (i + 1) * 2).map((gx) => <line key={`gx${gx}`} {...seg([gx, 0, 0], [gx, depth, 0])} stroke="#ffffff" strokeOpacity={0.035} strokeWidth={1} />)}
        {!compact &&
          Array.from({ length: Math.floor(depth / 2) }, (_, i) => (i + 1) * 2).map((gy) => <line key={`gy${gy}`} {...seg([0, gy, 0], [W, gy, 0])} stroke="#ffffff" strokeOpacity={0.035} strokeWidth={1} />)}

        {/* ── the benches, back to front ── */}
        {rows.map((r) => {
          const tint = zones > 1 ? ZONE[r.zone % ZONE.length] : "#8a7566";
          const x0 = 1;
          const x1 = 1 + L;
          return (
            <g key={r.i}>
              {/* shadow on the floor, legs, then the tray */}
              <polygon points={poly([[x0 + 0.3, r.y0 + 0.35, 0], [x1 + 0.3, r.y0 + 0.35, 0], [x1 + 0.3, r.y1 + 0.35, 0], [x0 + 0.3, r.y1 + 0.35, 0]])} fill="#000" fillOpacity={0.4} />
              {[x0 + 0.4, x0 + L / 2, x1 - 0.4].map((lx) => (
                <g key={lx}>
                  <line {...seg([lx, r.y0 + 0.15, 0], [lx, r.y0 + 0.15, BH - TRAY])} stroke="#4a3d35" strokeWidth={1.1} />
                  <line {...seg([lx, r.y1 - 0.1, 0], [lx, r.y1 - 0.1, BH - TRAY])} stroke="#7a6658" strokeWidth={1.3} />
                </g>
              ))}
              <polygon points={poly([[x0, r.y1, BH - TRAY], [x1, r.y1, BH - TRAY], [x1, r.y1, BH], [x0, r.y1, BH]])} fill="#2c2420" stroke="#5A4A3F" strokeWidth={0.6} />
              <polygon points={poly([[x1, r.y0, BH - TRAY], [x1, r.y1, BH - TRAY], [x1, r.y1, BH], [x1, r.y0, BH]])} fill={tint} fillOpacity={zones > 1 ? 0.9 : 0.5} stroke="#5A4A3F" strokeWidth={0.6} />
              <polygon points={poly([[x0, r.y0, BH], [x1, r.y0, BH], [x1, r.y1, BH], [x0, r.y1, BH]])} fill={`url(#${uid}t)`} stroke="#6B5748" strokeWidth={0.6} />

              {/* the canopy: two staggered rows of plants a bench */}
              {[0.3, 0.7].map((across, rowIx) =>
                Array.from({ length: perRow }, (_, k) => {
                  const x = x0 + (k + (rowIx ? 0.75 : 0.25)) * spacing;
                  const y = r.y0 + BW * across;
                  const [bx, by] = xy(x, y, BH + 0.08);
                  const [cx, cy] = xy(x, y, BH + 0.22 + PH * 0.5);
                  return (
                    <g key={`${rowIx}-${k}`}>
                      <ellipse cx={bx.toFixed(1)} cy={by.toFixed(1)} rx={(plantRx * 0.5).toFixed(1)} ry={(plantRx * 0.28).toFixed(1)} fill="#14100e" />
                      <ellipse cx={cx.toFixed(1)} cy={cy.toFixed(1)} rx={plantRx.toFixed(1)} ry={plantRy.toFixed(1)} fill={`url(#${uid}p)`} stroke="#234d20" strokeWidth={0.5} />
                      {late && !compact && on && <ellipse cx={(cx - plantRx * 0.12).toFixed(1)} cy={(cy - plantRy * 0.5).toFixed(1)} rx={(plantRx * 0.3).toFixed(1)} ry={(plantRy * 0.26).toFixed(1)} fill="#e6f2b8" fillOpacity={0.75} />}
                    </g>
                  );
                })
              )}

              {/* the drip line, in the zone's colour, along the near edge */}
              <line {...seg([x0 + 0.05, r.y1 - 0.1, BH + 0.02], [x1 - 0.05, r.y1 - 0.1, BH + 0.02])} stroke={tint} strokeOpacity={0.95} strokeWidth={compact ? 1.2 : 1.6} />

              {/* light falling on the canopy, then the rail and the fixtures hung from it */}
              {on &&
                Array.from({ length: drawnLights }, (_, k) => {
                  const x = x0 + ((k + 0.5) * L) / drawnLights;
                  return <polygon key={`c${k}`} points={poly([[x - hw, r.ym, LZ], [x + hw, r.ym, LZ], [x + hw * 1.7, r.ym, BH + PH * 0.7], [x - hw * 1.7, r.ym, BH + PH * 0.7]])} fill={`url(#${uid}c)`} />;
                })}
              <line {...seg([x0, r.ym, RAIL], [x1, r.ym, RAIL])} stroke="#4a3d35" strokeWidth={1} />
              {Array.from({ length: drawnLights }, (_, k) => {
                const x = x0 + ((k + 0.5) * L) / drawnLights;
                const ya = r.y0 + 0.14;
                const yb = r.y1 - 0.14;
                return (
                  <g key={k}>
                    <line {...seg([x, r.ym, LZ], [x, r.ym, RAIL])} stroke="#5A4A3F" strokeWidth={0.6} />
                    <polygon
                      points={poly([[x - hw, ya, LZ], [x + hw, ya, LZ], [x + hw, yb, LZ], [x - hw, yb, LZ]])}
                      fill={on ? "#FFEFA8" : "#1b1614"}
                      fillOpacity={on ? 0.1 : 0.85}
                      stroke={on ? "#F5C96A" : "#5A4A3F"}
                      strokeWidth={0.8}
                    />
                    {[-0.66, -0.22, 0.22, 0.66].map((b) => (
                      <line key={b} {...seg([x + hw * b, ya, LZ], [x + hw * b, yb, LZ])} stroke={on ? "#FFF3C2" : "#5A4A3F"} strokeWidth={on ? 1.5 : 1} strokeLinecap="round" />
                    ))}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* a tag off the near end of each zone's first bench */}
        {!compact &&
          zones > 1 &&
          rows
            .filter((r, i) => i === 0 || rows[i - 1].zone !== r.zone)
            .map((r) => {
              const [tx, ty] = xy(1 + L + 0.5, r.y1, BH * 0.4);
              const tint = ZONE[r.zone % ZONE.length];
              return (
                <g key={r.i}>
                  <rect x={(tx + 2).toFixed(1)} y={(ty - 9).toFixed(1)} width={30} height={18} rx={4} fill="#120d0c" stroke={tint} strokeWidth={1} />
                  <text x={(tx + 17).toFixed(1)} y={(ty + 4.5).toFixed(1)} textAnchor="middle" fontSize={13} fontWeight={700} fill={tint}>
                    Z{r.zone + 1}
                  </text>
                </g>
              );
            })}
      </svg>
      {!compact && (
        <figcaption className="mt-2 text-xs text-muted">
          {benches} bench{benches === 1 ? "" : "es"} · {lights} light{lights === 1 ? "" : "s"}
          {plants ? ` · about ${plants.toLocaleString("en-US")} plants` : ""} · {zones} feed zone{zones === 1 ? "" : "s"}
          {room.canopySqft ? ` · ${room.canopySqft.toLocaleString("en-US")} sq ft` : ""}
          {lit === undefined ? "" : on ? " · lights on now" : " · lights off now"}. Drawn from the room profile{progress === undefined ? "" : "; the plants are sized to the day of flower"}
          {zones > 1 ? "; drip lines and bench ends are coloured by feed zone" : ""}.
        </figcaption>
      )}
    </figure>
  );
}
