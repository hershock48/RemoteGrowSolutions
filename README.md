# Remote Grow Solutions

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
| Overview | `/f/{slug}` | Rooms on target, needing attention, missing check-ins; the flag list; each room's run and last reading; the week's calendar; the latest approved report; the facility's performance status. |
| Rooms | `/f/{slug}/rooms`, `/rooms/new`, `/rooms/{id}`, `/rooms/{id}/edit` | Equipment profile (fixtures, substrate, emitters, flow rate, durations, sensors) and the room's own targets. Start and close runs; the crop clock writes the flip and planned harvest to the calendar. Trend lines and the full reading history. |
| Check-in | `/f/{slug}/checkin?room=` | The three-times-a-week form. Emitters and flow rate come from the room, so the grower types shot length, shots and collected runoff and sees the percentage as they type. Previous reading in every placeholder, target under every box. Photo to Vercel Blob when a store is attached. |
| Calendar | `/f/{slug}/calendar?week=` | Seven columns, every room's flower day, every event with its owner and done state. Add, edit, mark done, remove. Who made each change and when. |
| Reports | `/f/{slug}/reports`, `/reports/{id}`, `/reports/{id}/edit` | Drafted from the week's data by `lib/report.ts`, edited and approved by the consultant, then visible to the grower. Printable. |
| Call notes | `/f/{slug}/notes`, `/notes/new` | Two versions from one call: the internal record (consultant only) and the client summary (theirs to keep). Dated action items become calendar tasks. |
| Profile | `/f/{slug}/profile` | Facility onboarding: contact, counts, timezone, ten equipment categories. Consultant sets the performance status and can reset the passcode. |
| Consultant | `/admin`, `/admin/facilities/new` | Every facility with its counts, inquiries with a status, and facility creation. |

## Nothing here is rented

| Usually rented | Here |
| --- | --- |
| A scheduling or forms SaaS | Plain forms posting to server actions; they work with JavaScript off. |
| A database host | Neon on the Vercel project (free tier, part of the hosting). In development, PGlite: Postgres compiled to WebAssembly, in-process, persisted to `.data/`. Same SQL both places. |
| A charting library | `components/Sparkline.tsx`, one SVG path. |
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

## Environment

See `.env.example`. Three values, all set by Kevin in the Vercel dashboard:

| Variable | Unset means |
| --- | --- |
| `RGS_ADMIN_PASSCODE` | The consultant side is **closed** in production. Development falls back to `rgs-dev`. |
| `DATABASE_URL` (or any `*_DATABASE_URL`) | Production runs on an in-memory embedded Postgres and every consultant screen says so. Nothing survives a restart. |
| `BLOB_READ_WRITE_TOKEN` | The check-in form says photos are not switched on and saves without one. |

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
- Which sensor platforms will grant API access. Until one does, substrate
  readings are typed.
- Billing. His notes assume Stripe subscriptions; Stripe's restricted list
  covers cultivation education, and this is cultivation management. Settle
  the processor before designing the billing layer. Nothing here takes money.
- Whether the public pages should carry an `og:image` and structured data
  (they are a front door, not a pitch).

## What is not built

- Sensor ingestion. Every field marked "from your sensors" is typed today.
- Transcription of calls. The consultant writes the note.
- Model-drafted prose. See the rule above.
- Billing and the subscription agreement.
- Per-user accounts inside a facility. One passcode per facility, told by phone.

## Checklist (glaze/launch.md)

Verified 2026-11-04 on a production build at 127.0.0.1:4521 with the house
harnesses, consultant cookie set so the gated screens were covered.

- [x] Zero accessibility violations at 390 and 1440 on 21 routes (plus a deliberate 404 probe). The two findings on the first pass (a `/70` opacity on the estimator's tier label, and sideways-scrolling tables without keyboard focus) were fixed at the class, on every table, and re-run.
- [x] Zero console errors, zero 4xx on every route except the 404 probe.
- [ ] `grep -rn PLACEHOLDER`: one hit, `SITE.email`, listed above.
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
- [ ] `npm audit` reviewed at handover.
- [x] No secret in the repo.
- [x] Studio credit placed, plate ground computed from `#060403` with `plate.mjs`.
- [ ] Jake told the credit is there.
- [x] This README.

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
