import Link from "next/link";
import { NAV, SITE } from "@/lib/site";

/**
 * The public header. Brand and sign-in share the top row at every width; the
 * section links sit beside them on a wide screen and drop to their own row
 * on a phone, where four stacked links down the right edge read as a broken
 * layout. Logged-in screens have their own chrome (components/Shell.tsx).
 */
export default function Nav() {
  return (
    <header className="border-b border-line/70">
      <div className="wrap flex flex-wrap items-center gap-x-6 gap-y-1 py-3">
        <Link href="/" className="flex items-baseline gap-2 py-2 no-underline">
          <span className="font-display text-lg font-bold tracking-tight text-bone">{SITE.name}</span>
        </Link>
        <Link href="/login" className="btn-small ml-auto sm:order-last">
          Client sign in
        </Link>
        <nav aria-label="Primary" className="flex w-full flex-wrap items-center gap-x-5 gap-y-0 sm:w-auto sm:flex-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="py-2 text-[13px] font-semibold text-muted hover:text-flare">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
