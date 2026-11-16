import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Sealing a vendor API key before it is stored.
 *
 * A facility's Aroya, Growlink or TrolMaster API key is the one credential
 * this app keeps for somebody else's system, so it is never stored as typed:
 * AES-256-GCM, a fresh nonce per key, and only the sealed text reaches the
 * database. The page never gets it back; it is shown as its last four
 * characters.
 *
 * WHERE THE SEALING KEY COMES FROM. RGS_SECRET_KEY when the deployment sets
 * one. Otherwise it is derived from the consultant passcode, which every
 * real deployment already has. Changing whichever one is in use makes the
 * stored keys unreadable: they show as "enter it again", which is the safe
 * way to fail. With neither set (the public demo), nothing is stored at all.
 */

const material = () => process.env.RGS_SECRET_KEY || process.env.RGS_ADMIN_PASSCODE || "";

export const secretsReady = () => material().length > 0;

const keyOf = () => scryptSync(material(), "rgs-vendor-keys-v1", 32);

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyOf(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

/** The key as typed, or null when it cannot be opened (the sealing key changed, or the text was altered). */
export function open(sealed: string): string | null {
  try {
    const raw = Buffer.from(sealed, "base64");
    const d = createDecipheriv("aes-256-gcm", keyOf(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
