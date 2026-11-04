import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { clientLogin } from "@/app/actions";

export const metadata: Metadata = {
  title: "Client sign in",
  description: "Sign in to your facility's dashboard.",
  robots: { index: false, follow: false },
};

type SP = Promise<{ slug?: string; err?: string }>;

export default async function Login({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <>
      <Nav />
      <main id="main" className="wrap flex-1 pb-24 pt-14 sm:pt-20">
        <div className="card mx-auto max-w-md p-7 sm:p-9">
          <p className="eyebrow">Client sign in</p>
          <h1 className="mt-3 text-2xl text-bone sm:text-3xl">Your facility</h1>
          <p className="mt-2 text-[15px] text-muted">
            Your facility name and passcode were given to you by phone at onboarding.
          </p>
          <form action={clientLogin} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="slug">
                Facility name
              </label>
              <input
                id="slug"
                name="slug"
                className="field"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                defaultValue={sp.slug ?? ""}
                required
                maxLength={40}
              />
            </div>
            <div>
              <label className="label" htmlFor="passcode">
                Passcode
              </label>
              <input id="passcode" name="passcode" type="password" className="field" autoComplete="current-password" required maxLength={200} />
              {sp.err === "no" && <span className="error">That facility and passcode do not match.</span>}
              {sp.err === "slow" && <span className="error">Too many tries. Wait a few minutes.</span>}
            </div>
            <button type="submit" className="btn-primary w-full">
              Sign in
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
