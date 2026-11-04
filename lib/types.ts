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
};

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
  createdAt: number;
  archivedAt?: number;
};

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
  submittedBy: "client" | "rgs";
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
