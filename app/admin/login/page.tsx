import type { Metadata } from "next";
import Link from "next/link";
import { adminLogin } from "@/app/actions";
import { adminPasscode, DEMO_ADMIN, isDemoDeployment } from "@/lib/auth";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Consultant sign in", robots: { index: false, follow: false } };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ err?: string; next?: string }> }) {
  const sp = await searchParams;
  const closed = adminPasscode() === null;
  const demo = isDemoDeployment();
  return (
    <main id="main" className="wrap flex flex-1 items-center justify-center py-16">
      <div className="card w-full max-w-sm p-7">
        <p className="eyebrow">{SITE.short} · consultant</p>
        <h1 className="mt-3 text-2xl text-bone">Sign in</h1>
        {closed ? (
          <p className="mt-4 text-sm text-muted">
            The consultant side is not set up on this deployment. Set RGS_ADMIN_PASSCODE in the hosting dashboard, at
            least four characters, and this page becomes the door.
          </p>
        ) : (
          <form action={adminLogin} className="mt-6 space-y-4">
            {demo && (
              <p className="rounded-lg border border-line bg-ink px-4 py-3 text-sm text-muted">
                Demo deployment, sample data that resets on its own. The passcode is <code className="text-bone">{DEMO_ADMIN}</code>.
              </p>
            )}
            <input type="hidden" name="next" value={sp.next ?? "/admin"} />
            <div>
              <label className="label" htmlFor="passcode">
                Passcode
              </label>
              <input id="passcode" name="passcode" type="password" className="field" autoComplete="current-password" required />
              {sp.err === "no" && <span className="error">That is not the passcode.</span>}
              {sp.err === "slow" && <span className="error">Too many tries. Wait a few minutes.</span>}
            </div>
            <button type="submit" className="btn-primary w-full">
              Sign in
            </button>
          </form>
        )}
        <p className="mt-6 text-xs text-muted">
          <Link href="/" className="hover:text-flare">
            Back to the public site
          </Link>
        </p>
      </div>
    </main>
  );
}
