import "server-only";

/**
 * What each sensor vendor offers a third party, checked against the vendors'
 * own pages on 2026-11-16, and the one live call this app makes today.
 *
 * ALL THREE ISSUE API KEYS. None of them offers a way for another app to
 * sign in with a customer's username and password, which is why this app
 * never asks for one: there is nowhere to send it.
 *
 *   Aroya       A public REST API. The key comes from Aroya customer support
 *               and carries the permissions of the Aroya user it is tied to;
 *               Aroya recommends a dedicated API user with only the access it
 *               needs. Endpoints: facilities, rooms, devices, a chart per
 *               room and per device, and /validate/.
 *               https://aroya.helpdocs.io/article/z2xm3fxcp2-aroya-public-api-overview
 *   Growlink    A developer platform with REST endpoints for sensor readings.
 *               Keys are requested from Growlink; their developer page ties
 *               access to the plan.  https://www.growlink.com/builder.html
 *   TrolMaster  Read-only sensor readings, Pro controllers only, requested
 *               through TrolMaster's API portal. Their help center says it is
 *               free for now; another TrolMaster page has quoted a monthly
 *               fee per device, so the price is theirs to confirm.
 *               https://kb.trolmaster.com/api-access-for-pro-controllers-how-to-get-started
 *
 * WHAT IS BUILT. A key can be stored for any of the three. For Aroya the app
 * can also ask Aroya whether the key works and which rooms it can see, using
 * the two calls Aroya documents fully. Pulling the readings themselves is
 * NOT built for any vendor: Aroya's schema does not describe what its chart
 * endpoint returns, and the other two publish their reference only to key
 * holders. That last step is written against a real key, never a guess.
 */

export const VENDOR_KEY_HELP: Record<string, string> = {
  Aroya: "Ask Aroya customer support for an API key. They tie it to an Aroya user, so create a user for this with read access to the facility and nothing more.",
  Growlink: "Request an API key from Growlink. Their developer page says access depends on the plan.",
  TrolMaster: "Request API access through TrolMaster's API portal with the email on the TrolMaster account. It covers Pro controllers and is read-only.",
};

const AROYA = "https://api.aroya.io/public_api";

async function get(url: string, key: string): Promise<Response> {
  return fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
}

export type KeyCheck = { ok: boolean; text: string };

/** Ask Aroya whether a key works, and which rooms it can see. */
export async function checkAroyaKey(key: string): Promise<KeyCheck> {
  try {
    const v = await get(`${AROYA}/validate/`, key);
    if (v.status === 401 || v.status === 403) return { ok: false, text: "Aroya refused this key. Check it was copied whole, or ask Aroya support whether it is active." };
    if (!v.ok) return { ok: false, text: `Aroya answered ${v.status}, so the key could not be checked. Try again later.` };
    const r = await get(`${AROYA}/rooms/?pageSize=50`, key);
    if (!r.ok) return { ok: true, text: "Aroya accepted the key. The room list did not load, so check the key's user can see the facility." };
    const body = (await r.json()) as { count?: number; results?: { name?: string }[] };
    const names = (body.results ?? []).map((x) => String(x.name ?? "")).filter(Boolean);
    const count = typeof body.count === "number" ? body.count : names.length;
    if (count === 0) return { ok: true, text: "Aroya accepted the key, but it can see no rooms. Give the key's user access to the facility in Aroya." };
    return { ok: true, text: `Aroya accepted the key. It can see ${count} room${count === 1 ? "" : "s"}: ${names.slice(0, 8).join(", ")}${count > 8 ? " and more" : ""}.` };
  } catch {
    return { ok: false, text: "Aroya could not be reached, so the key was not checked. Try again in a minute." };
  }
}
