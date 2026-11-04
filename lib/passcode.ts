import { createHash, randomBytes } from "node:crypto";

/**
 * Facility passcode hashing, kept free of Next imports so the seed script and
 * the auth module compute the same thing. sha256 over a per-facility salt and
 * the passcode; the passcode itself is never stored anywhere.
 */
export function newSalt(): string {
  return randomBytes(12).toString("hex");
}

export function hashPasscode(salt: string, passcode: string): string {
  return createHash("sha256").update(`rgs-facility-v1:${salt}:${passcode}`).digest("hex");
}
