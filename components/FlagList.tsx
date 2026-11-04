import Link from "next/link";
import type { Flag } from "@/lib/rules";
import { fmtDay } from "@/lib/dates";

const DOT: Record<Flag["severity"], string> = { missing: "dot-miss", attention: "dot-warn", info: "dot-info" };
const EDGE: Record<Flag["severity"], string> = { missing: "border-l-miss", attention: "border-l-warn", info: "border-l-edge" };
const WORD: Record<Flag["severity"], string> = { missing: "Missing", attention: "Attention", info: "Note" };
const RANK: Record<Flag["severity"], number> = { missing: 0, attention: 1, info: 2 };

/**
 * One row per ROOM, not per flag. A room with three readings outside its
 * targets is one room to look at; listing it three times made the overview
 * read as three problems and buried the next room. The row carries the
 * room's worst severity on its left edge and every finding under it.
 */
export default function FlagList({ flags, base, empty = "Every room is inside its targets and every check-in is in.", large = false }: { flags: Flag[]; base: string; empty?: string; large?: boolean }) {
  if (!flags.length) {
    return (
      <p className="card flex items-center gap-3 border-l-[3px] border-l-ok px-5 py-4 text-[15px] text-bone/90">
        <span className="dot dot-ok" aria-hidden="true" />
        {empty}
      </p>
    );
  }
  const rooms = new Map<string, { name: string; items: Flag[] }>();
  for (const f of flags) {
    const r = rooms.get(f.roomId) ?? { name: f.roomName, items: [] };
    r.items.push(f);
    rooms.set(f.roomId, r);
  }
  const rows = [...rooms.entries()]
    .map(([id, r]) => ({ id, name: r.name, items: r.items.sort((a, b) => RANK[a.severity] - RANK[b.severity]), worst: r.items.reduce((w, f) => (RANK[f.severity] < RANK[w] ? f.severity : w), r.items[0].severity) }))
    .sort((a, b) => RANK[a.worst] - RANK[b.worst]);

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id} className={`card flex flex-wrap items-start gap-x-3 gap-y-1 border-l-[3px] ${EDGE[row.worst]} px-5 ${large ? "py-4" : "py-3.5"}`}>
          <span className={`dot ${large ? "mt-[9px]" : "mt-[7px]"} ${DOT[row.worst]}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <Link href={`${base}/rooms/${row.id}`} className={`${large ? "font-display text-lg" : "text-[15px]"} font-semibold text-bone hover:text-flare`}>
              {row.name}
            </Link>
            <ul className="mt-0.5 space-y-0.5">
              {row.items.map((f, i) => (
                <li key={`${f.code}-${i}`} className="text-[15px] text-muted">
                  {f.text}
                  {f.day && f.severity !== "attention" ? <span className="text-muted/80"> · {fmtDay(f.day)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
          <span className="pill">{WORD[row.worst]}</span>
        </li>
      ))}
    </ul>
  );
}
