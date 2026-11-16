/**
 * The records Remote Grow Solutions keeps, named here once so the store, the
 * rules, the report drafter and every screen agree on a shape.
 *
 * Dates that are calendar days (a flip, a harvest, a scheduled task) are
 * "YYYY-MM-DD" strings in the facility's own timezone, because a grower who
 * flipped a room on the 14th did so on the 14th regardless of where the server
 * sits. Moments (a check-in, a save) are epoch milliseconds.
 *
 * Nothing here is a recommended target. Targets are the room's own, set at
 * onboarding and adjusted on the weekly call. The rules engine compares a
 * reading to the room's targets and never to a universal number.
 */

export type RoomKind = "flower" | "veg" | "mom" | "clone";

export type Range = [number, number];

export type Targets = {
  /** Fahrenheit, lights on. */
  tempF: Range;
  rh: Range;
  ppfd?: Range;
  feedEc?: Range;
  /** The ceiling above which runoff EC is flagged. */
  runoffEcMax?: number;
  /** Percent of daily applied volume collected as runoff. */
  runoffPct: Range;
  /** Air VPD in kPa, and CO2 in ppm. Setpoints the consultant reads the room against. */
  vpd?: Range;
  co2?: Range;
};

/** One irrigation phase: when it starts, how many shots, how long each runs, how far apart. */
export type Phase = { start: string; shots: number; shotMin: number; everyMin: number };

/**
 * The day's irrigation as the room runs it. P1 is the ramp from lights on up
 * to field capacity; P2 is the maintenance phase after it. Clock times are
 * "HH:MM" on the facility's wall clock.
 */
export type Schedule = { lightsOn: string; lightsOff: string; p1?: Phase; p2?: Phase };

export type Room = {
  id: string;
  facilityId: string;
  name: string;
  kind: RoomKind;
  fixtureModel: string;
  fixtureCount: number;
  canopySqft: number;
  substrate: string;
  containerGal: number;
  plantsPerLight: number;
  emittersPerPlant: number;
  /** Gallons per hour per emitter, nominal. */
  emitterGph: number;
  vegDays: number;
  flowerDays: number;
  hvac: string;
  dehu: string;
  controller: string;
  sensorPlatform: string;
  genetics: string;
  targets: Targets;
  /** Benches (or rows of tables) in the room, for the drawing. */
  benches?: number;
  /** Feed zones: every one gets its own runoff read. Trays, on some sites. */
  feedZones?: number;
  schedule?: Schedule;
  createdAt: number;
  archivedAt?: number;
};

/**
 * One runoff read. A zone is read from at least two plants spread across it,
 * or from a whole-row collection where the room is plumbed for one.
 */
export type ZoneRead = { zone: number; source: "plant" | "row"; n: number; ec?: number; ph?: number; ml?: number };

export type Cycle = {
  id: string;
  facilityId: string;
  roomId: string;
  genetic: string;
  /** The day the room went to 12/12. Flower day 1 is this date. */
  flipDate: string;
  plannedHarvest?: string;
  status: "active" | "harvested";
  harvestedOn?: string;
  /** Wet weight, dry weight, notes: whatever the grower records at the end. */
  outcome?: { dryGrams?: number; note?: string };
  createdAt: number;
};

export type Checkin = {
  id: string;
  facilityId: string;
  roomId: string;
  cycleId?: string;
  at: number;
  /** The facility's calendar day the reading belongs to. */
  day: string;
  dayOfFlower?: number;
  tempF?: number;
  rh?: number;
  ppfd?: number;
  co2?: number;
  feedEc?: number;
  feedPh?: number;
  runoffEc?: number;
  runoffPh?: number;
  /** Collected runoff, mL per plant per day. */
  runoffMl?: number;
  shotMin?: number;
  shotsPerDay?: number;
  /** Computed from the room's emitter configuration at submit time. */
  feedMl?: number;
  runoffPct?: number;
  substrateWc?: number;
  substrateEc?: number;
  dryback?: number;
  observations: string;
  photoUrl?: string;
  /** Runoff by feed zone. The single runoff figures above are the averages of these. */
  zones?: ZoneRead[];
  submittedBy: "client" | "rgs";
};

/** What ticks a task off by itself. "none" is ticked by hand. */
export type TaskAuto = "none" | "environment" | "runoff" | "photo" | "notes" | "substrate" | "assigned";

export type TaskTemplate = { id: string; title: string; cadence: "weekdays" | "daily" | "weekly"; auto: TaskAuto };

/** A hand tick: this task, this room, this day (or the Monday of this week). */
export type TaskTick = { id: string; facilityId: string; roomId: string; taskId: string; period: string; at: number; by: "client" | "rgs" };

/**
 * How the consultant sees a facility's sensor platform: a viewer invite, an
 * address for the live graphs, or an API key the vendor issued.
 *
 * Never a username and password. No vendor offers a way for another app to
 * sign in with them, so there is nowhere to send one. An API key is what the
 * vendors issue for this: it is sealed before it is stored (lib/secret.ts)
 * and the page only ever sees its last four characters.
 */
export type StoredKey = { sealed: string; last4: string; savedAt: number; check?: { at: number; ok: boolean; text: string } };
export type SensorConnection = { platform: string; account: string; access: string; liveUrl: string; note: string; key?: StoredKey };

/** A sensor export, uploaded as a file and drawn as a graph. Times are wall-clock ms. */
export type SensorSeries = {
  id: string;
  facilityId: string;
  roomId: string;
  kind: "substrate" | "environment";
  label: string;
  uploadedAt: number;
  by: "client" | "rgs";
  t: number[];
  cols: Record<string, (number | null)[]>;
};

export type EventKind = "task" | "milestone" | "transplant" | "flip" | "harvest" | "call" | "review";

export type CalEvent = {
  id: string;
  facilityId: string;
  roomId?: string;
  cycleId?: string;
  date: string;
  title: string;
  kind: EventKind;
  owner: "client" | "rgs";
  doneAt?: number;
  doneBy?: "client" | "rgs";
  /** Where the event came from, so a schedule change is traceable. */
  source: "manual" | "auto" | "call";
  note?: string;
  createdBy: "client" | "rgs";
  createdAt: number;
  updatedAt?: number;
};

export type ActionItem = { text: string; owner: "client" | "rgs"; due?: string };

export type CallNote = {
  id: string;
  facilityId: string;
  heldOn: string;
  /** Monday of the week the call covers. */
  weekOf: string;
  /** The consultant's full record: reasoning, data references, decisions. */
  internal: string;
  /** What the client receives and keeps. */
  client: string;
  actions: ActionItem[];
  /** Set when the consultant marks the client version ready. */
  approvedAt?: number;
  createdAt: number;
};

export type Report = {
  id: string;
  facilityId: string;
  weekOf: string;
  status: "draft" | "approved";
  behind: string[];
  ahead: string[];
  actions: ActionItem[];
  exceptions: string[];
  /** The consultant's words on top of the draft. */
  note: string;
  approvedAt?: number;
  createdAt: number;
  updatedAt?: number;
};

export type Readiness = "qualified" | "conditional" | "restricted";

export type Facility = {
  id: string;
  slug: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  state: string;
  timezone: string;
  flowerRooms: number;
  lightsTotal: number;
  canopySqft: number;
  vegRooms: number;
  momRooms: number;
  /** Free text per equipment category, from onboarding. */
  equipment: Record<string, string>;
  readiness: Readiness;
  readinessNote: string;
  /** The daily and weekly list growers are prompted with. Unset means the house default. */
  tasks?: TaskTemplate[];
  sensors?: SensorConnection[];
  /** sha256 of salt + passcode. The passcode itself is never stored. */
  passcodeHash: string;
  passcodeSalt: string;
  createdAt: number;
  updatedAt?: number;
};

export type Inquiry = {
  id: string;
  name: string;
  email: string;
  phone: string;
  facility: string;
  state: string;
  lights: string;
  rooms: string;
  sensors: string;
  note: string;
  createdAt: number;
  status: "new" | "contacted" | "onboarded" | "passed";
};
