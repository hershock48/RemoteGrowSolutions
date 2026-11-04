import type { Metadata } from "next";
import Link from "next/link";
import { createFacility } from "@/app/f/actions";
import { requireAdmin } from "@/lib/load";
import { store } from "@/lib/store";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "New facility", robots: { index: false, follow: false } };

export default async function NewFacility({ searchParams }: { searchParams: Promise<{ err?: string; from?: string }> }) {
  const sp = await searchParams;
  await requireAdmin("/admin/facilities/new");
  const from = sp.from ? await store.inquiry(sp.from) : null;

  return (
    <main id="main" className="wrap flex-1 py-8 sm:py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-flare">
        Consultant home
      </Link>
      <p className="eyebrow mt-4">New facility</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">Create the account</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-muted">
        The sign-in name and passcode are what you tell the grower by phone. Everything else they fill in themselves
        on the profile and room screens.
      </p>

      <form action={createFacility} className="card mt-8 grid max-w-3xl gap-4 p-6 sm:grid-cols-2">
        {from && <input type="hidden" name="inquiryId" value={from.id} />}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">
            Facility name
          </label>
          <input id="name" name="name" className="field" required maxLength={120} defaultValue={from?.facility ?? ""} />
          {sp.err === "name" && <span className="error">The facility needs a name.</span>}
        </div>
        <div>
          <label className="label" htmlFor="slug">
            Sign-in name
          </label>
          <input id="slug" name="slug" className="field" maxLength={40} autoCapitalize="none" placeholder="lowercase, letters and digits" />
          <span className="hint">Blank makes one from the facility name.</span>
          {sp.err === "slug" && <span className="error">Letters, digits and hyphens, two to forty characters.</span>}
          {sp.err === "taken" && <span className="error">That sign-in name is taken.</span>}
        </div>
        <div>
          <label className="label" htmlFor="passcode">
            Passcode
          </label>
          <input id="passcode" name="passcode" type="password" className="field" autoComplete="new-password" required minLength={4} maxLength={200} />
          {sp.err === "passcode" && <span className="error">At least four characters.</span>}
        </div>
        <div>
          <label className="label" htmlFor="contact">
            Head grower / contact
          </label>
          <input id="contact" name="contact" className="field" maxLength={120} defaultValue={from?.name ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" className="field" maxLength={200} defaultValue={from?.email ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone
          </label>
          <input id="phone" name="phone" type="tel" className="field" maxLength={40} defaultValue={from?.phone ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="state">
            State
          </label>
          <input id="state" name="state" className="field" maxLength={60} defaultValue={from?.state || "Michigan"} />
        </div>
        <div>
          <label className="label" htmlFor="flowerRooms">
            Flower rooms
          </label>
          <input id="flowerRooms" name="flowerRooms" type="number" inputMode="numeric" min={0} className="field" defaultValue={from?.rooms?.replace(/\D/g, "") ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="lightsTotal">
            Flowering lights
          </label>
          <input id="lightsTotal" name="lightsTotal" type="number" inputMode="numeric" min={0} className="field" defaultValue={from?.lights?.replace(/\D/g, "") ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="timezone">
            Timezone
          </label>
          <input id="timezone" name="timezone" className="field" maxLength={60} defaultValue={SITE.timezone} />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary">
            Create facility
          </button>
        </div>
      </form>
    </main>
  );
}
