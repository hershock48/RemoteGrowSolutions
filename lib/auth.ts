import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Facility } from "./types";
import { hashPasscode, newSalt } from "./passcode";

export { hashPasscode, newSalt };

/**
 * Two doors, both in the anchor workroom shape (glaze/catalog/apps.md): a
 * passcode, a cookie that carries a HASH and never the secret, an unset
 * variable in production that CLOSES the door rather than fitting a known
 * lock, and a rate limiter on the login action.
 *
 *   The consultant door. RGS_ADMIN_PASSCODE opens /admin and every facility.
 *
 *   The facility door. Each facility has its own passcode, chosen when the
 *   consultant creates it and told to the grower by phone. Stored as
 *   sha256(salt:passcode); the cookie carries sha256 of THAT, so a stolen
 *   cookie opens one facility until it expires and never yields the
 *   passcode. Changing the passcode changes the hash and logs every device
 *   out, which is the right behaviour when a head grower leaves.
 *
 * What a facility passcode protects: the facility's own rooms, readings,
 * photos, calendar, call notes and reports. Nothing behind either door
 * moves money. This is a gate, not a vault; it is sized for a grower on a
 * phone in a room, with the limiter doing the work a longer passcode would.
 */

const ADMIN_COOKIE = "rgs_admin";
const CLIENT_COOKIE = "rgs_client";
const DEV_ADMIN = "rgs-dev";
const MIN_LENGTH = 4;
/** A working day and the evening after it. */
const MAX_AGE = 60 * 60 * 18;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ------------------------------ consultant ------------------------------ */

export function adminPasscode(): string | null {
  const set = process.env.RGS_ADMIN_PASSCODE?.trim();
  if (set) {
    if (set.length < MIN_LENGTH) {
      console.error(`[rgs] RGS_ADMIN_PASSCODE is shorter than ${MIN_LENGTH} characters, so the consultant side is closed.`);
      return null;
    }
    return set;
  }
  return process.env.NODE_ENV === "production" ? null : DEV_ADMIN;
}

const adminToken = (passcode: string) => sha(`rgs-admin-v1:${passcode}`);

export function adminMatches(candidate: string): boolean {
  const p = adminPasscode();
  return p !== null && same(adminToken(candidate), adminToken(p));
}

export async function isAdmin(): Promise<boolean> {
  const p = adminPasscode();
  if (p === null) return false;
  const got = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!got && same(got, adminToken(p));
}

export async function setAdminCookie(): Promise<void> {
  const p = adminPasscode();
  if (p === null) return;
  (await cookies()).set(ADMIN_COOKIE, adminToken(p), cookieOpts());
}

/* ------------------------------ facility ------------------------------ */

export function facilityMatches(f: Facility, candidate: string): boolean {
  return same(hashPasscode(f.passcodeSalt, candidate), f.passcodeHash);
}

const clientToken = (f: Facility) => sha(`rgs-client-v1:${f.passcodeHash}`);

export async function setClientCookie(f: Facility): Promise<void> {
  (await cookies()).set(CLIENT_COOKIE, `${f.slug}.${clientToken(f)}`, cookieOpts());
}

export async function isClientOf(f: Facility): Promise<boolean> {
  const got = (await cookies()).get(CLIENT_COOKIE)?.value;
  if (!got) return false;
  const dot = got.indexOf(".");
  if (dot < 0) return false;
  return got.slice(0, dot) === f.slug && same(got.slice(dot + 1), clientToken(f));
}

/** Which facility the client cookie names, before the record is loaded. */
export async function clientSlug(): Promise<string | null> {
  const got = (await cookies()).get(CLIENT_COOKIE)?.value;
  if (!got) return null;
  const dot = got.indexOf(".");
  return dot > 0 ? got.slice(0, dot) : null;
}

export type Viewer = "rgs" | "client";

/** Who is looking at this facility, or null for nobody allowed. */
export async function viewerFor(f: Facility): Promise<Viewer | null> {
  if (await isAdmin()) return "rgs";
  if (await isClientOf(f)) return "client";
  return null;
}

export async function clearCookies(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", { ...cookieOpts(), maxAge: 0 });
  jar.set(CLIENT_COOKIE, "", { ...cookieOpts(), maxAge: 0 });
}

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  };
}

export const PASSCODE_MIN = MIN_LENGTH;
