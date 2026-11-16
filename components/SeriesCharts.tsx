import LineChart from "@/components/LineChart";
import { deleteSeries } from "@/app/f/actions";
import { fmtWhen } from "@/lib/dates";
import { flowerDayOf, SERIES_COLUMNS } from "@/lib/sensorcsv";
import type { Series } from "@/lib/chart";
import type { SensorSeries } from "@/lib/types";

const SLOT: Record<string, Series["slot"]> = { wc: "primary", ec: "secondary", temp: "secondary", rh: "third", vpd: "primary", co2: "fourth" };

/**
 * An uploaded sensor export, drawn. One chart per column, because water
 * content and EC do not share a scale and a shared axis flattens one of them.
 * The x axis is the flower day when the room has a run on, so the sawtooth
 * lines up with everything else on the page.
 */
export default function SeriesCharts({ series, flipDate, slug, timezone }: { series: SensorSeries; flipDate?: string; slug: string; timezone: string }) {
  const t0 = series.t[0] ?? 0;
  const xOf = (t: number) => (flipDate ? flowerDayOf(t, flipDate) : (t - t0) / 86_400_000);
  const charts = Object.keys(series.cols)
    .filter((k) => SERIES_COLUMNS[k])
    .map((k) => ({
      key: k,
      meta: SERIES_COLUMNS[k],
      series: [
        {
          name: SERIES_COLUMNS[k].label,
          slot: SLOT[k] ?? "primary",
          dots: false,
          points: series.t.map((t, i) => ({ x: xOf(t), y: series.cols[k][i] })).filter((p): p is { x: number; y: number } => typeof p.y === "number"),
        } satisfies Series,
      ],
    }))
    .filter((c) => c.series[0].points.length > 1);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-muted">
          {series.label} · {series.t.length} points · uploaded {fmtWhen(series.uploadedAt, timezone)} by the {series.by === "rgs" ? "consultant" : "grower"}
        </p>
        <form action={deleteSeries}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={series.id} />
          <button type="submit" className="py-1 text-xs font-semibold text-muted hover:text-miss">
            Remove
          </button>
        </form>
      </div>
      <div className={`mt-2 grid gap-4 ${charts.length > 1 ? "md:grid-cols-2" : ""}`}>
        {charts.map((c) => (
          <div key={c.key} className="rounded-lg border border-line p-3">
            <h4 className="text-sm font-semibold text-bone">
              {c.meta.label} <span className="font-normal text-muted">{c.meta.unit}</span>
            </h4>
            <div className="mt-1">
              <LineChart series={c.series} width={charts.length > 1 ? 400 : 640} height={200} xLabel={flipDate ? "Flower day" : "Days from the first reading"} ariaLabel={`${c.meta.label} from the uploaded export`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
