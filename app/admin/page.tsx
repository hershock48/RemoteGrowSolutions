import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/actions";
import { loadDemoFacility, setInquiryStatus } from "@/app/f/actions";
import { DEMO_PASSCODE, DEMO_SLUG } from "@/lib/demo";
import { loadDashboard, requireAdmin } from "@/lib/load";
import { store } from "@/lib/store";
import { todayIn, fmtWhen } from "@/lib/dates";
import { quote, usd } from "@/lib/pricing";
import { levelOf, SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Consultant", robots: { index: false, follow: false } };
// The build has no passcode set, so the gate short-circuits before it reads a
// cookie and Next would happily prerender the redirect for ever. Never static.
export const dynamic = "force-dynamic";

/**
 * The consultant's morning: every facility with its flagged and missing
 * counts, then the inquiries from the public page. The work is behind each
 * facility's own screens; this page says where to go first.
 */
export default async function Admin({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  await requireAdmin("/admin");
  const sp = await searchParams;
  const facilities = await store.listFacilities();
  const hasDemo = facilities.some((f) => f.slug === DEMO_SLUG);
  const boards = await Promise.all(facilities.map(async (f) => ({ f, d: await loadDashboard(f, todayIn(f.timezone)) })));
  const inquiries = await store.inquiries();
  const open = inquiries.filter((i) => i.status === "new" || i.status === "contacted");
  const totalFlags = boards.reduce((n, b) => n + b.d.summary.flagged + b.d.summary.missing, 0);

  return (
    <>
      <header className="border-b border-line">
        <div className="wrap flex flex-wrap items-center gap-4 py-3">
          <Link href="/admin" className="font-display text-base font-bold text-bone">
            {SITE.short} <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">consultant</span>
          </Link>
          <Link href="/" className="text-xs font-semibold text-muted hover:text-bone">
            Public site
          </Link>
          <form action={logout} className="ml-auto">
            <button type="submit" className="py-2 text-xs font-semibold text-muted hover:text-bone">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main id="main" className="wrap flex-1 py-8 sm:py-10">
        {store.backend !== "postgres" && (
          <p className="warn-band mb-6" role="status">
            {store.backend === "pglite-memory"
              ? "Demo deployment: no database is attached, so this is sample data that resets on its own. Attach a Postgres database (Vercel > Storage > Neon) before a real facility uses it."
              : "Development storage: embedded Postgres in .data/."}
          </p>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Today</p>
            <h1 className="mt-2 text-3xl sm:text-4xl">
              {facilities.length} facilit{facilities.length === 1 ? "y" : "ies"}, {totalFlags} room{totalFlags === 1 ? "" : "s"} flagged
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={loadDemoFacility}>
              <button type="submit" className="btn-ghost" title={`Writes the sample facility "${DEMO_SLUG}" (passcode ${DEMO_PASSCODE}) into this store, replacing any previous copy.`}>
                {hasDemo ? "Rebuild the demo facility" : "Load the demo facility"}
              </button>
            </form>
            <Link href="/admin/facilities/new" className="btn-primary">
              New facility
            </Link>
          </div>
        </div>
        {sp.demo === "loaded" && (
          <p className="mt-4 rounded-lg border border-ok/50 bg-ink-panel px-4 py-3 text-sm text-bone" role="status">
            Demo facility loaded. Grower sign-in: facility <code>{DEMO_SLUG}</code>, passcode <code>{DEMO_PASSCODE}</code>. Delete it like any facility when you are done.
          </p>
        )}

        <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {boards.length === 0 && (
            <li className="card p-6 text-sm text-muted">
              No facilities yet. Create the first one, give the grower its name and passcode by phone, and have them fill
              in the profile and rooms.
            </li>
          )}
          {boards.map(({ f, d }) => {
            const q = quote(f.lightsTotal, f.flowerRooms);
            const last = [...d.recent.values()].flat().sort((a, b) => b.at - a.at)[0];
            return (
              <li key={f.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/f/${f.slug}`} className="font-display text-xl font-bold text-bone hover:text-flare">
                      {f.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {f.flowerRooms} flower rooms · {f.lightsTotal} lights{levelOf(f.level) ? ` · ${levelOf(f.level)!.name} level` : " · level not set"}
                    </p>
                    <p className="text-xs text-muted">
                      {q.tier.name}, {usd(q.tier.monthly)}
                      {q.tier.open ? "+" : ""} a month
                    </p>
                  </div>
                  <span className={`dot mt-2 ${d.summary.missing ? "dot-miss" : d.summary.flagged ? "dot-warn" : "dot-ok"}`} aria-hidden="true" />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-ink px-2 py-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">On target</dt>
                    <dd className="font-display text-xl font-bold text-ok">{d.summary.onTarget}</dd>
                  </div>
                  <div className="rounded-lg bg-ink px-2 py-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Attention</dt>
                    <dd className={`font-display text-xl font-bold ${d.summary.flagged ? "text-warn" : "text-bone"}`}>{d.summary.flagged}</dd>
                  </div>
                  <div className="rounded-lg bg-ink px-2 py-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Missing</dt>
                    <dd className={`font-display text-xl font-bold ${d.summary.missing ? "text-miss" : "text-bone"}`}>{d.summary.missing}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted">{last ? `Last check-in ${fmtWhen(last.at, f.timezone)}.` : "No check-ins yet."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/f/${f.slug}`} className="btn-small">
                    Open
                  </Link>
                  <Link href={`/f/${f.slug}/notes/new`} className="btn-small">
                    Write up a call
                  </Link>
                  <Link href={`/f/${f.slug}/reports`} className="btn-small">
                    Reports
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>

        <section id="inquiries" className="mt-14 scroll-mt-24">
          <h2 className="text-2xl text-bone">Inquiries</h2>
          <p className="mt-1 text-sm text-muted">From the public page. {open.length} open.</p>
          <ul className="card mt-4 divide-y divide-line">
            {inquiries.length === 0 && <li className="px-5 py-4 text-sm text-muted">None yet.</li>}
            {inquiries.map((i) => (
              <li key={i.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-bone">
                    {i.name}
                    {i.facility ? <span className="text-muted"> · {i.facility}</span> : null}
                  </p>
                  <p className="text-sm text-muted">
                    {[i.email, i.phone, i.state].filter(Boolean).join(" · ")}
                    {i.lights || i.rooms ? ` · ${i.lights || "?"} lights, ${i.rooms || "?"} rooms` : ""}
                    {i.sensors ? ` · ${i.sensors}` : ""}
                  </p>
                  {i.note && <p className="mt-1 text-sm text-bone/85">{i.note}</p>}
                  <p className="mt-1 text-xs text-muted">{new Date(i.createdAt).toLocaleString("en-US")}</p>
                </div>
                <form action={setInquiryStatus} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={i.id} />
                  <label className="sr-only" htmlFor={`st-${i.id}`}>
                    Status
                  </label>
                  <select id={`st-${i.id}`} name="status" className="field !min-h-[36px] !py-1 text-sm" defaultValue={i.status}>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="onboarded">Onboarded</option>
                    <option value="passed">Passed</option>
                  </select>
                  <button type="submit" className="btn-small">
                    Set
                  </button>
                </form>
                {i.status !== "onboarded" && (
                  <Link href={`/admin/facilities/new?from=${i.id}`} className="btn-small">
                    Create facility
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
