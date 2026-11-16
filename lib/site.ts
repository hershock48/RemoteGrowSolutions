/**
 * Every fact about the service, in one place. The product pages, the client
 * screens and the consultant screens all read from here, so the day Jake
 * changes a word it changes everywhere.
 *
 * Sources: his planning notes of November 2026 (the service model, the
 * pricing, the veg/mom decision, the calendar and the notes clients keep),
 * and the MI Gas build for the brand. Anything he has not said yet is marked
 * PLACEHOLDER and listed in the README.
 */

/**
 * THE NAME. Jake renamed the product on 2026-11-16: "MI-Gas x Plantsman
 * Management instead of RGS", spelled as he wrote it. It was Remote Grow
 * Solutions (RGS) from its first build on 2026-11-04. The repository, the
 * vercel.app address, the RGS_ environment variables and the "rgs" viewer in
 * the code keep the old initials: none of them is read by a customer, and
 * renaming a host or a variable is a change Kevin makes, with a redeploy.
 */
export const SITE = {
  name: "MI-Gas x Plantsman Management",
  short: "MI-Gas x Plantsman",
  tagline: "Weekly cultivation management for commercial grows, run remotely",
  url: "https://rgs.glazedweb.com",
  /** PLACEHOLDER: the mailbox that receives inquiries. */
  email: "PLACEHOLDER@mi-gas.net",
  owner: "Jake",
  parent: { name: "MI Gas", url: "https://mi-gas.net" },
  /** The facility's default clock until onboarding sets one. */
  timezone: "America/Detroit",
} as const;

export const INCLUDED = [
  {
    name: "Three check-ins a week",
    body: "Each flower room reports environment, feed, runoff and a canopy photo three times a week. Three to five minutes a room from a phone. Sensor platforms fill what they can.",
  },
  {
    name: "One hour a week, on the phone",
    body: "A scheduled 60-minute call: last week's actions, the flagged rooms, what is coming, your questions, and who does what by when.",
  },
  {
    name: "A weekly written report",
    body: "Week behind and week ahead, drafted from your own numbers and approved by your consultant before it reaches you. One or two pages.",
  },
  {
    name: "A checklist under every room",
    body: "The daily and weekly list for each flower room, ticked as the data comes in, with transplants, defoliations and harvests scheduled beside it.",
  },
  {
    name: "Exceptions, not noise",
    body: "The dashboard shows the rooms outside their own targets and the submissions that did not arrive. On-target rooms stay quiet.",
  },
  {
    name: "Call notes you keep",
    body: "Every call produces a written summary with recommendations and action items. You keep those for good, subscription or not.",
  },
] as const;

export const ADVISORY = {
  title: "Full-cycle advisory, included",
  body: "Flowering gets active weekly management. Propagation, mother plants and veg get advisory oversight at no additional cost: rooting consistency, mother health and replacement schedules, growth rates and uniformity, transplant readiness and the hand-off into flower. Plants entering flower set the ceiling on what flower management can do, so we watch the whole facility and manage the rooms that pay.",
  rows: [
    ["Initial assessment and onboarding", "Included", "Included"],
    ["Equipment and operating profile", "Included", "Included"],
    ["Sensor monitoring and analysis", "Active", "Advisory review"],
    ["Irrigation and environmental recommendations", "Weekly", "As needed"],
    ["Crop scheduling", "Active", "Advisory"],
    ["Plant health and development", "Active", "Advisory"],
    ["Performance tracking", "Comprehensive", "Key metrics"],
    ["Weekly consultation", "Primary focus", "As needed"],
    ["Weekly written report", "Comprehensive", "Relevant observations"],
    ["Daily execution", "Your team", "Your team"],
  ],
} as const;

export const WEEK = [
  { who: "Grower", what: "Submits three check-ins a week per room. Sensors fill in what they can." },
  { who: "Software", what: "Calculates runoff and daily volume, compares every reading to the room's own targets, flags what is outside and what did not arrive." },
  { who: "Consultant", what: "Reviews the flagged rooms and the trends, not every number." },
  { who: "Both", what: "One hour on the phone: decisions, coaching, action items with owners and dates." },
  { who: "Software, then consultant", what: "The weekly report is drafted from the data and the call, read, edited and approved before it goes out." },
] as const;

export const REQUIREMENTS = [
  "Continuous temperature and RH monitoring in every independently controlled flower room.",
  "Substrate water content and EC sensors with representative placement. Aroya, Pinnacle, Growlink or equivalent; TrolMaster sensors are not supported.",
  "Measurable irrigation delivery and runoff volume, and a consistent EC and pH procedure.",
  "A named person responsible for the three weekly submissions.",
  "Reliable internet in the facility and the ability to share historical sensor data.",
] as const;

export const READINESS: Record<"qualified" | "conditional" | "restricted", { name: string; body: string }> = {
  qualified: {
    name: "Performance qualified",
    body: "Upstream practices meet the documented standard. Full optimization and normal targets apply.",
  },
  conditional: {
    name: "Conditional",
    body: "Identified upstream deficiencies could affect outcomes. A corrective plan and a timeline are set.",
  },
  restricted: {
    name: "Performance restricted",
    body: "Significant unresolved upstream problems prevent reliable forecasting. Consulting continues inside the agreed scope and affected targets are qualified.",
  },
};

/** Facility-level onboarding, one text block per category. */
export const EQUIPMENT_CATEGORIES = [
  { id: "lighting", name: "Lighting", hint: "Brand, model, wattage, fixtures per room, controller." },
  { id: "hvac", name: "HVAC", hint: "Brand, model, cooling capacity, units per room, heating." },
  { id: "dehu", name: "Dehumidification", hint: "Brand, model, rated capacity, units per room." },
  { id: "irrigation", name: "Irrigation", hint: "Controller, zones, pumps, emitters per plant, emitter flow rate." },
  { id: "substrate", name: "Substrate", hint: "Brand, type, container volume, plants per light." },
  { id: "nutrients", name: "Nutrients", hint: "Brand, product line, stock concentrations, mixing and dosing equipment." },
  { id: "sensors", name: "Sensors", hint: "Platform, sensor types, count, how the consultant gets access." },
  { id: "water", name: "Water", hint: "Source, treatment, starting EC and pH." },
  { id: "cultivation", name: "Cultivation", hint: "Genetics, plant density, veg and flower durations, harvest schedule." },
  { id: "operations", name: "Operations", hint: "Head grower, staffing, production targets, historical performance." },
] as const;

export const SUBSTRATES = ["Coco", "Rockwool", "Rockwool + coco", "Peat blend", "Soil / living soil", "Other"] as const;
export const SENSOR_PLATFORMS = ["Aroya", "Pinnacle", "Growlink", "Other substrate sensors", "None yet"] as const;

/**
 * The platforms a facility can record for live graphs, and the ways RGS can
 * be given sight of them. Jake named Aroya, Growlink and TrolMaster
 * (2026-11-16). There is no password field anywhere: see saveSensors().
 */
export const LIVE_PLATFORMS = ["Aroya", "Growlink", "TrolMaster", "Pinnacle", "Other"] as const;
export const ACCESS_OPTIONS = ["Viewer invite sent to the consultant", "API key requested from the vendor", "Exports uploaded by hand", "Not set up yet"] as const;

/**
 * The runoff guide. PLACEHOLDER: the video has not been recorded. Put an
 * .mp4 or .webm in /public (or a full https address) here and the guide page
 * plays it; while this is empty the page shows the written steps and an
 * empty frame that says so.
 */
export const GUIDE = { videoUrl: "", minPlantsPerZone: 2 } as const;
export const US_STATES = ["Michigan", "Other"] as const;

/**
 * The check-in fields, in the order the grower fills them. The room profile
 * supplies emitters, flow rate and container size, so the form asks only what
 * changes between visits. Sensor-fed values are optional and marked.
 */
export type FieldDef = {
  id: string;
  label: string;
  unit?: string;
  step?: string;
  min?: number;
  max?: number;
  sensor?: boolean;
  group: "environment" | "irrigation" | "runoff" | "substrate";
};

export const CHECKIN_FIELDS: readonly FieldDef[] = [
  { id: "tempF", label: "Temperature", unit: "°F", step: "0.1", min: 40, max: 120, group: "environment" },
  { id: "rh", label: "Relative humidity", unit: "%", step: "0.1", min: 0, max: 100, group: "environment" },
  { id: "ppfd", label: "PPFD", unit: "µmol/m²/s", step: "1", min: 0, max: 3000, group: "environment" },
  { id: "co2", label: "CO₂", unit: "ppm", step: "1", min: 0, max: 5000, group: "environment", sensor: true },
  { id: "feedEc", label: "Feed EC", unit: "mS/cm", step: "0.01", min: 0, max: 20, group: "irrigation" },
  { id: "feedPh", label: "Feed pH", step: "0.01", min: 0, max: 14, group: "irrigation" },
  { id: "shotMin", label: "Shot duration", unit: "min", step: "0.1", min: 0, max: 120, group: "irrigation" },
  { id: "shotsPerDay", label: "Shots per day", step: "1", min: 0, max: 60, group: "irrigation" },
  { id: "runoffEc", label: "Runoff EC", unit: "mS/cm", step: "0.01", min: 0, max: 30, group: "runoff" },
  { id: "runoffPh", label: "Runoff pH", step: "0.01", min: 0, max: 14, group: "runoff" },
  { id: "runoffMl", label: "Daily runoff", unit: "mL per plant", step: "1", min: 0, max: 50000, group: "runoff" },
  { id: "substrateWc", label: "Substrate water content", unit: "%", step: "0.1", min: 0, max: 100, group: "substrate", sensor: true },
  { id: "substrateEc", label: "Substrate EC", unit: "mS/cm", step: "0.01", min: 0, max: 30, group: "substrate", sensor: true },
  { id: "dryback", label: "Dryback", unit: "%", step: "0.1", min: 0, max: 100, group: "substrate", sensor: true },
] as const;

export const GROUPS: Record<FieldDef["group"], string> = {
  environment: "Environment",
  irrigation: "Irrigation",
  runoff: "Runoff",
  substrate: "Substrate (from your sensors)",
};

export const DEFAULT_TARGETS = {
  tempF: [76, 82] as [number, number],
  rh: [55, 65] as [number, number],
  runoffPct: [10, 20] as [number, number],
};

export const NAV = [
  { href: "/#included", label: "What you get" },
  { href: "/pricing", label: "Pricing" },
  { href: "/calculator", label: "Calculator" },
  { href: "/#requirements", label: "Requirements" },
] as const;
