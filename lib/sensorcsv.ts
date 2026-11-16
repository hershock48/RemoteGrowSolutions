/**
 * A sensor platform's export, read into something a chart can draw.
 *
 * Every platform a grower runs (Aroya, Growlink, TrolMaster and the rest)
 * can export its readings as a CSV. Until a facility's platform is connected
 * directly, that file is how its substrate and climate graphs get here: the
 * grower uploads the export and the room page draws it.
 *
 * Exports differ in everything except shape: one time column, then numbers.
 * So this reads tolerantly. It finds the time column by its header or takes
 * the first, and recognizes the columns it can chart by what their headers
 * say. Anything it does not recognize is left out rather than guessed at.
 *
 * Times are kept as wall-clock milliseconds (the clock the export printed,
 * read as if it were UTC), because the room's day is a wall-clock day.
 */

export const SERIES_COLUMNS: Record<string, { label: string; unit: string; kind: "substrate" | "environment" }> = {
  wc: { label: "Water content", unit: "%", kind: "substrate" },
  ec: { label: "Substrate EC", unit: "mS/cm", kind: "substrate" },
  temp: { label: "Temperature", unit: "°F", kind: "environment" },
  rh: { label: "Relative humidity", unit: "%", kind: "environment" },
  vpd: { label: "VPD", unit: "kPa", kind: "environment" },
  co2: { label: "CO₂", unit: "ppm", kind: "environment" },
};

const MATCH: [string, RegExp][] = [
  ["wc", /vwc|water\s*content|\bwc\b|moisture/i],
  ["ec", /\bec\b|pore.?ec|bulk.?ec|conductivity/i],
  ["vpd", /vpd/i],
  ["co2", /co2|co₂|carbon/i],
  ["rh", /\brh\b|humid/i],
  ["temp", /temp/i],
];

export type Parsed = { t: number[]; cols: Record<string, (number | null)[]>; kind: "substrate" | "environment"; rows: number; error?: string };

export const MAX_POINTS = 720;

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === delim && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function parseWallTime(s: string): number | null {
  const v = s.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(v);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(v);
  if (m) {
    let h = +m[4];
    const ap = m[7]?.toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return Date.UTC(y, +m[1] - 1, +m[2], h, +m[5], +(m[6] ?? 0));
  }
  if (/^\d{10}$/.test(v)) return +v * 1000;
  if (/^\d{13}$/.test(v)) return +v;
  return null;
}

export function parseSensorCsv(text: string): Parsed {
  const fail = (error: string): Parsed => ({ t: [], cols: {}, kind: "substrate", rows: 0, error });
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 3) return fail("That file has no rows to draw.");
  const delim = [",", ";", "\t"].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const header = splitLine(lines[0], delim);
  let timeCol = header.findIndex((h) => /time|date|stamp/i.test(h));
  if (timeCol < 0) timeCol = 0;

  const picked: [string, number][] = [];
  header.forEach((h, i) => {
    if (i === timeCol) return;
    // A substrate temperature is not the room's temperature; leave it out.
    if (/temp/i.test(h) && /substrate|soil|root|media|slab/i.test(h)) return;
    const hit = MATCH.find(([, re]) => re.test(h));
    if (hit && !picked.some(([k]) => k === hit[0])) picked.push([hit[0], i]);
  });
  if (!picked.length) return fail("None of the columns look like water content, EC, temperature, humidity, VPD or CO₂.");

  const rows: { t: number; v: (number | null)[] }[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delim);
    const t = parseWallTime(cells[timeCol] ?? "");
    if (t === null) continue;
    rows.push({
      t,
      v: picked.map(([, i]) => {
        const n = Number((cells[i] ?? "").replace(/[^0-9.+\-eE]/g, ""));
        return (cells[i] ?? "").trim() === "" || !Number.isFinite(n) ? null : n;
      }),
    });
  }
  if (rows.length < 2) return fail("The time column could not be read. It needs a date and a time on every row.");
  rows.sort((a, b) => a.t - b.t);

  const stride = Math.max(1, Math.ceil(rows.length / MAX_POINTS));
  const kept = rows.filter((_, i) => i % stride === 0);
  const cols: Record<string, (number | null)[]> = {};
  picked.forEach(([k], j) => (cols[k] = kept.map((r) => r.v[j])));
  const kind = picked.some(([k]) => SERIES_COLUMNS[k].kind === "substrate") ? "substrate" : "environment";
  return { t: kept.map((r) => r.t), cols, kind, rows: rows.length };
}

/** A wall-clock moment as a flower day with a fraction, given the flip date. */
export const flowerDayOf = (wallMs: number, flipDate: string): number => (wallMs - Date.parse(`${flipDate}T00:00:00Z`)) / 86_400_000 + 1;
