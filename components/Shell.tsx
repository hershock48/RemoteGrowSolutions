import Link from "next/link";
import { logout } from "@/app/actions";
import type { Viewer } from "@/lib/auth";
import type { Backend } from "@/lib/store";
import type { Facility } from "@/lib/types";
import { SITE } from "@/lib/site";

/**
 * The chrome for every signed-in screen: the facility's name, the tabs, who
 * is signed in, and the storage warning when the deployment has nowhere
 * durable to write. None of the marketing header, all of its tokens.
 */
const TABS: { href: string; label: string; admin?: boolean }[] = [
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
      <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
        <div className="wrap flex flex-wrap items-center gap-x-6 gap-y-1 py-2">
          <Link href={viewer === "rgs" ? "/admin" : base} className="flex items-baseline gap-2 py-2 no-underline">
            <span className="font-display text-base font-bold tracking-tight text-bone">{SITE.short}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{facility.name}</span>
          </Link>
          <nav aria-label="Facility" className="order-3 flex w-full flex-wrap gap-x-4 gap-y-0 sm:order-none sm:w-auto sm:flex-1">
            {TABS.filter((t) => !t.admin || viewer === "rgs").map((t) => {
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
        {backend !== "postgres" && viewer === "rgs" && (
          <p className="warn-band mb-6" role="status">
            {backend === "pglite-memory"
              ? "No database is attached to this deployment. Everything saved here is lost when the server restarts. Attach a Postgres database (Vercel > Storage > Neon) before a real facility uses it."
              : "Development storage: an embedded Postgres in .data/. Fine on the laptop, not a deployment."}
          </p>
        )}
        {children}
      </main>
    </>
  );
}
