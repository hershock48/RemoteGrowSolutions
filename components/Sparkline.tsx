/**
 * A small server-rendered line, oldest to newest, with the target band drawn
 * behind it. No library, no script: an SVG with one path and one rect. The
 * numbers are in the table beside it; this is for the shape.
 */
export default function Sparkline({
  values,
  band,
  ceiling,
  label,
  width = 220,
  height = 56,
}: {
  values: (number | undefined)[];
  band?: [number, number];
  ceiling?: number;
  label: string;
  width?: number;
  height?: number;
}) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => typeof p[1] === "number");
  if (pts.length < 2) {
    return (
      <p className="text-xs text-muted" aria-label={`${label}: not enough readings`}>
        Not enough readings yet.
      </p>
    );
  }
  const ys = pts.map((p) => p[1]).concat(band ?? [], ceiling !== undefined ? [ceiling] : []);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const pad = (hi - lo || 1) * 0.15;
  const y = (v: number) => height - 4 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (height - 8);
  const x = (i: number) => 4 + (i / Math.max(1, values.length - 1)) * (width - 8);
  const d = pts.map((p, k) => `${k === 0 ? "M" : "L"}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`${label}, ${pts.length} readings, latest ${last[1]}`}
      className="max-w-full"
    >
      {band && <rect x={0} y={y(band[1])} width={width} height={Math.max(1, y(band[0]) - y(band[1]))} fill="#8FD17A" opacity={0.14} />}
      {ceiling !== undefined && <line x1={0} x2={width} y1={y(ceiling)} y2={y(ceiling)} stroke="#FF9E8C" strokeDasharray="3 3" strokeWidth={1} />}
      <path d={d} fill="none" stroke="#F5A83C" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last[0])} cy={y(last[1])} r={2.6} fill="#F7F3EC" />
    </svg>
  );
}
