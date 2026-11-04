import type { Metadata } from "next";
import Shell from "@/components/Shell";
import { resetPasscode, saveProfile } from "@/app/f/actions";
import { requireFacility } from "@/lib/load";
import { store } from "@/lib/store";
import { quote, usd } from "@/lib/pricing";
import { EQUIPMENT_CATEGORIES, READINESS } from "@/lib/site";

export const metadata: Metadata = { title: "Facility profile" };

/**
 * Facility onboarding, filled once and edited when something changes. Ten
 * equipment categories as text, because a dropdown of every dehumidifier
 * ever sold is a project of its own and a grower knows what they run.
 */
export default async function Profile({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ saved?: string; err?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { facility: f, viewer } = await requireFacility(slug);
  const qte = quote(f.lightsTotal, f.flowerRooms);
  const ready = READINESS[f.readiness];

  return (
    <Shell facility={f} viewer={viewer} backend={store.backend} current="/profile">
      <p className="eyebrow">Facility profile</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">{f.name}</h1>
      <p className="mt-2 text-sm text-muted">
        Sign-in name <code className="rounded bg-ink-panel px-1.5 py-0.5 text-bone">{f.slug}</code>. Tier by current counts: {qte.tier.name}, {usd(qte.tier.monthly)}
        {qte.tier.open ? "+" : ""} a month.
      </p>

      {sp.saved && (
        <p className="mt-6 rounded-lg border border-ok/50 bg-ink-panel px-4 py-3 text-sm text-bone" role="status">
          {sp.saved === "created" ? "Facility created. Fill in the profile, then add the rooms." : sp.saved === "passcode" ? "Passcode changed. Every signed-in device for this facility is now signed out." : "Saved."}
        </p>
      )}
      {sp.err === "name" && <p className="error mt-4">The facility needs a name.</p>}
      {sp.err === "number" && <p className="error mt-4">One of the counts is not a number.</p>}
      {sp.err === "timezone" && <p className="error mt-4">That timezone is not one the system knows. Use the form America/Detroit.</p>}

      <form action={saveProfile} className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <input type="hidden" name="slug" value={f.slug} />
        <div className="space-y-6">
          <fieldset className="card p-6">
            <legend className="eyebrow px-1">Facility</legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <F id="name" label="Facility name">
                <input id="name" name="name" className="field" defaultValue={f.name} required maxLength={120} />
              </F>
              <F id="contact" label="Head grower / primary contact">
                <input id="contact" name="contact" className="field" defaultValue={f.contact} maxLength={120} />
              </F>
              <F id="email" label="Email">
                <input id="email" name="email" type="email" className="field" defaultValue={f.email} maxLength={200} />
              </F>
              <F id="phone" label="Phone">
                <input id="phone" name="phone" type="tel" className="field" defaultValue={f.phone} maxLength={40} />
              </F>
              <F id="state" label="State">
                <input id="state" name="state" className="field" defaultValue={f.state} maxLength={60} />
              </F>
              <F id="timezone" label="Timezone" hint="Decides what day a check-in belongs to.">
                <input id="timezone" name="timezone" className="field" defaultValue={f.timezone} maxLength={60} />
              </F>
              <F id="flowerRooms" label="Flower rooms">
                <input id="flowerRooms" name="flowerRooms" type="number" inputMode="numeric" min={0} className="field" defaultValue={f.flowerRooms} />
              </F>
              <F id="lightsTotal" label="Flowering lights, total">
                <input id="lightsTotal" name="lightsTotal" type="number" inputMode="numeric" min={0} className="field" defaultValue={f.lightsTotal} />
              </F>
              <F id="canopySqft" label="Flowering canopy, sq ft">
                <input id="canopySqft" name="canopySqft" type="number" inputMode="decimal" min={0} className="field" defaultValue={f.canopySqft || ""} />
              </F>
              <F id="vegRooms" label="Veg rooms">
                <input id="vegRooms" name="vegRooms" type="number" inputMode="numeric" min={0} className="field" defaultValue={f.vegRooms} />
              </F>
              <F id="momRooms" label="Mother rooms">
                <input id="momRooms" name="momRooms" type="number" inputMode="numeric" min={0} className="field" defaultValue={f.momRooms} />
              </F>
            </div>
          </fieldset>

          <fieldset className="card p-6">
            <legend className="eyebrow px-1">Performance status</legend>
            {viewer === "rgs" ? (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="label" htmlFor="readiness">
                    Status
                  </label>
                  <select id="readiness" name="readiness" className="field" defaultValue={f.readiness}>
                    {(Object.keys(READINESS) as (keyof typeof READINESS)[]).map((k) => (
                      <option key={k} value={k}>
                        {READINESS[k].name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="readinessNote">
                    Why, in a sentence the grower will read
                  </label>
                  <textarea id="readinessNote" name="readinessNote" className="field" defaultValue={f.readinessNote} maxLength={1000} />
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <p className="font-semibold text-bone">{ready.name}</p>
                <p className="mt-1 text-sm text-muted">{f.readinessNote || ready.body}</p>
              </div>
            )}
          </fieldset>
        </div>

        <fieldset className="card p-6">
          <legend className="eyebrow px-1">Equipment and practices</legend>
          <p className="mt-2 text-sm text-muted">Facility-wide. Room-specific fixtures, emitters and targets live on each room.</p>
          <div className="mt-4 space-y-4">
            {EQUIPMENT_CATEGORIES.map((c) => (
              <div key={c.id}>
                <label className="label" htmlFor={`eq_${c.id}`}>
                  {c.name}
                </label>
                <textarea id={`eq_${c.id}`} name={`eq_${c.id}`} className="field min-h-[72px]" defaultValue={f.equipment[c.id] ?? ""} placeholder={c.hint} maxLength={2000} />
              </div>
            ))}
          </div>
          <button type="submit" className="btn-primary mt-6 w-full">
            Save profile
          </button>
        </fieldset>
      </form>

      {viewer === "rgs" && (
        <form action={resetPasscode} className="card mt-8 flex flex-wrap items-end gap-3 p-6">
          <input type="hidden" name="slug" value={f.slug} />
          <div className="flex-1 min-w-[220px]">
            <label className="label" htmlFor="passcode">
              New facility passcode
            </label>
            <input id="passcode" name="passcode" type="password" className="field" autoComplete="new-password" minLength={4} maxLength={200} />
            {sp.err === "passcode" && <span className="error">At least four characters.</span>}
            <span className="hint">Tell the grower by phone. Changing it signs out every device.</span>
          </div>
          <button type="submit" className="btn-ghost">
            Change passcode
          </button>
        </form>
      )}
    </Shell>
  );
}

function F({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
