import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Estimator from "@/components/Estimator";
import { EXPANSION_ALLOWANCE, POLICIES, TIERS, usd } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Four subscription tiers from $2,000 to $8,000 a month, set by flowering light count or flower room count, whichever lands higher.",
};

export default function Pricing() {
  return (
    <>
      <Nav />
      <main id="main" className="wrap pb-24 pt-14 sm:pt-20">
        <p className="eyebrow">Pricing</p>
        <h1 className="mt-5 max-w-3xl text-[2.2rem] leading-[1.08] sm:text-5xl">
          Light count says how big the production is. Room count says how much there is to manage.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-bone/85">
          A facility with 600 lights in three rooms is a different job from 600 lights in twelve. Each tier has a light
          ceiling and a room ceiling. Pass either one and you are in the next tier. The two prices are never added.
        </p>

        <div className="mt-12 overflow-x-auto" tabIndex={0} role="region" aria-label="Pricing tiers table, scrolls sideways on a phone">
          <table className="tbl min-w-[560px]">
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Flower rooms</th>
                <th scope="col">Flowering lights</th>
                <th scope="col">Monthly</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((t, i) => {
                const prev = TIERS[i - 1];
                const rooms = t.open ? `${prev.maxRooms + 1}+` : prev ? `${prev.maxRooms + 1} to ${t.maxRooms}` : `1 to ${t.maxRooms}`;
                const lights = t.open ? `${prev.maxLights + 1}+` : prev ? `${prev.maxLights + 1} to ${t.maxLights}` : `Up to ${t.maxLights}`;
                return (
                  <tr key={t.slug}>
                    <td className="font-semibold">{t.name}</td>
                    <td>{rooms}</td>
                    <td>{lights}</td>
                    <td className="font-display text-lg font-bold">
                      {usd(t.monthly)}
                      {t.open ? "+" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-10">
          <Estimator />
        </div>

        <section className="mt-16">
          <p className="eyebrow">Worked examples</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["300 lights, 2 rooms", "Professional, $4,000. Lights set it."],
              ["90 lights, 5 rooms", "Professional, $4,000. Rooms set it."],
              ["600 lights, 4 rooms", "Advanced, $6,000. Lights set it."],
              ["350 lights, 10 rooms", "Enterprise, $8,000+. Rooms set it."],
            ].map(([a, b]) => (
              <li key={a} className="card flex flex-wrap items-baseline justify-between gap-2 px-5 py-4 text-[15px]">
                <span className="font-semibold text-bone">{a}</span>
                <span className="text-muted">{b}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16">
          <p className="eyebrow">Policies</p>
          <h2 className="mt-3 text-2xl text-bone sm:text-3xl">How the tiers are applied</h2>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {POLICIES.map((p) => (
              <div key={p.name} className="card p-5">
                <dt className="font-semibold text-bone">{p.name}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{p.body}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
            The expansion allowance is {Math.round(EXPANSION_ALLOWANCE * 100)}% above a light threshold. A Professional
            facility can grow from 400 to 440 lights without moving tiers until renewal, as long as it stays at five rooms
            or fewer. These are starting prices and will be checked against the hours the first facilities actually take.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
