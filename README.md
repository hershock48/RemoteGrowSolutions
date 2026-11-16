# MI-Gas x Plantsman Management

Named Remote Grow Solutions (RGS) until 2026-11-16, when Jake renamed it. The
new name is in `lib/site.ts` and on every screen a customer reads. The
repository, the vercel.app address, the `RGS_` environment variables and the
`rgs` viewer in the code keep the old initials; renaming a host or a variable
is Kevin's to do, with a redeploy.

The operating system behind Jake's second business: subscription cultivation
management for commercial grows, run remotely. Growers submit three check-ins a
week per flower room, the software compares every reading to the room's own
targets and flags what is outside, the consultant reviews the flagged rooms,
spends an hour on the phone, and a weekly report goes out. Built from his
planning notes of November 2026 (the thread he forwarded to Kevin on
2026-11-04), which set the service model, the dual-factor pricing, the
veg/mom decision, the living calendar and the notes clients keep.

**Status: built and verified locally, not yet attached to a database or a
domain.** It serves from a Vercel preview URL until Kevin attaches storage and
Jake names a host. The public pages are the product's front door; everything
else is behind two passcode doors. Not a pitch: Jake asked for this to exist.

**Sign in locally:** facility `demo`, passcode `grow-demo` (seeded; not a
secret). Consultant passcode in development: `rgs-dev`.

---

## What it does

| Area | Where | What |
| --- | --- | --- |
| Public front door | `/`, `/pricing`, `/calculator` | What the subscription is, the four tiers with the estimator, the irrigation and runoff calculator, the facility requirements, and an inquiry form that lands in the consultant's inbox. |
| Facility sign-in | `/login` | Facility name plus passcode, rate limited. |
| Home | `/f/{slug}` | The facility profile first, on both sides (contact, rooms, lights, irrigation, and the sensor platforms with a link to their live graphs). Then every flower room as a card: the room drawn from its profile, where the run stands, four coloured marks (environment, feed, runoff, tasks), any reading outside its setpoint, the week as a strip of squares and the checklist for today. No counters and no instructions in words; colour and ticks carry the status (Jake, 2026-11-16). A first-week progress strip until the facility has a room, a day of data, a call and an approved report. A grower also gets one quiet line fixed to the bottom of every screen: how many lines are open today, by room. |
| Rooms | `/f/{slug}/rooms`, `/rooms/new`, `/rooms/{id}`, `/rooms/{id}/edit`, `/compare` | The room page, same on both sides, in this order: the room drawn from its profile (`components/RoomVisual.tsx`: walls, benches, plants, fixtures, bench ends coloured by feed zone) beside the room profile in the shape of his weekly sheet (day of flower, genetics, feed EC and pH, lighting, target temp and RH, P1 and P2 timing); **Tasks** (the checklist for today with a tick box on every line, the week as his sheet draws it, and dated one-off items for the room); **Irrigation** (drippers, feeds a day, total volume, P1 and P2 across the lights-on window, every shot with its on and off time and volume, feed against runoff EC, runoff percent, runoff by feed zone, uploaded substrate graphs); **Environment** (temperature, RH, VPD and CO2 against their setpoints, four charts, uploaded climate graphs); a form to upload a sensor export; the dated entries; the run. The rooms list stays plain: room, kind, day of run, lights, last entry. `/compare` overlays up to four rooms on one flower-day axis. |
| Enter data | `/f/{slug}/checkin?room=&day=` | Reached from a room, never from a tab. One entry per room per day: saving again adds to it, and every box already filled shows what is there. Environment, feed EC and pH, then runoff by feed zone (Plant A, Plant B and an optional whole-row read, each EC, pH and mL), substrate, observations and a canopy photo. The applied volume comes from the P1 and P2 schedule on the room, so shot counts are not retyped; the runoff percentage appears while typing. |
| Guide | `/f/{slug}/guide` | How to take a runoff read, by plant (at least two per feed zone, spread out) and by whole row, with a frame for the video demonstration. The video is not recorded yet: `GUIDE.videoUrl` in `lib/site.ts`. |
| Reports | `/f/{slug}/reports`, `/reports/{id}`, `/reports/{id}/edit` | Drafted from the week's data by `lib/report.ts`, edited and approved by the consultant, then visible to the grower. The view adds the quarter's three owner numbers (harvests, grams per square foot, days in flower, each against the prior quarter) and one feed-versus-runoff chart per room with the report's week shaded, computed when the page renders. Prints as a document: paper, ink, charts in their print palette, a running footer. |
| Call notes | `/f/{slug}/notes`, `/notes/new` | Two versions from one call: the internal record (consultant only) and the client summary (theirs to keep). Dated action items become scheduled items under their room. |
| Profile | `/f/{slug}/profile` | Facility onboarding: contact, counts, timezone, ten equipment categories. **Sensor platforms** (`#sensors`): which of Aroya, Growlink, TrolMaster the facility runs, how the consultant sees it, and the address of its live graphs. No password is asked for or stored. **Task list** (`#tasks`): the list every flower room is prompted with; the consultant edits it, the grower reads it. Consultant sets the performance status and can reset the passcode. |
| Consultant | `/admin`, `/admin/facilities/new` | Every facility with its counts, inquiries with a status, and facility creation. |

## The round of 2026-11-16 (Jake's second review)

His email, point by point, and where each landed.

| He asked | What exists |
| --- | --- |
| Remove the four counters on Home | Gone. The profile card carries the sensor platforms in their place. |
| No "needs a look", no "1 of 3, 2 to go"; colour and checklists | Home is cards with coloured marks and ticked lines. The rules engine still decides what is out of range; it is shown as a coloured dot beside the reading. |
| A visual for each flower room, maybe a 3D profile with benches, lights and plants | `components/RoomVisual.tsx`, a projected drawing generated from the profile. It is a schematic: counts are real, positions are even spacing. |
| Full irrigation schedule from dripper size and drippers per plant; P1 and P2 with on and off times | `lib/schedule.ts` and `components/ScheduleView.tsx`. Shot size is never typed. |
| Logins for Aroya, Growlink and TrolMaster so live graphs show under irrigation and environment | **Partly.** The profile records the platform, how the consultant sees it and the address of its live graphs, and every room links out to them. Graphs are drawn in the app from an uploaded export. Vendor logins are not collected and nothing pulls from a vendor yet: see "What is not built". |
| Substrate sensor info should upload as a graph | `lib/sensorcsv.ts` reads a CSV export by its headers; `components/SeriesCharts.tsx` draws it. |
| Prompt the customer for daily and weekly tasks, starting from his sheet | `lib/tasks.ts`: his eleven daily lines with the facility and name details taken out, plus the weekly room profile. A facility can carry its own list. |
| A task list that checks itself when the information is entered | Six of the lines tick from data (photo, observations, dryback, runoff by zone, temperature and RH, assigned items). The rest are ticked by hand. |
| A guide page with a video for runoff reads | `/guide`, written steps live, video frame empty until he records it. |
| A place to enter runoff EC, pH and volume for each feed zone of every room | The entry form, by zone. |
| The customer sees room profiles too | Same room page for both. |
| No "this week" tab; prompts under each room, small alerts at the top or bottom | The calendar and check-in tabs are gone. Dated items sit under their room. The grower's bottom line is the alert. |
| Mobile friendly | Checked at 320, 375, 768 and 1440. |
| Host calls in the app with notes generated automatically? | A question, answered in the hand-off note and under "What is not built". Not built. |

Two conflicts this round surfaced, both left as they were until Jake rules:

- **Daily or three a week.** His sheet is Monday to Friday, so the default task list is weekdays. The public pages and `lib/pricing.ts` still promise three check-ins a week. One of them has to move.
- **TrolMaster.** He now names it for temperature and RH graphs. The requirements list on the public page still says TrolMaster sensors are not supported, which was said about substrate sensors. The wording needs his eye.

## The Aroya reference (2026-11-16, later the same day)

Jake: Aroya's customer interface is the reference for presenting a profile
simply, "without having to start from scratch or reinvent the wheel". Their
app is behind a login, so what was read is what they publish: the dashboard
and the run blueprint shown on aroya.io. Three things were taken from it.

- **A row of rings for the room.** `components/Gauge.tsx`, at the top of the
  room page: temperature, RH, VPD, CO2, substrate water content and EC, runoff
  EC and runoff percent. Theirs colour each reading; ours colour the status,
  green inside the room's setpoint and amber outside, with the setpoint band
  drawn on the ring.
- **Every room as one table.** The Rooms tab is one row a room and one column
  a reading, with a status at the end, as on their dashboard. A value outside
  its setpoint is amber. Runoff percent and genetics stay off it, by his note
  of 2026-11-04.
- **The run as a strip.** Weeks of flower across the top of the room page,
  the current one lit.

What stays different, and he said so himself: this is direct management, so
runoff, the task list and the consultant's read sit beside the readings.
VPD and CO2 now raise a flag against their setpoints like every other
reading (`lib/rules.ts`), so the table and the status never disagree.

## Nothing here is rented

| Usually rented | Here |
| --- | --- |
| A scheduling or forms SaaS | Plain forms posting to server actions; they work with JavaScript off. |
| A database host | Neon on the Vercel project (free tier, part of the hosting). In development, PGlite: Postgres compiled to WebAssembly, in-process, persisted to `.data/`. Same SQL both places. |
| A charting library | `components/LineChart.tsx`: server-rendered SVG with axes, a target band, a dashed ceiling, up to four series and alert dots, every colour a CSS variable so the same markup prints as ink on paper. The arithmetic is `lib/chart.ts`, tested. |
| Hosted fonts | Archivo and Inter self-hosted at build time through `next/font`. |
| A model API for drafting reports | None, by Kevin's standing rule (no API key). `lib/report.ts` drafts from the readings in plain sentences; a model on top of that is a later layer. |

Runtime dependencies: `next`, `react`, `react-dom`, `pg`, `@vercel/blob`.

## How to run it

```bash
npm install
npm run seed      # demo facility into .data/ (run with the server stopped)
npm run dev       # http://localhost:4520
```

`npm test` runs the pure logic (irrigation, pricing, rules, dates, the report
drafter). `npm run typecheck`, `npm run build`, `npm start` (port 4521).

To audit the gated screens on a production build, start it with the two
local-only variables and hand the auditor the consultant cookie:

```bash
RGS_ADMIN_PASSCODE=rgs-dev RGS_DATA_DIR=.data/rgs npm start
```

The cookie value is `sha256("rgs-admin-v1:" + passcode)` in hex, passed as
`--cookie rgs_admin=<hex>` to `glaze/scripts/audit.mjs` in the glazedweb repo.

## Demo mode

A deployment with no database attached is a demo. On every cold start it
seeds the demo facility from `lib/demo.ts` (the same seed `npm run seed`
writes locally) and the grower door opens on `demo` / `grow-demo`. If no
consultant passcode is set either, the consultant door opens on `rgs-demo`;
a set passcode is honoured. Both sign-in pages say what applies. Nothing
behind either door is real and it resets on its own. Attaching a database
ends demo mode: the seed stops, and the consultant door closes until
`RGS_ADMIN_PASSCODE` is set.

With a real database, the consultant home has a "Load the demo facility"
button that writes the same sample facility into the store, so the demo can
be shown from the real link and deleted afterwards like any facility.

## Environment

See `.env.example`. Three values, all set by Kevin in the Vercel dashboard:

| Variable | Unset means |
| --- | --- |
| `RGS_ADMIN_PASSCODE` | The consultant side is **closed** in production. Development falls back to `rgs-dev`. |
| `DATABASE_URL` (or any `*_DATABASE_URL`) | Production runs on an in-memory embedded Postgres and every consultant screen says so. Nothing survives a restart. |
| `BLOB_READ_WRITE_TOKEN` | The check-in form says photos are not switched on and saves without one. |
| `RGS_DATA_DIR` (local only) | Lets `npm start` on the laptop open the seeded on-disk store instead of memory, which is how the gated screens get audited on a production build. Never set on a deployment. |

## Where things live

- **Facts about the service** in `lib/site.ts`: copy, the included list, the
  advisory table, the requirements, the check-in fields, the equipment
  categories. Pricing in `lib/pricing.ts`. One edit each.
- **The records** in `lib/types.ts`. The store (`lib/store.ts`) keeps each
  one as a jsonb document beside the columns a range query needs; the types
  are the schema. Adding a field is editing the type.
- **The rules** in `lib/rules.ts`: what makes the exceptions list. Every
  comparison is to the room's own targets. No universal threshold exists.
- **The report drafter** in `lib/report.ts`.
- **The doors** in `lib/auth.ts`: anchor's workroom shape (passcode, hashed
  cookie, closed when unset), one for the consultant and one per facility.

## Decisions, with reasons

- **One route tree for both viewers.** `/f/{slug}` opens for the facility's
  cookie or the consultant's; the page decides what to show. Half the screens
  of a separate `/admin/f/...` tree, and the grower and the consultant look at
  the same numbers.
- **Targets live on the room, not in a config.** A runoff number that is right
  for coco at day 20 is wrong for rockwool at day 50. The consultant edits
  targets on the weekly call; the rules follow.
- **Veg, mother and clone rooms exist but have no missing-submission rule.**
  Jake's decision: advisory, not active management. They take check-ins when
  the grower has something to report.
- **Action items are text lines, parsed.** "grower: verify emitter rates by
  2026-11-08" is faster to type on a call than a form with three boxes, and
  it round-trips through the edit screen unchanged.
- **The report draft never reaches the grower.** `status: "draft"` is
  consultant-only. Approval is a button, and un-approval is one too.
- **Photos go to Blob, not the database.** Three a week per room at 400KB
  would fill a free Postgres in a season. Blob rides on the hosting.
- **Dates are "YYYY-MM-DD" in the facility's timezone.** A room flipped on
  the 14th was flipped on the 14th. Moments (a save) are epoch ms.
- **No email yet.** Inquiries land in `/admin` and the server log. Which
  mailbox sends, and whether reports go out by mail, are Jake's calls.

## Open with Jake

- `SITE.email` is a PLACEHOLDER. Which mailbox receives inquiries.
- The host. `rgs.glazedweb.com` until he names one.
- The tier prices are his starting numbers, flagged as unvalidated in his own
  notes. The profile page shows the tier each facility lands in.
- Onboarding fee for complex facilities, and the three-month minimum: both
  are stated as policy on `/pricing` with no number for the fee.
- Which sensor platforms will grant API access. Growlink documents a
  developer API on its Sprout plan and above; TrolMaster runs an API gateway
  that issues keys on request for a monthly fee per device; no public Aroya
  API was found (checked 2026-11-16). Until a facility has one, its graphs
  come from an uploaded export and a link out to the live platform.
- The runoff video for `/guide`, and whether the written steps match what he
  shows in it. The steps between his rules are the ordinary method and are a
  draft until he has read them.
- Daily against three a week, and the TrolMaster wording: both above.
- Billing. His notes assume Stripe subscriptions; Stripe's restricted list
  covers cultivation education, and this is cultivation management. Settle
  the processor before designing the billing layer. Nothing here takes money.
- Whether the public pages should carry an `og:image` and structured data
  (they are a front door, not a pitch).

## What is not built

- **Live sensor integration.** Nothing pulls readings from Aroya, Growlink or TrolMaster. A graph inside the app comes from an export the grower uploads; "live" is a link that opens the vendor's own dashboard. Each vendor needs its own connector and its own access (an API key issued to the facility), and none of that exists until a real facility has one to test against.
- **Stored vendor logins.** Deliberately. The app has nothing that can use a third-party password, and holding one is a liability with no benefit. The profile records the platform and the route that works: a viewer invite to the consultant, or an API key.
- **Video upload.** A canopy photo uploads (4 MB, when a Blob store is attached). A 30-second phone video is tens of megabytes and needs a direct-to-storage upload that is not built; the video line on the checklist is ticked by hand.
- **Calls hosted in the app with notes written automatically.** Possible, and a project of its own: a calling provider for the room and the recording, a transcription service, a model to turn the transcript into notes (which needs an API key, against Kevin's standing rule), and recorded consent from everyone on the call. Today the consultant holds the call wherever he likes and writes the note.
- **True 3D.** The room drawing is a fixed projected view. It does not rotate and it is not measured from the room.
- Transcription of calls. The consultant writes the note.
- Model-drafted prose. See the rule above.
- Billing and the subscription agreement.
- Per-user accounts inside a facility. One passcode per facility, told by phone.

## Checklist (glaze/launch.md)

Verified 2026-11-04 on a production build (`next start`) at 127.0.0.1:4521
with the house harnesses and the consultant cookie set. The first production
pass was not what it claimed: with no passcode in the environment the gate
closed, and with no `RGS_DATA_DIR` the store was in memory, so every gated
route audited as the sign-in page or a 404. The server was restarted with
both set and every gated route re-run; the record below is from that run.

- [x] Zero accessibility violations at 390 and 1440 on 21 routes (plus a deliberate 404 probe). Findings fixed at the class and re-run: a `/70` opacity on the estimator's tier label, sideways-scrolling tables without keyboard focus (every table), and a grid column on the room page that let the reading table push the page to 780px on a phone.
- [x] Independent review (a second session, read-only) on 2026-11-04 found eleven issues; all fixed: two open redirects (`next` on the consultant login, `back` on the calendar toggle); past-due events linking to an edit form that could not find them; flips and harvests counting as overdue tasks; the overdue summary naming the newest task as the oldest; "latest reading" chosen by submit time rather than reading day, so a back-filled entry drove the rules; facility passcodes hashed with a single SHA-256 (now scrypt); check-in photos stored with the browser's content type at guessable URLs; facility creation not validating the timezone; the public inquiry form with no rate limit; archived rooms dropped from an event on edit.
- [x] Zero console errors, zero 4xx on every route except the 404 probe.
- [ ] `grep -rn PLACEHOLDER`: `SITE.email`, and `GUIDE.videoUrl` with the guide's written steps, all listed above.
- [x] Every form submitted in a real browser: inquiry, both logins, room profile, check-in (with the live runoff figure matching the server's), calendar add and toggle, report draft and approve, call write-up with a dated action landing on the calendar, facility creation, passcode reset.
- [ ] Remote data source verified on the deployment: needs the Neon database attached first.
- [x] Checked at 320, 390, 768 and 1440: no horizontal overflow on 13 routes at 320 and 768, 22 at 390 and 1440.
- [x] Reduced motion: nothing animates except the credit's hover.
- [x] JavaScript off: every form is a plain `<form action>` posting to a server action; the estimator and calculator degrade to their server-rendered defaults.
- [x] A real 404 in the site's own design.
- [x] Keyboard: focus visible everywhere, skip link first in tab order.
- [x] LCP, CLS and the JavaScript budget, measured with `perf-check.mjs` on the throttled mobile profile: LCP 772 to 984 ms, CLS under 0.02, JavaScript 141 KB on the public routes and 145 KB on the gated ones, every route inside the 150 KB budget.
- [x] Every route has its own title; the public three have their own descriptions.
- [ ] `og:image`: none. Open with Jake.
- [x] Canonical and sitemap point at `rgs.glazedweb.com`; `robots.ts` disallows the gated trees; vercel.app hosts are `noindex` by header.
- [x] Favicon: the MI Gas mark (`app/icon.svg`, `app/apple-icon.png`), since RGS is his.
- [x] HTTPS on Vercel by default.
- [x] `npm audit --omit=dev` reviewed 2026-11-04: four "high" entries, all one advisory (zod memory exhaustion on oversized collections, GHSA-mrhx-c7xc-m3w5) reached only through `@vercel/blob`'s OIDC config dependency. This app never hands user input to zod and never uses the OIDC path; the only fix npm offers is a downgrade of the Blob SDK. Left as is, re-check when `@vercel/blob` moves past it.
- [x] No secret in the repo.
- [x] Studio credit placed, plate ground computed from `#060403` with `plate.mjs`.
- [ ] Jake told the credit is there.
- [x] This README.
- [x] Charts and the print view (2026-11-04, second build day): the chart arithmetic has 18 tests across both suites; the overview, room, report, compare and consultant pages audited clean at 320, 390, 768 and 1440 on the dev server; the report rendered under print-media emulation with Playwright and looked at (`scratchpad/print-shot.mjs` pattern: `page.emulateMedia({ media: "print" })`, screenshot and PDF), which is how the sheet's own dark background was caught.

## Going live, in order

1. Kevin: Vercel > Storage > Create Database > Neon on the `rgs` project. The
   store finds the injected variable by suffix.
2. Kevin: set `RGS_ADMIN_PASSCODE`. Sign in at `/admin/login`.
3. Kevin: Vercel > Storage > Create Blob store, for photos.
4. Create Jake's first facility at `/admin/facilities/new`; tell the grower the
   sign-in name and passcode by phone.
5. Jake: name the host. Attach the domain, then update `SITE.url`.
6. Exercise one full week on the deployment: three check-ins, a call written
   up, a report drafted and approved, before any paying facility.
