import { fmtTick, isOutside, pathOf, scale, ticks, xDomain, yDomain, type Series } from "@/lib/chart";

/**
 * The one chart. Server-rendered SVG, no library, no script: axes, a light
 * grid, an optional shaded band and dashed ceiling, up to four series, dots
 * coloured when a reading sits outside its series' band or above its
 * ceiling, an optional shaded span (the report's week) and a vertical
 * marker (today).
 *
 * EVERY COLOUR IS A CSS VARIABLE set on `.chart` in globals.css, with a
 * print block that swaps the whole palette to ink on paper. The same markup
 * therefore draws dark on screen and prints cleanly, which is what lets the
 * weekly report carry its charts into the PDF a grower forwards.
 *
 * The viewBox is fixed and the SVG scales to its container, so one chart
 * fits a phone column and a desktop hero without two sets of numbers.
 */
export default function LineChart({
  series,
  xLabel = "Flower day",
  yLabel,
  shade,
  marker,
  width = 640,
  height = 240,
  ariaLabel,
}: {
  series: Series[];
  xLabel?: string;
  yLabel?: string;
  /** An x span to shade, e.g. the report's week in flower days. */
  shade?: [number, number];
  /** A vertical line at this x, e.g. today's flower day. */
  marker?: number;
  width?: number;
  height?: number;
  ariaLabel: string;
}) {
  const live = series.filter((s) => s.points.length > 0);
  if (!live.length) {
    return (
      <p className="text-sm text-muted" aria-label={`${ariaLabel}: no readings yet`}>
        No readings yet.
      </p>
    );
  }
  const pad = { l: 44, r: 14, t: 14, b: 34 };
  const xd = xDomain(live, [...(shade ?? []), ...(marker !== undefined ? [marker] : [])]);
  const yd = yDomain(live);
  const sx = scale(xd, [pad.l, width - pad.r]);
  const sy = scale(yd, [height - pad.b, pad.t]);
  const xt = ticks(xd, 6).filter((v) => Number.isInteger(v));
  const yt = ticks(yd, 4);
  const band = live.find((s) => s.band)?.band;
  const ceiling = live.find((s) => s.ceiling !== undefined)?.ceiling;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart h-auto w-full" role="img" aria-label={ariaLabel}>
      {/* grid and axes */}
      {yt.map((v) => (
        <g key={`y${v}`}>
          <line x1={pad.l} x2={width - pad.r} y1={sy(v)} y2={sy(v)} style={{ stroke: "var(--chart-grid)" }} strokeWidth={1} />
          <text x={pad.l - 8} y={sy(v) + 4} textAnchor="end" fontSize={11} style={{ fill: "var(--chart-axis)" }}>
            {fmtTick(v)}
          </text>
        </g>
      ))}
      {xt.map((v) => (
        <text key={`x${v}`} x={sx(v)} y={height - pad.b + 16} textAnchor="middle" fontSize={11} style={{ fill: "var(--chart-axis)" }}>
          {v}
        </text>
      ))}
      <text x={(pad.l + width - pad.r) / 2} y={height - 4} textAnchor="middle" fontSize={11} style={{ fill: "var(--chart-axis)" }}>
        {xLabel}
      </text>
      {yLabel && (
        <text x={12} y={pad.t + 2} fontSize={11} style={{ fill: "var(--chart-axis)" }}>
          {yLabel}
        </text>
      )}

      {/* the week, the band, the ceiling, today */}
      {shade && <rect x={sx(shade[0])} y={pad.t} width={Math.max(2, sx(shade[1]) - sx(shade[0]))} height={height - pad.t - pad.b} style={{ fill: "var(--chart-shade)" }} />}
      {band && <rect x={pad.l} y={sy(band[1])} width={width - pad.l - pad.r} height={Math.max(1, sy(band[0]) - sy(band[1]))} style={{ fill: "var(--chart-band)" }} />}
      {ceiling !== undefined && (
        <line x1={pad.l} x2={width - pad.r} y1={sy(ceiling)} y2={sy(ceiling)} style={{ stroke: "var(--chart-alert)" }} strokeWidth={1.2} strokeDasharray="4 4" />
      )}
      {marker !== undefined && <line x1={sx(marker)} x2={sx(marker)} y1={pad.t} y2={height - pad.b} style={{ stroke: "var(--chart-axis)" }} strokeWidth={1} strokeDasharray="2 3" />}

      {/* series */}
      {live.map((s) => {
        const color = `var(--chart-${s.slot ?? "primary"})`;
        return (
          <g key={s.name}>
            <path d={pathOf(s.points, sx, sy)} fill="none" style={{ stroke: color }} strokeWidth={s.slot === "primary" || !s.slot ? 2 : 1.6} strokeLinejoin="round" strokeLinecap="round" />
            {s.dots !== false &&
              s.points.map((p, i) => {
                const out = isOutside(s, p);
                return <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={out ? 3.6 : 2.6} style={{ fill: out ? "var(--chart-alert)" : color, stroke: out ? "var(--chart-bg)" : "none" }} strokeWidth={1} />;
              })}
          </g>
        );
      })}
    </svg>
  );
}

/** The legend the chart does not draw for itself, so it can sit in a title row. */
export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {series
        .filter((s) => s.points.length)
        .map((s) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <span className="chart inline-block h-2 w-5 rounded-sm" style={{ background: `var(--chart-${s.slot ?? "primary"})` }} aria-hidden="true" />
            {s.name}
          </li>
        ))}
      {series.some((s) => s.ceiling !== undefined) && (
        <li className="flex items-center gap-1.5">
          <span className="chart inline-block h-0 w-5 border-t border-dashed" style={{ borderColor: "var(--chart-alert)" }} aria-hidden="true" />
          Ceiling
        </li>
      )}
      {series.some((s) => s.band) && (
        <li className="flex items-center gap-1.5">
          <span className="chart inline-block h-2.5 w-5 rounded-sm" style={{ background: "var(--chart-band-solid)" }} aria-hidden="true" />
          Target
        </li>
      )}
    </ul>
  );
}
