/**
 * Subscription pricing: the dual-factor model the owner settled on in his
 * planning notes (November 2026). Either flowering light count or flower room
 * count can move a facility into a higher tier, and the higher of the two
 * wins. Prices are not added.
 *
 * These are his starting numbers, not validated market rates, and he says so
 * himself. They live here and nowhere else.
 */

export type Tier = {
  slug: "essential" | "professional" | "advanced" | "enterprise";
  name: string;
  /** Inclusive maximums. The last tier has none. */
  maxLights: number;
  maxRooms: number;
  monthly: number;
  /** "$8,000+" rather than "$8,000": very large or complex operations get a custom quote. */
  open: boolean;
  summary: string;
};

export const TIERS: readonly Tier[] = [
  {
    slug: "essential",
    name: "Essential",
    maxLights: 100,
    maxRooms: 2,
    monthly: 2000,
    open: false,
    summary: "One or two flower rooms, up to 100 lights.",
  },
  {
    slug: "professional",
    name: "Professional",
    maxLights: 400,
    maxRooms: 5,
    monthly: 4000,
    open: false,
    summary: "Three to five flower rooms, 101 to 400 lights.",
  },
  {
    slug: "advanced",
    name: "Advanced",
    maxLights: 750,
    maxRooms: 8,
    monthly: 6000,
    open: false,
    summary: "Six to eight flower rooms, 401 to 750 lights.",
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    maxLights: Infinity,
    maxRooms: Infinity,
    monthly: 8000,
    open: true,
    summary: "Nine or more flower rooms, or 751 or more lights.",
  },
] as const;

/** Existing customers may grow this far past a light threshold before the price moves at renewal. */
export const EXPANSION_ALLOWANCE = 0.1;

export function tierByLights(lights: number): Tier {
  return TIERS.find((t) => lights <= t.maxLights) ?? TIERS[TIERS.length - 1];
}

export function tierByRooms(rooms: number): Tier {
  return TIERS.find((t) => rooms <= t.maxRooms) ?? TIERS[TIERS.length - 1];
}

export type Quote = {
  tier: Tier;
  byLights: Tier;
  byRooms: Tier;
  /** Which factor set the price, or "both" when they agree. */
  driver: "lights" | "rooms" | "both";
  annual: number;
};

export function quote(lights: number, rooms: number): Quote {
  const l = Math.max(0, Math.floor(Number.isFinite(lights) ? lights : 0));
  const r = Math.max(0, Math.floor(Number.isFinite(rooms) ? rooms : 0));
  const byLights = tierByLights(l);
  const byRooms = tierByRooms(r);
  const li = TIERS.indexOf(byLights);
  const ri = TIERS.indexOf(byRooms);
  const tier = li >= ri ? byLights : byRooms;
  const driver = li === ri ? "both" : li > ri ? "lights" : "rooms";
  return { tier, byLights, byRooms, driver, annual: tier.monthly * 12 };
}

export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const POLICIES = [
  {
    name: "Higher tier rule",
    body: "Either light count or room count can move a facility into a higher tier. The two prices are never added.",
  },
  {
    name: "Existing customer expansion",
    body: "A 10% allowance above a light threshold for a facility already on the program, with the price reviewed at renewal. Room thresholds stay firm.",
  },
  {
    name: "Large facilities",
    body: "Operations well past the Enterprise thresholds get a custom quote. A facility with 2,500 lights and 25 rooms does not pay what an 800-light facility pays.",
  },
  {
    name: "One facility per subscription",
    body: "A second location is a second subscription.",
  },
  {
    name: "What counts",
    body: "Light count is every installed flowering fixture. Veg, mother and under-canopy lights do not count. Room count is every independently controlled flower room. Pricing follows the contracted footprint, not what happened to be running this week.",
  },
  {
    name: "The same service at every tier",
    body: "Three check-ins a week, one 60-minute call a week, the dashboard, the calendar and the weekly report. Tiers differ by facility size and analysis depth, not by access.",
  },
  {
    name: "Commitment",
    body: "Three months to start. An onboarding fee applies to complex facilities. Calls outside the weekly hour are scheduled and quoted.",
  },
] as const;
