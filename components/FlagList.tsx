import Link from "next/link";
import type { Flag } from "@/lib/rules";
import { fmtDay } from "@/lib/dates";

const DOT: Record<Flag["severity"], string> = { missing: "dot-miss", attention: "dot-warn", info: "dot-info" };
const WORD: Record<Flag["severity"], string> = { missing: "Missing", attention: "Attention", info: "Note" };

export default function FlagList({ flags, base, empty = "Every room is inside its targets and every check-in is in." }: { flags: Flag[]; base: string; empty?: string }) {
  if (!flags.length) {
    return (
      <p className="card flex items-center gap-3 px-5 py-4 text-[15px] text-bone/90">
        <span className="dot dot-ok" aria-hidden="true" />
        {empty}
      </p>
    );
  }
  return (
    <ul className="card divide-y divide-line">
      {flags.map((f, i) => (
        <li key={`${f.roomId}-${f.code}-${i}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-5 py-3.5">
          <span className={`dot mt-[7px] ${DOT[f.severity]}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-bone">
              <Link href={`${base}/rooms/${f.roomId}`} className="font-semibold hover:text-flare">
                {f.roomName}
              </Link>{" "}
              <span className="text-muted">{f.text}</span>
            </p>
          </div>
          <span className="pill">
            {WORD[f.severity]}
            {f.day ? ` · ${fmtDay(f.day)}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
