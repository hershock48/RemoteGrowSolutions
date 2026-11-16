import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Estimator from "@/components/Estimator";
import { submitInquiry } from "./actions";
import { TIERS, usd } from "@/lib/pricing";
import { ADVISORY, INCLUDED, REQUIREMENTS, SENSOR_PLATFORMS, SITE, WEEK } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE.name} - ${SITE.tagline}`,
  description:
    "Subscription cultivation management for commercial grows. Three check-ins a week, one call a week, a weekly report, a living crop calendar, and a dashboard that shows the rooms outside their own targets.",
};

type SP = Promise<{ sent?: string; err?: string }>;

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <>
      <Nav />
      <main id="main">
        {/* ── Hero ── */}
        <section className="wrap pt-14 sm:pt-20">
          <div className="max-w-3xl">
            <p className="eyebrow">Weekly cultivation management, run remotely</p>
            <h1 className="mt-5 text-[2.4rem] leading-[1.05] sm:text-6xl">
              Your flower rooms, reviewed every week by <span className="text-flare">someone who runs rooms</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-bone/85">
              {SITE.name} is a subscription. Your team submits three short check-ins a week per room. The
              software compares every reading to the room&apos;s own targets and flags what is outside. Your consultant
              reviews the flagged rooms, spends an hour with you on the phone, and you get a written report of the week
              behind and the week ahead.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/pricing" className="btn-primary">
                See pricing
              </Link>
              <Link href="#inquiry" className="btn-ghost">
                Tell us about your facility
              </Link>
            </div>
          </div>
        </section>

        {/* ── What you get ── */}
        <section id="included" className="wrap mt-24 scroll-mt-24 sm:mt-32">
          <p className="eyebrow">Every subscription includes</p>
          <h2 className="mt-3 text-3xl sm:text-4xl">The same service at every tier</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED.map((it) => (
              <li key={it.name} className="card p-6">
                <h3 className="text-lg text-bone">{it.name}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{it.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── How a week runs ── */}
        <section className="wrap mt-24 sm:mt-32">
          <p className="eyebrow">How a week runs</p>
          <h2 className="mt-3 text-3xl sm:text-4xl">Most of the review is done before the call starts</h2>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-xl2 border border-line bg-line lg:grid-cols-5">
            {WEEK.map((s, i) => (
              <li key={s.who + i} className="bg-ink-panel p-5">
                <span className="font-display text-2xl font-bold text-ember">{i + 1}</span>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-flare">{s.who}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-bone/90">{s.what}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Advisory ── */}
        <section className="wrap mt-24 sm:mt-32">
          <div className="card grid gap-8 p-7 sm:p-9 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="eyebrow">Included at no additional cost</p>
              <h2 className="mt-3 text-2xl text-bone sm:text-3xl">{ADVISORY.title}</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">{ADVISORY.body}</p>
            </div>
            {/* min-w-0 on the grid child, or the table sets the column's minimum
                and the card overflows the phone by 55px (measured at 375). */}
            <div className="min-w-0 self-start overflow-x-auto" tabIndex={0} role="region" aria-label="Service comparison table, scrolls sideways on a phone">
              <table className="tbl min-w-[420px]">
                <thead>
                  <tr>
                    <th scope="col">Service</th>
                    <th scope="col">Flower</th>
                    <th scope="col">Clone, mom, veg</th>
                  </tr>
                </thead>
                <tbody>
                  {ADVISORY.rows.map(([a, b, c]) => (
                    <tr key={a}>
                      <td className="text-muted">{a}</td>
                      <td>{b}</td>
                      <td>{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Pricing summary ── */}
        <section className="wrap mt-24 sm:mt-32">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Pricing</p>
              <h2 className="mt-3 text-3xl sm:text-4xl">Four tiers, set by lights or rooms, whichever is higher</h2>
            </div>
            <Link href="/pricing" className="btn-ghost">
              The pricing policies
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t, i) => (
              <div key={t.slug} className={`card p-6 ${i === 1 ? "border-ember/60" : ""}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{t.name}</p>
                <p className="mt-2 font-display text-3xl font-bold text-bone">
                  {usd(t.monthly)}
                  {t.open ? "+" : ""}
                  <span className="text-sm font-semibold text-muted">/mo</span>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted">{t.summary}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Estimator />
          </div>
        </section>

        {/* ── Requirements ── */}
        <section id="requirements" className="wrap mt-24 scroll-mt-24 sm:mt-32">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="eyebrow">What your facility needs</p>
              <h2 className="mt-3 text-3xl sm:text-4xl">Remote review is only as good as the data</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">
                These are conditions, not preferences. A room we cannot read is a room we cannot manage, and finding that
                out here is cheaper than finding it out on the first call.
              </p>
            </div>
            <ul className="space-y-3">
              {REQUIREMENTS.map((r) => (
                <li key={r} className="card flex gap-3 p-5 text-[15px] leading-relaxed text-bone/90">
                  <span className="mt-2 dot dot-warn" aria-hidden="true" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Inquiry ── */}
        <section id="inquiry" className="wrap mt-24 scroll-mt-24 pb-24 sm:mt-32">
          <div className="card p-7 sm:p-9">
            <p className="eyebrow">Start here</p>
            <h2 className="mt-3 text-2xl text-bone sm:text-3xl">Tell us about your facility</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
              Lights, rooms and sensors are enough to place you in a tier and tell you whether the program fits. We
              reply by phone or email, your choice.
            </p>
            {sp.sent ? (
              <p className="mt-6 rounded-lg border border-ok/50 bg-ink px-4 py-3 text-[15px] text-bone" role="status">
                Received. {SITE.owner} will be in touch.
              </p>
            ) : (
              <form action={submitInquiry} className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="iq-name">
                    Your name
                  </label>
                  <input id="iq-name" name="name" className="field" autoComplete="name" required maxLength={120} />
                  {sp.err === "name" && <span className="error">Your name is the one thing we need.</span>}
                </div>
                <div>
                  <label className="label" htmlFor="iq-facility">
                    Facility or company
                  </label>
                  <input id="iq-facility" name="facility" className="field" autoComplete="organization" maxLength={160} />
                </div>
                <div>
                  <label className="label" htmlFor="iq-email">
                    Email
                  </label>
                  <input id="iq-email" name="email" type="email" className="field" autoComplete="email" maxLength={200} />
                </div>
                <div>
                  <label className="label" htmlFor="iq-phone">
                    Phone
                  </label>
                  <input id="iq-phone" name="phone" type="tel" className="field" autoComplete="tel" maxLength={40} />
                  {sp.err === "contact" && <span className="error">One of email or phone, so we can answer.</span>}
                  {sp.err === "slow" && <span className="error">That is a lot of messages from one place. Try again in an hour.</span>}
                </div>
                <div>
                  <label className="label" htmlFor="iq-lights">
                    Flowering lights, total
                  </label>
                  <input id="iq-lights" name="lights" className="field" inputMode="numeric" maxLength={40} placeholder="e.g. 240" />
                </div>
                <div>
                  <label className="label" htmlFor="iq-rooms">
                    Flower rooms
                  </label>
                  <input id="iq-rooms" name="rooms" className="field" inputMode="numeric" maxLength={40} placeholder="e.g. 4" />
                </div>
                <div>
                  <label className="label" htmlFor="iq-sensors">
                    Substrate sensors
                  </label>
                  <select id="iq-sensors" name="sensors" className="field" defaultValue="">
                    <option value="">Choose one</option>
                    {SENSOR_PLATFORMS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                    <option>TrolMaster</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="iq-state">
                    State
                  </label>
                  <input id="iq-state" name="state" className="field" maxLength={60} placeholder="Michigan" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="iq-note">
                    Where the rooms are now, and what you want them to become
                  </label>
                  <textarea id="iq-note" name="note" className="field" maxLength={3000} />
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" className="btn-primary">
                    Send
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
