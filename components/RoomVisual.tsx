import type { Room } from "@/lib/types";

/**
 * The room, drawn from its own profile: two back walls, benches on the
 * floor, plants on the benches, fixtures hung over them, each bench marked
 * by its feed zone. A projected view built from numbers the grower already
 * entered, so it changes when the profile does and never needs a photograph.
 *
 * It is a schematic, never a survey. Bench count comes from the profile (or
 * a guess from the fixture count), fixtures and plants are spread evenly,
 * and long runs are capped so a 60-light bench stays readable. The caption
 * under it carries the real counts.
 *
 * Painted back to front, one bench at a time (bench, plants, then the
 * fixtures over it), so a near bench covers a far one the way it would in
 * the room. Fixtures are translucent so the canopy reads through them.
 *
 * Server-rendered SVG, no script. `tone` colours the floor's edge so the
 * drawing can carry the room's status on a card.
 */

const ZONE = ["#F5A83C", "#8FD17A", "#F0722C", "#C9B8A6", "#FFEFA8", "#FF9E8C"];

export function benchesFor(room: Room): number {
  if (room.benches && room.benches > 0) return Math.min(12, Math.floor(room.benches));
  const lights = room.fixtureCount || 8;
  return Math.max(2, Math.min(8, Math.round(Math.sqrt(lights / 2.5))));
}

export default function RoomVisual({ room, tone = "none", compact = false }: { room: Room; tone?: "ok" | "warn" | "miss" | "none"; compact?: boolean }) {
  const benches = benchesFor(room);
  const lights = room.fixtureCount || benches * 4;
  const plants = Math.round(lights * (room.plantsPerLight || 0));
  const zones = Math.max(1, Math.min(benches, Math.floor(room.feedZones ?? 1)));
  const lightsPerBench = Math.max(1, Math.round(lights / benches));
  const drawnLights = Math.min(lightsPerBench, 8);
  const drawnPlants = Math.min(Math.max(4, Math.round((plants || lights * 8) / benches / 2)), 14);

  // Model units: benches run along x, are spaced along y, z is up.
  const L = 12;
  const BW = 1.6;
  const GAP = 0.9;
  const depth = benches * BW + (benches + 1) * GAP;
  const W = L + 2;
  const BH = 0.8;
  const LZ = 2.7;
  const WALL = 3.6;
  const C = 0.866;
  const S = 0.5;
  const width = 560;
  const padR = !compact && zones > 1 ? 34 : 8;
  const s = (width - 8 - padR) / ((W + depth) * C);
  const ox = 8 + depth * C * s;
  const oy = 8 + WALL * s;
  const height = Math.ceil(oy + (W + depth) * S * s + 8);
  const xy = (x: number, y: number, z = 0): [number, number] => [ox + (x - y) * C * s, oy + (x + y) * S * s - z * s];
  const P = (x: number, y: number, z = 0) => xy(x, y, z).map((v) => v.toFixed(1)).join(",");
  const poly = (pts: [number, number, number][]) => pts.map((p) => P(...p)).join(" ");
  const edge = tone === "ok" ? "#8FD17A" : tone === "warn" ? "#F5A83C" : tone === "miss" ? "#FF9E8C" : "#77604F";

  const rows = Array.from({ length: benches }, (_, i) => {
    const y0 = GAP + i * (BW + GAP);
    return { i, y0, y1: y0 + BW, ym: y0 + BW / 2, zone: Math.floor((i * zones) / benches) };
  });
  const plantR = Math.min(0.5 * s, (L / drawnPlants) * 0.46 * C * s);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`${room.name}: ${benches} benches, ${lights} lights${plants ? `, about ${plants} plants` : ""}, ${zones} feed zone${zones === 1 ? "" : "s"}`}>
        {/* two back walls, then the floor */}
        <polygon points={poly([[0, 0, 0], [W, 0, 0], [W, 0, WALL], [0, 0, WALL]])} fill="#1b1512" stroke="#3a2d26" strokeWidth={1} />
        <polygon points={poly([[0, 0, 0], [0, depth, 0], [0, depth, WALL], [0, 0, WALL]])} fill="#171210" stroke="#3a2d26" strokeWidth={1} />
        <polygon points={poly([[0, 0, 0], [W, 0, 0], [W, depth, 0], [0, depth, 0]])} fill="#120d0c" stroke={edge} strokeWidth={tone === "none" ? 1 : 2.5} strokeLinejoin="round" />

        {rows.map((r) => {
          const tint = ZONE[r.zone % ZONE.length];
          return (
            <g key={r.i}>
              {/* bench: near side, end cap in the zone's colour, top */}
              <polygon points={poly([[1, r.y1, 0], [1 + L, r.y1, 0], [1 + L, r.y1, BH], [1, r.y1, BH]])} fill="#2A2320" stroke="#5A4A3F" strokeWidth={0.6} />
              <polygon points={poly([[1 + L, r.y0, 0], [1 + L, r.y1, 0], [1 + L, r.y1, BH], [1 + L, r.y0, BH]])} fill={zones > 1 ? tint : "#201a17"} fillOpacity={zones > 1 ? 0.85 : 1} stroke="#5A4A3F" strokeWidth={0.6} />
              <polygon points={poly([[1, r.y0, BH], [1 + L, r.y0, BH], [1 + L, r.y1, BH], [1, r.y1, BH]])} fill="#3d3026" stroke="#6B5748" strokeWidth={0.6} />
              {/* canopy */}
              {Array.from({ length: drawnPlants }, (_, k) => {
                const x = 1 + ((k + 0.5) * L) / drawnPlants;
                const [cx, cy] = xy(x, r.ym, BH + 0.5);
                return <ellipse key={k} cx={cx.toFixed(1)} cy={cy.toFixed(1)} rx={plantR.toFixed(1)} ry={(plantR * 0.72).toFixed(1)} fill="#5FA850" stroke="#3d7a35" strokeWidth={0.7} />;
              })}
              {/* fixtures over this bench, with the two hangers that hold each one */}
              {Array.from({ length: drawnLights }, (_, k) => {
                const x = 1 + ((k + 0.5) * L) / drawnLights;
                const hw = Math.min(0.62, (L / drawnLights) * 0.36);
                const [hx, hy] = xy(x, r.ym, LZ);
                const [, top] = xy(x, r.ym, WALL);
                return (
                  <g key={k}>
                    <line x1={hx.toFixed(1)} y1={hy.toFixed(1)} x2={hx.toFixed(1)} y2={top.toFixed(1)} stroke="#5A4A3F" strokeWidth={0.6} />
                    <polygon
                      points={poly([[x - hw, r.y0 + 0.15, LZ], [x + hw, r.y0 + 0.15, LZ], [x + hw, r.y1 - 0.15, LZ], [x - hw, r.y1 - 0.15, LZ]])}
                      fill="#FFEFA8"
                      fillOpacity={0.3}
                      stroke="#F5A83C"
                      strokeWidth={0.9}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* zone labels off the near end of each zone's first bench */}
        {!compact &&
          zones > 1 &&
          rows
            .filter((r, i) => i === 0 || rows[i - 1].zone !== r.zone)
            .map((r) => {
              const [tx, ty] = xy(1 + L + 0.35, r.y1, BH * 0.4);
              return (
                <text key={r.i} x={(tx + 3).toFixed(1)} y={(ty + 5).toFixed(1)} fontSize={15} fontWeight={700} fill={ZONE[r.zone % ZONE.length]}>
                  Z{r.zone + 1}
                </text>
              );
            })}
      </svg>
      {!compact && (
        <figcaption className="mt-2 text-xs text-muted">
          {benches} bench{benches === 1 ? "" : "es"} · {lights} light{lights === 1 ? "" : "s"}
          {plants ? ` · about ${plants.toLocaleString("en-US")} plants` : ""} · {zones} feed zone{zones === 1 ? "" : "s"}
          {room.canopySqft ? ` · ${room.canopySqft.toLocaleString("en-US")} sq ft` : ""}. Drawn from the room profile{zones > 1 ? "; bench ends are coloured by feed zone" : ""}.
        </figcaption>
      )}
    </figure>
  );
}
