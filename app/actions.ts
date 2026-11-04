"use server";

import { redirect } from "next/navigation";
import { adminMatches, clearCookies, facilityMatches, setAdminCookie, setClientCookie } from "@/lib/auth";
import { emailLooksReal, q, safePath, str } from "@/lib/forms";
import { clientKey, limiter } from "@/lib/ratelimit";
import { newId, store } from "@/lib/store";
import type { Inquiry } from "@/lib/types";

/**
 * The public side's server actions: the inquiry form and the two doors.
 *
 * Plain <form action={...}> everywhere, with the outcome carried in the query
 * string, so every form on the site submits with JavaScript off and a failed
 * login lands back on the same page with a sentence rather than a dead
 * button. Validation here is the real validation; the browser's is a hint.
 */

const logins = limiter("login", { windowMs: 10 * 60 * 1000, max: 5 });
/** The one unauthenticated write on the site. Ten an hour from one address is a person; more is a loop. */
const inquiries = limiter("inquiry", { windowMs: 60 * 60 * 1000, max: 10 });

export async function submitInquiry(fd: FormData): Promise<void> {
  const key = await clientKey();
  if (!inquiries.allowed(key)) redirect(`/${q({ err: "slow" })}#inquiry`);
  inquiries.fail(key);
  const name = str(fd, "name", 120);
  const email = str(fd, "email", 200);
  const phone = str(fd, "phone", 40);
  if (!name) redirect(`/${q({ err: "name" })}#inquiry`);
  if (!emailLooksReal(email) && !phone) redirect(`/${q({ err: "contact" })}#inquiry`);
  const row: Inquiry = {
    id: newId("inq"),
    name,
    email,
    phone,
    facility: str(fd, "facility", 160),
    state: str(fd, "state", 60),
    lights: str(fd, "lights", 40),
    rooms: str(fd, "rooms", 40),
    sensors: str(fd, "sensors", 60),
    note: str(fd, "note", 3000),
    createdAt: Date.now(),
    status: "new",
  };
  await store.saveInquiry(row);
  // The inquiry is in the consultant's inbox at /admin. No mail leaves this
  // build yet; the README names that as a Jake decision (which mailbox).
  console.log(`[rgs] inquiry ${row.id} from ${row.name} <${row.email}> ${row.phone} ${row.facility} ${row.lights} lights / ${row.rooms} rooms`);
  redirect(`/${q({ sent: "1" })}#inquiry`);
}

export async function clientLogin(fd: FormData): Promise<void> {
  const slug = str(fd, "slug", 40).toLowerCase();
  const passcode = str(fd, "passcode", 200);
  const key = await clientKey();
  if (!logins.allowed(key)) redirect(`/login${q({ slug, err: "slow" })}`);
  const f = slug ? await store.facilityBySlug(slug) : null;
  if (!f || !passcode || !facilityMatches(f, passcode)) {
    logins.fail(key);
    redirect(`/login${q({ slug, err: "no" })}`);
  }
  logins.clear(key);
  await setClientCookie(f);
  redirect(`/f/${f.slug}`);
}

export async function adminLogin(fd: FormData): Promise<void> {
  const passcode = str(fd, "passcode", 200);
  const next = str(fd, "next", 200);
  const key = await clientKey();
  if (!logins.allowed(key)) redirect(`/admin/login${q({ err: "slow", next })}`);
  if (!passcode || !adminMatches(passcode)) {
    logins.fail(key);
    redirect(`/admin/login${q({ err: "no", next })}`);
  }
  logins.clear(key);
  await setAdminCookie();
  redirect(safePath(next, "/admin"));
}

export async function logout(): Promise<void> {
  await clearCookies();
  redirect("/");
}
