import Link from "next/link";
import { logout } from "@/app/actions";
import type { Viewer } from "@/lib/auth";
import type { Backend } from "@/lib/store";
import type { Facility } from "@/lib/types";
import { SITE } from "@/lib/site";

/**
 * The chrome for every signed-in screen: the facility's name, the tabs, who
 * is signed in, and the storage state. None of the marketing header, all of
 * its tokens. Nothing in it prints.
 *
 * Storage state is said two ways. A deployment with NO durable store gets a
 * band on every consultant screen, because that is a real fault. The
 * laptop's development store gets a small dot in the header with a title,
 * because that is a fact, not a fault, and a band on every demo screen was
 * the first thing a visitor read.
 */
const TABS: { href: string; label: string }[] = [
  { href: "", label: "Overview" },
  { href: "/rooms", label: "Rooms" },
  { href: "/checkin", label: "Check-in" },
  { href: "/calendar", label: "Calendar" },
  { href: "/reports", label: "Reports" },
  { href: "/notes", label: "Call notes" },
  { href: "/profile", label: "Profile" },
];

export default function Shell({
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
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur print:hidden">
        <div className="wrap flex flex-wrap items-center gap-x-6 gap-y-1 py-2">
          <Link href={viewer === "rgs" ? "/admin" : base} className="flex items-baseline gap-2 py-2 no-underline">
            <span className="font-display text-base font-bold tracking-tight text-bone">{SITE.short}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{facility.name}</span>
          </Link>
          {/* Seven tabs need about 600px, the brand with a facility name about
              250, the sign-out corner 120. That is more than a 1024px laptop
              window holds beside each other, measured: the last tab wrapped
              alone onto a second line. Below xl the tabs take a full row of
              their own under the brand. */}
          <nav aria-label="Facility" className="order-3 flex w-full flex-wrap gap-x-4 gap-y-0 xl:order-none xl:w-auto xl:flex-1">
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
            <span>{viewer === "rgs" ? "Consultant" : "Grower"}</span>
            <form action={logout}>
              <button type="submit" className="py-2 font-semibold hover:text-bone">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="wrap flex-1 py-8 sm:py-10">
        {backend === "pglite-memory" && (
          <p className="warn-band mb-6 print:hidden" role="status">
            {viewer === "rgs"
              ? "Demo deployment: no database is attached, so this is sample data that resets on its own. Anything you add here is lost on the next restart. Attach a Postgres database (Vercel > Storage > Neon) before a real facility uses it."
              : "Demo: sample data that resets on its own."}
          </p>
        )}
        {children}
      </main>
    </>
  );
}
