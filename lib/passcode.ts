import { randomBytes, scryptSync } from "node:crypto";

/**
 * Facility passcode hashing, kept free of Next imports so the seed script and
 * the auth module compute the same thing.
 *
 * scrypt, not a plain hash: a facility passcode can be four characters (a
 * grower on a phone in a room), and a leaked table of salted SHA-256 values
 * at that length is cracked in seconds. scrypt at these parameters costs
 * about 50ms per guess on one core, which turns the same leak into years.
 * The "v2" prefix is in the derived string so a future change of parameters
 * can be told apart from these.
 */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

export function newSalt(): string {
  return randomBytes(16).toString("hex");
}

export function hashPasscode(salt: string, passcode: string): string {
  return `v2$${scryptSync(passcode, `rgs-facility:${salt}`, KEYLEN, { N, r: R, p: P }).toString("hex")}`;
}
