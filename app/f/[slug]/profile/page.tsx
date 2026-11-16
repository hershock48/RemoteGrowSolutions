import type { Metadata } from "next";
import Shell from "@/components/Shell";
import { checkSensorKey, resetPasscode, saveProfile, saveSensors, saveTasks } from "@/app/f/actions";
import { requireFacility } from "@/lib/load";
import { secretsReady } from "@/lib/secret";
import { store } from "@/lib/store";
import { VENDOR_KEY_HELP } from "@/lib/vendors";
import { fmtWhen } from "@/lib/dates";
import { quote, usd } from "@/lib/pricing";
import type { SensorConnection } from "@/lib/types";
import { ACCESS_OPTIONS, EQUIPMENT_CATEGORIES, LIVE_PLATFORMS, READINESS } from "@/lib/site";
import { AUTO_LABEL, DEFAULT_TASKS } from "@/lib/tasks";

export const metadata: Metadata = { title: "Facility profile" };

/**
 * Facility onboarding, filled once and edited when something changes. Ten
 * equipment categories as text, because a dropdown of every dehumidifier
 * ever sold is a project of its own and a grower knows what they run.
 *
 * Below it: which sensor platform the facility runs and how RGS sees it, and
 * the task list every flower room is prompted with. The grower fills in the
 * first; the consultant owns the second.
 */
export default async function Profile({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ saved?: string; err?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { facility: f, viewer } = await requireFacility(slug);
  const qte = quote(f.lightsTotal, f.flowerRooms);
  const ready = READINESS[f.readiness];
  const tasks = f.tasks?.length ? f.tasks : DEFAULT_TASKS;
  const sensorRows: SensorConnection[] = [...(f.sensors ?? []), { platform: "", account: "", access: "", liveUrl: "", note: "" }].slice(0, 4);
  const keysOn = secretsReady() && store.backend !== "pglite-memory";
  const taskRows = [...tasks, ...Array.from({ length: 2 }, () => ({ id: "", title: "", cadence: "weekdays" as const, auto: "none" as const }))];
  const CADENCE = { weekdays: "Monday to Friday", daily: "Every day", weekly: "Once a week" } as const;

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
          {sp.saved === "created"
            ? "Facility created. Fill in the profile, then add the rooms."
            : sp.saved === "passcode"
              ? "Passcode changed. Every signed-in device for this facility is now signed out."
              : sp.saved === "sensors"
                ? "Sensor platforms saved."
                : sp.saved === "keycheck"
                  ? "Key checked. The answer is beside it below."
                : sp.saved === "tasks"
                  ? "Task list saved. Every flower room now shows it."
                  : "Saved."}
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

      {/* ── Sensor platforms ── */}
      <section id="sensors" className="card mt-8 scroll-mt-28 p-6">
        <p className="eyebrow">Sensor platforms</p>
        <h2 className="mt-2 text-xl text-bone">Aroya, Growlink, TrolMaster</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Record the platform this facility runs and how the consultant gets to see it. Paste the address of the live graphs and both sides can open them from every room. Enter the API key the vendor issued and the readings can be pulled in. A username and password are never asked for: no vendor lets another app sign in with them, and an API key can be read-only and switched off without changing anyone&apos;s password.
        </p>
        <form action={saveSensors} className="mt-5 space-y-4">
          <input type="hidden" name="slug" value={f.slug} />
          {sensorRows.map((s, i) => (
            <div key={i} role="group" aria-label={s.platform || "Add a platform"} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-2 lg:grid-cols-[150px_1fr_220px_1.4fr]">
              <F id={`platform_${i}`} label="Platform">
                <select id={`platform_${i}`} name={`platform_${i}`} className="field" defaultValue={s.platform}>
                  <option value="">{s.platform ? "Remove" : "Choose one"}</option>
                  {LIVE_PLATFORMS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </F>
              <F id={`account_${i}`} label="Account or site name">
                <input id={`account_${i}`} name={`account_${i}`} className="field" defaultValue={s.account} maxLength={120} autoComplete="off" />
              </F>
              <F id={`access_${i}`} label="How the consultant sees it">
                <select id={`access_${i}`} name={`access_${i}`} className="field" defaultValue={s.access || "Not set up yet"}>
                  {ACCESS_OPTIONS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </F>
              <F id={`liveUrl_${i}`} label="Address of the live graphs" hint="Starts with https://">
                <input id={`liveUrl_${i}`} name={`liveUrl_${i}`} type="url" className="field" defaultValue={s.liveUrl} maxLength={300} placeholder="https://" autoComplete="off" />
              </F>
              <div className="sm:col-span-2 lg:col-span-4">
                <F id={`note_${i}`} label="Note">
                  <input id={`note_${i}`} name={`note_${i}`} className="field" defaultValue={s.note} maxLength={300} placeholder="Which rooms it covers, who to ask for access." />
                </F>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="label" htmlFor={`key_${i}`}>
                  API key from the vendor
                </label>
                {keysOn ? (
                  <>
                    <input
                      id={`key_${i}`}
                      name={`key_${i}`}
                      type="password"
                      className="field"
                      maxLength={400}
                      autoComplete="off"
                      placeholder={s.key ? `A key is on file, ending ${s.key.last4}. Type a new one to replace it.` : "Paste the key here"}
                    />
                    {s.key ? (
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                        <span className="flex items-center gap-1.5">
                          <span className={`dot ${s.key.check ? (s.key.check.ok ? "dot-ok" : "dot-warn") : "dot-info"}`} aria-hidden="true" />
                          On file since {fmtWhen(s.key.savedAt, f.timezone)}, ending {s.key.last4}.
                        </span>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name={`keyRemove_${i}`} value="yes" className="h-4 w-4 accent-ember" />
                          Remove the key on file
                        </label>
                      </span>
                    ) : (
                      <span className="hint">{VENDOR_KEY_HELP[s.platform] ?? "Each vendor issues its own key. Choose the platform to see how to ask for it."}</span>
                    )}
                    {s.key?.check && <span className={`mt-1 block text-xs ${s.key.check.ok ? "text-bone" : "text-warn"}`}>{s.key.check.text}</span>}
                  </>
                ) : (
                  <p className="text-sm text-muted">{store.backend === "pglite-memory" ? "This is the demo, which keeps nothing between visits, so keys are not stored here." : "Keys can be stored once the consultant passcode is set on this deployment."}</p>
                )}
              </div>
            </div>
          ))}
          <button type="submit" className="btn-primary">
            Save platforms
          </button>
        </form>
        {(f.sensors ?? []).map((s, i) =>
          s.key && s.platform === "Aroya" ? (
            <form key={i} action={checkSensorKey} className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <input type="hidden" name="slug" value={f.slug} />
              <input type="hidden" name="index" value={i} />
              <button type="submit" className="btn-ghost">
                Check the Aroya key
              </button>
              <p className="text-sm text-muted">Asks Aroya whether the key works and which rooms it can see.</p>
            </form>
          ) : null
        )}
        <p className="mt-4 max-w-3xl text-xs text-muted">
          A stored key does not draw graphs yet. Pulling the readings is finished against the first real key for each vendor, because none of the three publishes what its readings look like without one. Until then, graphs come from an uploaded export on each room.
        </p>
      </section>

      {/* ── The task list ── */}
      <section id="tasks" className="card mt-8 scroll-mt-28 p-6">
        <p className="eyebrow">Task list</p>
        <h2 className="mt-2 text-xl text-bone">What every flower room is prompted with</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          {f.tasks?.length ? "This facility has its own list." : "This is the standard list."} A line ticks itself when the information it asks for has been entered, and any line can be ticked by hand on the room.
        </p>
        {viewer === "rgs" ? (
          <>
            <form action={saveTasks} className="mt-5 space-y-2">
              <input type="hidden" name="slug" value={f.slug} />
              {taskRows.map((t, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_170px_200px]">
                  <input type="hidden" name={`id_${i}`} value={t.id} />
                  <input name={`title_${i}`} aria-label={`Task ${i + 1}`} className="field" defaultValue={t.title} maxLength={140} placeholder={t.title ? "" : "Add a line"} />
                  <select name={`cadence_${i}`} aria-label={`Task ${i + 1}, how often`} className="field" defaultValue={t.cadence}>
                    {(Object.keys(CADENCE) as (keyof typeof CADENCE)[]).map((c) => (
                      <option key={c} value={c}>
                        {CADENCE[c]}
                      </option>
                    ))}
                  </select>
                  <select name={`auto_${i}`} aria-label={`Task ${i + 1}, what ticks it`} className="field" defaultValue={t.auto}>
                    {(Object.keys(AUTO_LABEL) as (keyof typeof AUTO_LABEL)[]).map((a) => (
                      <option key={a} value={a}>
                        {a === "none" ? "By hand" : `Auto: ${a}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <p className="text-xs text-muted">Clear a line to remove it. Two blank lines at the end are for new ones.</p>
              <button type="submit" className="btn-primary">
                Save the list
              </button>
            </form>
            {f.tasks?.length ? (
              <form action={saveTasks} className="mt-3">
                <input type="hidden" name="slug" value={f.slug} />
                <input type="hidden" name="reset" value="yes" />
                <button type="submit" className="btn-ghost">
                  Go back to the standard list
                </button>
              </form>
            ) : null}
          </>
        ) : (
          <ul className="mt-4 divide-y divide-line text-sm">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                <span className="text-bone">{t.title}</span>
                <span className="text-xs text-muted">
                  {CADENCE[t.cadence]} · {AUTO_LABEL[t.auto]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
