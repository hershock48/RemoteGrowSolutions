import Link from "next/link";
import { logout } from "@/app/actions";
import type { Viewer } from "@/lib/auth";
import { loadBoard } from "@/lib/board";
import { todayIn } from "@/lib/dates";
import type { Backend } from "@/lib/store";
import type { Facility } from "@/lib/types";
import { SITE } from "@/lib/site";

/**
 * The chrome for every signed-in screen: the facility's name, the tabs, who
 * is signed in, and the storage state. None of the marketing header, all of
 * its tokens. Nothing in it prints.
 *
 * THE TABS ARE PLACES, NEVER TIMEFRAMES. There was a calendar tab and a
 * check-in tab; Jake asked for both to go (2026-11-16): what is due lives
 * under the room it belongs to, and a grower is told about it by one quiet
 * line at the bottom of the screen, not by a tab to go and look at.
 *
 * Storage state is said two ways. A deployment with NO durable store gets a
 * band on every consultant screen, because that is a real fault. The
 * laptop's development store gets a small dot in the header with a title,
 * because that is a fact, not a fault.
 */
const TABS: { href: string; label: string }[] = [
  { href: "", label: "Home" },
  { href: "/rooms", label: "Rooms" },
  { href: "/guide", label: "Guide" },
  { href: "/reports", label: "Reports" },
  { href: "/notes", label: "Call notes" },
  { href: "/profile", label: "Profile" },
];

export default async function Shell({
  facility,
  viewer,
  backend,
  current,
  children,
}: {
  facility: Facility;
  viewer: Viewer;
  backend: Backend;
  current: string;
  children: React.ReactNode;
}) {
  const base = `/f/${facility.slug}`;
  // The grower's prompt. Loaded through the request cache, so a page that
  // already asked for the board pays nothing for this.
  const board = viewer === "client" ? await loadBoard(facility.id, todayIn(facility.timezone)) : null;
  const open = board ? board.rooms.map((r) => ({ id: r.room.id, name: r.room.name, n: r.today.filter((s) => !s.done).length })).filter((r) => r.n > 0) : [];
  const total = open.reduce((n, r) => n + r.n, 0);

  return (
    <>
      <header className="z-30 border-b border-line bg-ink/95 backdrop-blur lg:sticky lg:top-0 print:hidden">
        <div className="wrap flex flex-wrap items-center gap-x-6 gap-y-0 py-1 lg:py-2">
          <Link href={viewer === "rgs" ? "/admin" : base} className="flex items-baseline gap-2 py-2 no-underline">
            <span className="font-display text-base font-bold tracking-tight text-bone">{SITE.short}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{facility.name}</span>
          </Link>
          {/* On a phone the tabs wrap to a second row so none is hidden, and the
              header scrolls away with the page; it only sticks where the
              screen can spare the height. */}
          <nav aria-label="Facility" className="order-3 flex w-full flex-wrap gap-x-4 gap-y-0 lg:order-none lg:w-auto lg:flex-1">
            {TABS.map((t) => {
              const active = current === t.href;
              return (
                <Link
                  key={t.href}
                  href={`${base}${t.href}`}
                  aria-current={active ? "page" : undefined}
                  className={`border-b-2 py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] ${
                    active ? "border-flare text-flare" : "border-transparent text-muted hover:text-bone"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-xs text-muted">
            {backend === "pglite-file" && viewer === "rgs" && (
              <span className="flex items-center gap-1.5" title="Development store: an embedded Postgres in .data/ on this computer.">
                <span className="dot dot-info" aria-hidden="true" />
                <span className="sr-only">Development store on this computer.</span>
                <span aria-hidden="true">dev store</span>
              </span>
            )}
            <span className="hidden sm:inline">{viewer === "rgs" ? "Consultant" : "Grower"}</span>
            <form action={logout}>
              <button type="submit" className="py-2 font-semibold hover:text-bone">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className={`wrap flex-1 py-8 sm:py-10 ${total > 0 ? "pb-20 sm:pb-20" : ""}`}>
        {backend === "pglite-memory" && (
          <p className="warn-band mb-6 print:hidden" role="status">
            {viewer === "rgs"
              ? "Demo deployment: no database is attached, so this is sample data that resets on its own. Anything you add here is lost on the next restart. Attach a Postgres database (Vercel > Storage > Neon) before a real facility uses it."
              : "Demo: sample data that resets on its own."}
          </p>
        )}
        {children}
      </main>
      {total > 0 && (
        <aside aria-label="Open today" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 backdrop-blur print:hidden">
          <div className="wrap no-scrollbar flex items-center gap-x-4 overflow-x-auto whitespace-nowrap py-1.5 text-xs text-muted">
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="dot dot-warn" aria-hidden="true" />
              {total} open
            </span>
            {open.map((r) => (
              <Link key={r.id} href={`${base}/rooms/${r.id}#tasks`} className="shrink-0 py-1.5 font-semibold text-bone hover:text-flare">
                {r.name} <span className="font-normal text-muted">{r.n}</span>
              </Link>
            ))}
          </div>
        </aside>
      )}
    </>
  );
}
